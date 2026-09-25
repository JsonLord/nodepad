import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { ApiStore, ApiStoreAuthenticationError, ApiStoreConflictError } from "./api-store"
import type { CanonicalProjectState } from "./types"

const state: CanonicalProjectState = { version: 2, activeWorkspaceId: "w", savedAt: 1, workspaces: [{ id: "w", name: "W", revision: 3, entities: [], edges: [], collapsedIds: [], ghostNotes: [] }] }

class MemoryStorage implements Storage {
  private values = new Map<string, string>(); get length() { return this.values.size }
  clear() { this.values.clear() } getItem(k: string) { return this.values.get(k) ?? null } key(i: number) { return [...this.values.keys()][i] ?? null }
  removeItem(k: string) { this.values.delete(k) } setItem(k: string, v: string) { this.values.set(k, v) }
}

describe("ApiStore", () => {
  it("loads server authority, saves with expected revisions, and refreshes cache", async () => {
    const requests: RequestInit[] = []
    globalThis.fetch = async (_url, init = {}) => { requests.push(init); return Response.json(state) }
    const cache = new MemoryStorage()
    const store = new ApiStore(cache, "http://hub")
    assert.equal((await store.load())?.workspaces[0].revision, 3)
    await store.save(state)
    const payload = JSON.parse(String(requests[1].body)) as { expectedRevisions: Record<string, number> }
    assert.deepEqual(payload.expectedRevisions, { w: 3 })
    assert.equal((await store.loadBackup())?.activeWorkspaceId, "w")
  })

  it("uses cache only for reads when the server is unavailable", async () => {
    const cache = new MemoryStorage()
    const statuses: string[] = []
    globalThis.fetch = async () => Response.json(state)
    const store = new ApiStore(cache, "http://hub", status => statuses.push(status))
    await store.load()
    assert.equal(statuses.at(-1), "online")
    globalThis.fetch = async () => { throw new Error("offline") }
    assert.equal((await store.load())?.activeWorkspaceId, "w")
    assert.equal(statuses.at(-1), "offline-cache")
    await assert.rejects(store.save(state), /read-only/)
    globalThis.fetch = async () => Response.json({ ...state, savedAt: 2 })
    assert.equal((await store.load())?.savedAt, 2)
    assert.equal(statuses.at(-1), "online")
  })

  it("exposes typed authentication and conflict failures", async () => {
    globalThis.fetch = async () => Response.json({ error: "auth" }, { status: 401 })
    await assert.rejects(new ApiStore(undefined, "http://hub").load(), ApiStoreAuthenticationError)
    globalThis.fetch = async () => Response.json({ error: "changed", code: "revision_conflict", workspaceId: "w", actualRevision: 4 }, { status: 409 })
    await assert.rejects(new ApiStore(undefined, "http://hub").save(state), ApiStoreConflictError)
  })
})
