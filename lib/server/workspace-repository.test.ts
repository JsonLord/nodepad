import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { openDatabase } from "./database"
import { RevisionConflictError, WorkspaceRepository } from "./workspace-repository"
import type { CanonicalProjectState } from "../storage/types"

function state(revision?: number): CanonicalProjectState {
  return { version: 2, activeWorkspaceId: "w", savedAt: 10, workspaces: [{
    id: "w", name: "Workspace", revision, collapsedIds: ["a"], ghostNotes: [],
    entities: [
      { id: "a", type: "task", title: "A", body: "body", workspaceId: "w", createdAt: 1, updatedAt: 2, metadata: { legacy: { contentType: "task" } } },
      { id: "b", type: "note", title: "B", workspaceId: "w", createdAt: 2, updatedAt: 2 },
    ],
    edges: [{ id: "e", sourceId: "a", targetId: "b", type: "influenced_by", origin: "ai", confidence: 0.8, createdAt: 2, updatedAt: 2 }],
  }] }
}

describe("WorkspaceRepository", () => {
  it("round-trips normalized canonical state and advances revisions", () => {
    const db = openDatabase(":memory:")
    const repo = new WorkspaceRepository(db)
    const first = repo.saveState(state())
    assert.equal(first.workspaces[0].revision, 1)
    assert.equal(first.workspaces[0].edges[0].origin, "ai")
    const second = repo.saveState({ ...first, workspaces: [{ ...first.workspaces[0], name: "Changed" }] }, { w: 1 })
    assert.equal(second.workspaces[0].revision, 2)
    assert.equal(second.workspaces[0].name, "Changed")
    db.close()
  })

  it("rejects stale writes without partially changing the graph", () => {
    const db = openDatabase(":memory:")
    const repo = new WorkspaceRepository(db)
    repo.saveState(state())
    assert.throws(() => repo.saveState({ ...state(0), workspaces: [{ ...state(0).workspaces[0], name: "Stale" }] }, { w: 0 }), RevisionConflictError)
    assert.equal(repo.loadState()?.workspaces[0].name, "Workspace")
    assert.equal(repo.loadState()?.workspaces[0].edges.length, 1)
    db.close()
  })

  it("enforces same-workspace endpoints and rolls back invalid replacements", () => {
    const db = openDatabase(":memory:")
    const repo = new WorkspaceRepository(db)
    const first = repo.saveState(state())
    const invalid = structuredClone(first)
    invalid.workspaces[0].edges[0].targetId = "missing"
    assert.throws(() => repo.saveState(invalid, { w: 1 }))
    assert.equal(repo.loadState()?.workspaces[0].edges[0].targetId, "b")
    db.close()
  })

  it("deletes connected edges transactionally when a workspace is deleted", () => {
    const db = openDatabase(":memory:")
    const repo = new WorkspaceRepository(db)
    repo.saveState(state())
    repo.deleteWorkspace("w", 1)
    assert.equal(repo.loadState(), null)
    const count = db.prepare("SELECT COUNT(*) AS count FROM edges").get() as { count: number }
    assert.equal(count.count, 0)
    db.close()
  })
})
