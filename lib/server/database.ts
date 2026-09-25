import { copyFileSync, existsSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { backup, DatabaseSync } from "node:sqlite"
import { logHub } from "./log"

let singleton: DatabaseSync | undefined

export function databasePath(): string {
  if (process.env.NODEPAD_DB_PATH === ":memory:") return ":memory:"
  if (process.env.NODEPAD_DB_PATH) return resolve(process.env.NODEPAD_DB_PATH)
  const dataDir = process.env.NODEPAD_DATA_DIR ? resolve(process.env.NODEPAD_DATA_DIR) : resolve(process.cwd(), ".nodepad-data")
  return resolve(dataDir, "nodepad.sqlite")
}

export const databaseBackupPath = (path = databasePath()) => `${path}.backup`

export function openDatabase(path = databasePath()): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true })
  const connect = () => {
    const database = new DatabaseSync(path)
    database.exec("PRAGMA foreign_keys = ON")
    if (path !== ":memory:") database.exec("PRAGMA journal_mode = WAL")
    runMigrations(database)
    return database
  }
  try {
    return connect()
  } catch (error) {
    const backupPath = databaseBackupPath(path)
    if (path === ":memory:" || !existsSync(backupPath)) throw error
    copyFileSync(backupPath, path)
    logHub("db_restore", { source: "crash_recovery" })
    return connect()
  }
}

export async function backupDatabase(db = getDatabase()): Promise<void> {
  const path = databasePath()
  if (path !== ":memory:") { await backup(db, databaseBackupPath(path)); logHub("db_backup", { kind: "crash_recovery" }) }
}

export function getDatabase(): DatabaseSync {
  singleton ??= openDatabase()
  return singleton
}

export function closeDatabase(): void {
  singleton?.close()
  singleton = undefined
}

export function setDatabaseForTests(database: DatabaseSync | undefined): void {
  singleton = database
}

function runMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `)
  const current = db.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations").get() as { version: number }
  if (current.version < 1) {
    db.exec("BEGIN IMMEDIATE")
    try {
      db.exec(`
        CREATE TABLE workspaces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          revision INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER,
          updated_at INTEGER,
          collapsed_ids_json TEXT NOT NULL DEFAULT '[]',
          ghost_notes_json TEXT NOT NULL DEFAULT '[]',
          last_ghost_texts_json TEXT,
          last_ghost_block_count INTEGER,
          last_ghost_timestamp INTEGER,
          metadata_json TEXT NOT NULL DEFAULT '{}'
        );
        CREATE TABLE entities (
          id TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT,
          status TEXT,
          priority TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          due_at INTEGER,
          scheduled_start INTEGER,
          scheduled_end INTEGER,
          source TEXT,
          source_id TEXT,
          source_url TEXT,
          metadata_json TEXT,
          PRIMARY KEY (workspace_id, id),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );
        CREATE TABLE edges (
          id TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          source_id TEXT NOT NULL,
          target_id TEXT NOT NULL,
          type TEXT NOT NULL,
          origin TEXT NOT NULL,
          confidence REAL,
          explanation TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          metadata_json TEXT,
          PRIMARY KEY (workspace_id, id),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
          FOREIGN KEY (workspace_id, source_id) REFERENCES entities(workspace_id, id) ON DELETE CASCADE,
          FOREIGN KEY (workspace_id, target_id) REFERENCES entities(workspace_id, id) ON DELETE CASCADE
        );
        CREATE TABLE app_state (
          singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
          active_workspace_id TEXT,
          saved_at INTEGER NOT NULL,
          FOREIGN KEY (active_workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
        );
        CREATE INDEX entities_type_idx ON entities(type);
        CREATE INDEX entities_workspace_status_idx ON entities(workspace_id, status);
        CREATE INDEX entities_due_at_idx ON entities(due_at);
        CREATE INDEX entities_source_idx ON entities(source, source_id);
        CREATE INDEX edges_source_idx ON edges(workspace_id, source_id);
        CREATE INDEX edges_target_idx ON edges(workspace_id, target_id);
        CREATE INDEX edges_type_idx ON edges(workspace_id, type);
      `)
      db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(1, Date.now())
      logHub("db_migration", { version: 1 })
      db.exec("COMMIT")
    } catch (error) {
      db.exec("ROLLBACK")
      throw error
    }
  }
  if (current.version < 2) {
    db.exec("BEGIN IMMEDIATE")
    try {
      db.exec(`
        CREATE TABLE control_plane_state (singleton INTEGER PRIMARY KEY CHECK(singleton=1), revision INTEGER NOT NULL);
        INSERT INTO control_plane_state(singleton,revision) VALUES(1,0);
        CREATE TABLE agent_profiles (id TEXT PRIMARY KEY, enabled INTEGER NOT NULL, adapter_type TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, payload_json TEXT NOT NULL);
        CREATE TABLE routing_rules (id TEXT PRIMARY KEY, priority INTEGER NOT NULL, enabled INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, payload_json TEXT NOT NULL);
        CREATE TABLE agent_assignments (id TEXT PRIMARY KEY, agent_profile_id TEXT NOT NULL, scope TEXT NOT NULL CHECK(scope IN ('project','task')), scope_id TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, payload_json TEXT NOT NULL, FOREIGN KEY(agent_profile_id) REFERENCES agent_profiles(id) ON DELETE RESTRICT);
        CREATE TABLE delegations (id TEXT PRIMARY KEY, agent_profile_id TEXT, status TEXT NOT NULL CHECK(status IN ('draft','queued','cancelled')), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, payload_json TEXT NOT NULL, FOREIGN KEY(agent_profile_id) REFERENCES agent_profiles(id) ON DELETE RESTRICT);
        CREATE UNIQUE INDEX assignment_scope_role_idx ON agent_assignments(scope,scope_id,json_extract(payload_json,'$.role'));
        CREATE INDEX rules_priority_idx ON routing_rules(enabled,priority DESC);
        CREATE INDEX delegations_status_idx ON delegations(status,updated_at);
      `)
      db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(2, Date.now())
      logHub("db_migration", { version: 2 })
      db.exec("COMMIT")
    } catch (error) { db.exec("ROLLBACK"); throw error }
  }
  if (current.version < 3) {
    db.exec("BEGIN IMMEDIATE")
    try {
      db.exec(`CREATE TABLE routing_decisions (
        id TEXT PRIMARY KEY, task_entity_id TEXT, project_entity_id TEXT, selected_agent_id TEXT,
        decision TEXT NOT NULL, decision_source TEXT NOT NULL, escalation_reason TEXT,
        confidence REAL, margin REAL, control_plane_revision INTEGER NOT NULL,
        remote_model_id TEXT, latency_ms INTEGER, created_at INTEGER NOT NULL, payload_json TEXT NOT NULL
      ); CREATE INDEX routing_decisions_created_idx ON routing_decisions(created_at DESC);
         CREATE INDEX routing_decisions_task_idx ON routing_decisions(task_entity_id,created_at DESC);`)
      db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(3,Date.now())
      logHub("db_migration",{version:3});db.exec("COMMIT")
    } catch(error){db.exec("ROLLBACK");throw error}
  }
  if (current.version < 4) {
    db.exec("BEGIN IMMEDIATE")
    try {
      db.exec(`
        ALTER TABLE delegations RENAME TO delegations_v3;
        CREATE TABLE delegations (id TEXT PRIMARY KEY, agent_profile_id TEXT, status TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, payload_json TEXT NOT NULL, FOREIGN KEY(agent_profile_id) REFERENCES agent_profiles(id) ON DELETE RESTRICT);
        INSERT INTO delegations SELECT * FROM delegations_v3;
        DROP TABLE delegations_v3;
        CREATE TABLE agtx_project_mappings (id TEXT PRIMARY KEY,nodepad_project_entity_id TEXT NOT NULL,agent_profile_id TEXT NOT NULL,agtx_project_id TEXT,repository_path TEXT NOT NULL,enabled INTEGER NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,payload_json TEXT NOT NULL,FOREIGN KEY(agent_profile_id) REFERENCES agent_profiles(id) ON DELETE RESTRICT);
        CREATE UNIQUE INDEX agtx_mapping_project_idx ON agtx_project_mappings(nodepad_project_entity_id,agent_profile_id);
        CREATE TABLE agtx_dispatch_attempts (delegation_id TEXT PRIMARY KEY,state TEXT NOT NULL,external_run_id TEXT,routing_decision_id TEXT,agent_profile_id TEXT NOT NULL,authorized_by TEXT NOT NULL,authorized_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,error_code TEXT,FOREIGN KEY(delegation_id) REFERENCES delegations(id) ON DELETE RESTRICT,FOREIGN KEY(agent_profile_id) REFERENCES agent_profiles(id) ON DELETE RESTRICT);
        CREATE TABLE delegation_events (id TEXT PRIMARY KEY,delegation_id TEXT NOT NULL,provider TEXT NOT NULL,event_type TEXT NOT NULL,external_status TEXT,message TEXT,metadata_json TEXT NOT NULL DEFAULT '{}',dedupe_key TEXT NOT NULL,created_at INTEGER NOT NULL,FOREIGN KEY(delegation_id) REFERENCES delegations(id) ON DELETE RESTRICT,UNIQUE(delegation_id,dedupe_key));
        CREATE INDEX delegation_events_delegation_idx ON delegation_events(delegation_id,created_at);
      `)
      db.prepare("INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)").run(4,Date.now())
      logHub("db_migration",{version:4});db.exec("COMMIT")
    } catch(error){db.exec("ROLLBACK");throw error}
  }
}
