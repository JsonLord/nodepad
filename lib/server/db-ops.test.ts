import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, writeFileSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openDatabase } from "./database"
import { WorkspaceRepository } from "./workspace-repository"

function run(command: string, env: Record<string,string>, extra: string[] = []) {
  return execFileSync(process.execPath,["scripts/db-ops.mjs",command,...extra],{cwd:process.cwd(),env:{...process.env,...env},encoding:"utf8"})
}
function seed(path:string,name="Original") { const db=openDatabase(path); new WorkspaceRepository(db).saveState({version:2,activeWorkspaceId:"w",savedAt:1,workspaces:[{id:"w",name,entities:[],edges:[],collapsedIds:[],ghostNotes:[]}]}); db.close() }

describe("database operator commands",()=>{
  it("checks, verifies backups, prunes recognized files only, and restores graph data",()=>{
    const dir=mkdtempSync(join(tmpdir(),"nodepad-ops-")); const db=join(dir,"db.sqlite"); const backups=join(dir,"backups"); const env={NODEPAD_DB_PATH:db,NODEPAD_BACKUP_DIR:backups,NODEPAD_BACKUP_KEEP_COUNT:"2"}
    seed(db)
    assert.match(run("check",env),/db_integrity_ok/)
    const first=run("backup",env); assert.match(first,/"quickCheck":"ok"/)
    writeFileSync(join(backups,"unrelated.txt"),"keep")
    for(let i=0;i<3;i++) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,2); run("backup",env) }
    const files=readdirSync(backups); assert.equal(files.filter(x=>x.endsWith(".sqlite")).length,2); assert.ok(files.includes("unrelated.txt"))
    const selected=join(backups,files.filter(x=>x.endsWith(".sqlite")).sort()[0])
    const current=openDatabase(db); current.prepare("UPDATE workspaces SET name='Changed'").run(); current.close()
    run("restore",env,[selected,"--confirm-stopped"])
    const restored=openDatabase(db); assert.equal(new WorkspaceRepository(restored).loadState()?.workspaces[0].name,"Original"); restored.close()
    assert.ok(readdirSync(backups).some(x=>x.includes("pre-restore")))
  })

  it("rejects malformed and wrong-schema restore sources",()=>{
    const dir=mkdtempSync(join(tmpdir(),"nodepad-ops-bad-")); const db=join(dir,"db.sqlite"); seed(db)
    const malformed=join(dir,"bad.sqlite"); writeFileSync(malformed,"not sqlite")
    assert.throws(()=>run("restore",{NODEPAD_DB_PATH:db},[malformed,"--confirm-stopped"]))
    const wrong=join(dir,"wrong.sqlite"); const other=openDatabase(":memory:"); other.close(); writeFileSync(wrong,"")
    assert.throws(()=>run("restore",{NODEPAD_DB_PATH:db},[wrong,"--confirm-stopped"]))
  })
})
