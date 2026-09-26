import { describe, it } from "node:test"
import assert from "node:assert/strict"
import type { Workspace } from "../domain/workspace"
import { BrowserGraphStore, BACKUP_STORAGE_KEY, MIGRATION_STORAGE_KEY, PRIMARY_STORAGE_KEY } from "./browser-graph-store"
import { STORAGE_SCHEMA_VERSION, type CanonicalProjectState } from "./types"
import { workspaceBlocks } from "../domain/workspace-operations"

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

function workspace(id: string): Workspace {
  return {
    id, name: id, collapsedIds: [], ghostNotes: [],
    entities: [{ id: `${id}-a`, type: "note", title: "A", body: "A", workspaceId: id, createdAt: 1, updatedAt: 1 }],
    edges: [],
  }
}

function state(workspaces: Workspace[], activeWorkspaceId = workspaces[0].id): CanonicalProjectState {
  return { version: STORAGE_SCHEMA_VERSION, activeWorkspaceId, workspaces, savedAt: Date.now() }
}

describe("BrowserGraphStore", async () => {
  it("saves and restores canonical entities, edges, multiple workspaces, and active workspace", async () => {
    const storage = new MemoryStorage()
    const one = workspace("one")
    const two = workspace("two")
    two.entities.push({ id: "two-b", type: "task", title: "B", body: "B", workspaceId: "two", createdAt: 2, updatedAt: 2 })
    two.edges.push({ id: "edge", sourceId: "two-b", targetId: "two-a", type: "influenced_by", origin: "user", createdAt: 2, updatedAt: 2 })
    await new BrowserGraphStore(storage).save(state([one, two], "two"))
    const loaded = await new BrowserGraphStore(storage).load()
    assert.equal(loaded?.activeWorkspaceId, "two")
    assert.equal(loaded?.workspaces.length, 2)
    assert.equal(loaded?.workspaces[1].edges[0].origin, "user")
  })

  it("keeps a last-known-good backup and recovers when primary is corrupt", async () => {
    const storage = new MemoryStorage()
    const store = new BrowserGraphStore(storage)
    await store.save(state([workspace("first")]))
    await store.save(state([workspace("second")]))
    assert.ok(storage.getItem(BACKUP_STORAGE_KEY)?.includes("first"))
    storage.setItem(PRIMARY_STORAGE_KEY, "{broken")
    assert.equal((await store.load())?.activeWorkspaceId, "first")
  })

  it("migrates legacy projects without deleting rollback keys or relationships", async () => {
    const storage = new MemoryStorage()
    storage.setItem("nodepad-projects", JSON.stringify([{ id: "legacy", name: "Legacy", collapsedIds: [], ghostNotes: [], blocks: [
      { id: "task-a", text: "A", timestamp: 1, contentType: "task", influencedBy: ["note-b"] },
      { id: "note-b", text: "B", timestamp: 2, contentType: "claim" },
      { id: "task-c", text: "C", timestamp: 3, contentType: "task" },
    ] }]))
    storage.setItem("nodepad-active-project", "legacy")
    const migrated = (await new BrowserGraphStore(storage).loadOrMigrate())!
    assert.equal(migrated.activeWorkspaceId, "legacy")
    assert.equal(migrated.workspaces[0].entities.filter(entity => entity.type === "task").length, 2)
    assert.deepEqual(migrated.workspaces[0].edges.map(edge => [edge.sourceId, edge.targetId, edge.origin]), [["task-a", "note-b", "import"]])
    assert.ok(storage.getItem("nodepad-projects"))
    assert.ok(storage.getItem(MIGRATION_STORAGE_KEY))
  })

  it("migrates the oldest single-project keys", async () => {
    const storage = new MemoryStorage()
    storage.setItem("nodepad-blocks", JSON.stringify([{ id: "a", text: "A", timestamp: 1, contentType: "idea" }]))
    storage.setItem("nodepad-collapsed", JSON.stringify(["a"]))
    const migrated = (await new BrowserGraphStore(storage).loadOrMigrate())!
    assert.equal(migrated.workspaces[0].id, "default")
    assert.equal(workspaceBlocks(migrated.workspaces[0])[0].text, "A")
    assert.deepEqual(migrated.workspaces[0].collapsedIds, ["a"])
  })

  it("falls back from corrupt legacy primary projects to the legacy backup", async () => {
    const storage = new MemoryStorage()
    storage.setItem("nodepad-projects", "not json")
    storage.setItem("nodepad-backup", JSON.stringify([{ id: "backup", name: "Backup", blocks: [], collapsedIds: [], ghostNotes: [] }]))
    assert.equal((await new BrowserGraphStore(storage).loadOrMigrate())?.activeWorkspaceId, "backup")
  })
})
