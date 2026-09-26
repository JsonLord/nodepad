#!/usr/bin/env node
import { backup, DatabaseSync } from "node:sqlite"
import { access, mkdir, readdir, rm, stat } from "node:fs/promises"
import { constants } from "node:fs"
import { resolve, dirname, join, basename } from "node:path"

const command = process.argv[2]
const args = process.argv.slice(3)
const dbPath = resolve(process.env.NODEPAD_DB_PATH || join(process.env.NODEPAD_DATA_DIR || ".nodepad-data", "nodepad.sqlite"))
const backupDir = resolve(process.env.NODEPAD_BACKUP_DIR || join(dirname(dbPath), "backups"))
const keep = Number(process.env.NODEPAD_BACKUP_KEEP_COUNT || 14)
const pattern = /^nodepad-\d{8}T\d{6}\.\d{3}Z(?:-pre-restore)?\.sqlite$/
const stamp = () => new Date().toISOString().replaceAll(":", "").replaceAll("-", "")
const event = (name, fields={}) => console.log(JSON.stringify({ component:"nodepad-db-ops", event:name, timestamp:new Date().toISOString(), ...fields }))

function inspect(path) {
  const db = new DatabaseSync(path, { readOnly: true })
  try {
    const quick = db.prepare("PRAGMA quick_check").all().map(r => r.quick_check)
    const foreign = db.prepare("PRAGMA foreign_key_check").all()
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name))
    for (const table of ["schema_migrations","workspaces","entities","edges","app_state","control_plane_state","agent_profiles","routing_rules","agent_assignments","delegations","routing_decisions","agtx_project_mappings","agtx_dispatch_attempts","delegation_events"]) if (!tables.has(table)) throw new Error(`missing Nodepad table: ${table}`)
    const migration = db.prepare("SELECT COALESCE(MAX(version),0) version FROM schema_migrations").get().version
    if (quick.length !== 1 || quick[0] !== "ok") throw new Error(`quick_check failed: ${quick.join(",")}`)
    if (foreign.length) throw new Error(`foreign_key_check found ${foreign.length} violation(s)`)
    return { quickCheck:"ok", foreignKeyViolations:0, schemaVersion:Number(migration) }
  } finally { db.close() }
}

async function createBackup(suffix="") {
  inspect(dbPath)
  await mkdir(backupDir, { recursive:true })
  const destination = join(backupDir, `nodepad-${stamp()}${suffix}.sqlite`)
  const source = new DatabaseSync(dbPath, { readOnly:true })
  try { await backup(source, destination) } finally { source.close() }
  const verified = inspect(destination)
  const size = (await stat(destination)).size
  event("db_backup", { path:destination, size, ...verified })
  return destination
}

async function prune(newest) {
  if (!Number.isInteger(keep) || keep < 1) throw new Error("NODEPAD_BACKUP_KEEP_COUNT must be a positive integer")
  const entries = (await readdir(backupDir)).filter(name => pattern.test(name)).sort().reverse()
  const retained = new Set([basename(newest), ...entries.slice(0, keep)])
  for (const name of entries) if (!retained.has(name)) { await rm(join(backupDir,name)); event("db_backup_pruned", { file:name }) }
}

async function restore(sourcePath) {
  if (!sourcePath || !args.includes("--confirm-stopped")) throw new Error("Usage: npm run db:restore -- /path/backup.sqlite --confirm-stopped (stop Nodepad first)")
  const source = resolve(sourcePath)
  const sourceInfo = inspect(source)
  if (await stat(dbPath).catch(()=>null)) await createBackup("-pre-restore")
  await mkdir(dirname(dbPath), { recursive:true })
  const temporary = `${dbPath}.restore-${Date.now()}`
  const sourceDb = new DatabaseSync(source, { readOnly:true })
  try { await backup(sourceDb, temporary) } finally { sourceDb.close() }
  inspect(temporary)
  await rm(`${dbPath}-wal`, { force:true }); await rm(`${dbPath}-shm`, { force:true })
  const tempDb = new DatabaseSync(temporary, { readOnly:true }); tempDb.close()
  const { rename } = await import("node:fs/promises"); await rename(temporary, dbPath)
  const restored = inspect(dbPath)
  event("db_restore", { source, ...sourceInfo, restoredSchemaVersion:restored.schemaVersion })
}

try {
  if (process.env.NEXT_PUBLIC_NODEPAD_STORAGE_MODE === "server" && !process.env.NODEPAD_API_TOKEN) throw new Error("NODEPAD_API_TOKEN is required in server mode")
  if (command === "check") {
    await mkdir(dirname(dbPath), { recursive:true }); await access(dirname(dbPath), constants.W_OK)
    if (!(await stat(dbPath).catch(()=>null))) event("db_preflight_new_database", { path:dbPath })
    else event("db_integrity_ok", { path:dbPath, ...inspect(dbPath) })
  }
  else if (command === "backup") { const path=await createBackup(); await prune(path) }
  else if (command === "restore") await restore(args[0])
  else throw new Error("Usage: db-ops.mjs check|backup|restore")
} catch (error) {
  console.error(JSON.stringify({ component:"nodepad-db-ops", event:"db_operation_failed", message:error instanceof Error ? error.message : "unknown" }))
  process.exitCode = 1
}
