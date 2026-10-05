import test from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { GitHubBackupRemote, stageRestore } from "../lib/github-sync/backup"
import { restoreSerialized, serializeWorkspace } from "../lib/github-sync/serialization"
import { FileNodepadStore } from "../lib/persistence/file-store"
import { fixture } from "./helpers"

const sha = (value: unknown) => createHash("sha1").update(JSON.stringify(value)).digest("hex")
class FakeGitHub {
  blobs = new Map<string, string>(); trees = new Map<string, Array<{ path: string; mode: string; type: string; sha: string }>>(); commits = new Map<string, { tree: { sha: string }; parents: string[] }>()
  branch?: string; defaultHead: string; refReads = 0; conflictOnConfirmation = false; commitsForPath: string[] = []
  constructor() { const tree = sha([]); this.trees.set(tree, []); this.defaultHead = sha("base"); this.commits.set(this.defaultHead, { tree: { sha: tree }, parents: [] }) }
  response(status: number, body?: unknown) { return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } }) }
  fetch = async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url), route = url.pathname.replace("/repos/owner/repo", ""), method = init.method ?? "GET"
    const body = init.body ? JSON.parse(String(init.body)) : undefined
    if (route === "" && method === "GET") return this.response(200, { default_branch: "main" })
    if (route === "/git/ref/heads/backup" && method === "GET") { this.refReads++; if (this.conflictOnConfirmation && this.refReads % 2 === 0) this.branch = "external-head"; return this.branch ? this.response(200, { object: { sha: this.branch } }) : this.response(404, {}) }
    if (route === "/git/ref/heads/main") return this.response(200, { object: { sha: this.defaultHead } })
    if (route.startsWith("/git/commits/") && method === "GET") { const id = decodeURIComponent(route.slice("/git/commits/".length)), commit = this.commits.get(id); return commit ? this.response(200, commit) : this.response(404, {}) }
    if (route === "/git/blobs" && method === "POST") { const id = sha(body.content); this.blobs.set(id, body.content); return this.response(201, { sha: id }) }
    if (route.startsWith("/git/blobs/") && method === "GET") { const content = this.blobs.get(route.slice("/git/blobs/".length)); return this.response(200, { content: Buffer.from(content ?? "").toString("base64"), encoding: "base64" }) }
    if (route === "/git/trees" && method === "POST") { const base = [...(this.trees.get(body.base_tree) ?? [])], merged = new Map(base.map(item => [item.path, item])); for (const entry of body.tree) entry.sha === null ? merged.delete(entry.path) : merged.set(entry.path, entry); const entries = [...merged.values()].sort((a, b) => a.path.localeCompare(b.path)); const id = sha(entries); this.trees.set(id, entries); return this.response(201, { sha: id }) }
    if (route.startsWith("/git/trees/") && method === "GET") { const id = route.slice("/git/trees/".length).split("?")[0]; return this.response(200, { sha: id, tree: this.trees.get(id) ?? [] }) }
    if (route === "/git/commits" && method === "POST") { const id = sha(body); this.commits.set(id, { tree: { sha: body.tree }, parents: body.parents }); this.commitsForPath.unshift(id); return this.response(201, { sha: id }) }
    if (route === "/git/refs" && method === "POST") { if (this.branch) return this.response(422, {}); this.branch = body.sha; return this.response(201, { object: { sha: body.sha } }) }
    if (route === "/git/refs/heads/backup" && method === "PATCH") { if (body.force) return this.response(400, {}); this.branch = body.sha; return this.response(200, { object: { sha: body.sha } }) }
    if (route === "/commits" && method === "GET") return this.response(200, this.commitsForPath.map(id => ({ sha: id })))
    return this.response(500, { route, method })
  }
}
const remoteFor = (api: FakeGitHub) => new GitHubBackupRemote({ token: "server-only-token", repository: "owner/repo", branch: "backup", basePath: "nodepad-workspaces", fetchImpl: api.fetch as typeof fetch })

test("GitHub remote creates, skips unchanged, advances, restores and lists snapshots", async () => {
  const api = new FakeGitHub(), remote = remoteFor(api), workspace = fixture(); (workspace as any).configuration = { githubToken: "must-not-upload", cookie: "private" }; const firstSnapshot = serializeWorkspace(workspace)
  const first = await remote.pushWorkspace(firstSnapshot); assert.equal(first.status, "completed"); assert.equal(api.branch, first.commitSha)
  const unchanged = await remote.pushWorkspace(firstSnapshot); assert.equal(unchanged.skipped, true); assert.equal(unchanged.commitSha, first.commitSha)
  workspace.name = "Changed"; const secondSnapshot = serializeWorkspace(workspace), second = await remote.pushWorkspace(secondSnapshot); assert.equal(second.status, "completed"); assert.notEqual(second.commitSha, first.commitSha)
  const restored = await remote.restoreWorkspace(workspace.id, second.commitSha); assert.deepEqual(restored.files, secondSnapshot.files); assert.equal(restoreSerialized(restored).name, "Changed")
  const snapshots = await remote.listSnapshots(workspace.id); assert.ok(snapshots.some((item: { ref: string }) => item.ref === second.commitSha))
  const uploaded = [...api.blobs.values()].join("\n"); assert.equal(uploaded.includes("server-only-token"), false); assert.equal(uploaded.includes("must-not-upload"), false)
})

test("GitHub remote detects branch head movement without force-updating", async () => {
  const api = new FakeGitHub(), remote = remoteFor(api); await remote.pushWorkspace(serializeWorkspace(fixture()))
  const workspace = fixture(); workspace.name = "Conflicting change"; api.conflictOnConfirmation = true; api.refReads = 0
  const result = await remote.pushWorkspace(serializeWorkspace(workspace)); assert.equal(result.conflict, true); assert.equal(result.status, "sync_conflict"); assert.equal(api.branch, "external-head")
})

test("invalid GitHub snapshot is rejected before a staging workspace is saved", async () => {
  const api = new FakeGitHub(), remote = remoteFor(api), snapshot = serializeWorkspace(fixture())
  snapshot.files["schema-version.txt"] = "999\n"
  const pushed = await remote.pushWorkspace(snapshot), directory = await mkdtemp(path.join(tmpdir(), "nodepad-github-restore-"))
  const store = new FileNodepadStore(directory), current = fixture(); await store.saveWorkspace(current)
  await assert.rejects(() => stageRestore(store, remote, current.id, pushed.commitSha, "staging"), /Unsupported snapshot schema/)
  assert.deepEqual((await store.listWorkspaces()).map(workspace => workspace.id), [current.id])
  await rm(directory, { recursive: true, force: true })
})
