import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { Workspace } from "../domain/types"
import type { NodepadStore } from "../persistence/store"
import { restoreSerialized, serializeWorkspace, snapshotContainsSecrets, type SerializedWorkspace } from "./serialization"
const exec = promisify(execFile)

export interface PushResult { commitSha: string; skipped?: boolean; conflict?: boolean; status?: "completed" | "clean" | "sync_conflict" }
export interface BackupRemote { status(): Promise<{ configured: boolean; detail: string }>; pushWorkspace(snapshot: SerializedWorkspace): Promise<PushResult>; listSnapshots(workspaceId: string): Promise<{ ref: string }[]>; restoreWorkspace(workspaceId: string, ref: string): Promise<SerializedWorkspace> }

export class LocalGitBackup implements BackupRemote {
  constructor(private repo = process.env.NODEPAD_BACKUP_REPO || path.join(process.cwd(), "data", "backups"), private base = process.env.NODEPAD_GITHUB_PATH || "nodepad-workspaces") {}
  async status() { return { configured: true, detail: this.repo } }
  async pushWorkspace(snapshot: SerializedWorkspace): Promise<PushResult> {
    await mkdir(this.repo, { recursive: true }); try { await exec("git", ["init", "-q"], { cwd: this.repo }) } catch {}
    const root = path.join(this.repo, this.base, snapshot.workspaceId); await rm(root, { recursive: true, force: true })
    for (const [name, value] of Object.entries(snapshot.files)) { const file = path.join(root, name); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, value) }
    await exec("git", ["add", "--", this.base], { cwd: this.repo })
    const dirty = await exec("git", ["diff", "--cached", "--quiet"], { cwd: this.repo }).then(() => false).catch(() => true)
    if (!dirty) return { commitSha: (await exec("git", ["rev-parse", "HEAD"], { cwd: this.repo })).stdout.trim(), skipped: true, status: "clean" }
    await exec("git", ["-c", "user.name=Nodepad", "-c", "user.email=nodepad@localhost", "commit", "-m", `nodepad(${snapshot.workspaceId}): backup`], { cwd: this.repo })
    return { commitSha: (await exec("git", ["rev-parse", "HEAD"], { cwd: this.repo })).stdout.trim(), status: "completed" }
  }
  async listSnapshots() { try { return (await exec("git", ["log", "--format=%H"], { cwd: this.repo })).stdout.trim().split("\n").filter(Boolean).map(ref => ({ ref })) } catch { return [] } }
  async restoreWorkspace(id: string, ref: string): Promise<SerializedWorkspace> { const files = (await exec("git", ["ls-tree", "-r", "--name-only", ref, "--", `${this.base}/${id}`], { cwd: this.repo })).stdout.trim().split("\n").filter(Boolean); const output: Record<string, string> = {}; for (const file of files) output[path.relative(path.join(this.base, id), file)] = (await exec("git", ["show", `${ref}:${file}`], { cwd: this.repo, maxBuffer: 20_000_000 })).stdout; return { workspaceId: id, schemaVersion: 1, files: output } }
}

interface GitHubOptions { token: string; repository: string; branch: string; basePath: string; allowCreateBranch?: boolean; fetchImpl?: typeof fetch }
export class GitHubBackupRemote implements BackupRemote {
  private fetchImpl: typeof fetch
  constructor(private options: GitHubOptions) { this.fetchImpl = options.fetchImpl ?? fetch }
  static fromEnv(fetchImpl?: typeof fetch) {
    const token = process.env.NODEPAD_GITHUB_TOKEN, repository = process.env.NODEPAD_GITHUB_REPOSITORY
    if (!token || !repository) throw new Error("NODEPAD_GITHUB_TOKEN and NODEPAD_GITHUB_REPOSITORY are required")
    return new GitHubBackupRemote({ token, repository, branch: process.env.NODEPAD_GITHUB_BRANCH || "nodepad-backup", basePath: process.env.NODEPAD_GITHUB_PATH || "nodepad-workspaces", allowCreateBranch: process.env.NODEPAD_GITHUB_CREATE_BRANCH !== "false", fetchImpl })
  }
  private async request(route: string, init: RequestInit = {}, allow404 = false): Promise<any> {
    const response = await this.fetchImpl(`https://api.github.com/repos/${this.options.repository}${route}`, { ...init, headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${this.options.token}`, "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", ...init.headers } })
    if (allow404 && response.status === 404) return null
    if (!response.ok) { const body = await response.text(); const error = new Error(`GitHub ${response.status}: ${body}`) as Error & { status?: number }; error.status = response.status; throw error }
    return response.status === 204 ? null : response.json()
  }
  async status() { return { configured: Boolean(this.options.token && this.options.repository), detail: `${this.options.repository}#${this.options.branch}` } }
  private async branchHead() { const ref = await this.request(`/git/ref/heads/${encodeURIComponent(this.options.branch)}`, {}, true); return ref?.object?.sha as string | undefined }
  private async baseHead() { const repository = await this.request(""); const ref = await this.request(`/git/ref/heads/${encodeURIComponent(repository.default_branch)}`); return ref.object.sha as string }
  async pushWorkspace(snapshot: SerializedWorkspace): Promise<PushResult> {
    if (snapshotContainsSecrets(snapshot)) throw new Error("Snapshot contains secret-like content")
    const expectedHead = await this.branchHead(), branchMissing = !expectedHead
    if (branchMissing && this.options.allowCreateBranch === false) throw new Error(`Backup branch ${this.options.branch} does not exist`)
    const parent = expectedHead ?? await this.baseHead(), parentCommit = await this.request(`/git/commits/${parent}`)
    const prefix = `${this.options.basePath}/${snapshot.workspaceId}/`
    const entries: Array<{ path: string; mode: string; type: string; sha: string | null }> = await Promise.all(Object.entries(snapshot.files).sort(([a], [b]) => a.localeCompare(b)).map(async ([name, content]) => {
      const blob = await this.request("/git/blobs", { method: "POST", body: JSON.stringify({ content, encoding: "utf-8" }) })
      return { path: `${prefix}${name}`, mode: "100644", type: "blob", sha: blob.sha }
    }))
    const parentTree = await this.request(`/git/trees/${parentCommit.tree.sha}?recursive=1`)
    const desired = new Set(entries.map(entry => entry.path))
    for (const previous of parentTree.tree.filter((entry: any) => entry.type === "blob" && entry.path.startsWith(prefix))) {
      if (!desired.has(previous.path)) entries.push({ path: previous.path, mode: "100644", type: "blob", sha: null })
    }
    const tree = await this.request("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree: entries }) })
    if (tree.sha === parentCommit.tree.sha) return { commitSha: parent, skipped: true, status: "clean" }
    const commit = await this.request("/git/commits", { method: "POST", body: JSON.stringify({ message: `nodepad(${snapshot.workspaceId}): backup`, tree: tree.sha, parents: [parent] }) })
    const currentHead = await this.branchHead()
    if ((!branchMissing && currentHead !== expectedHead) || (branchMissing && currentHead)) return { commitSha: currentHead ?? parent, conflict: true, status: "sync_conflict" }
    try {
      if (branchMissing) await this.request("/git/refs", { method: "POST", body: JSON.stringify({ ref: `refs/heads/${this.options.branch}`, sha: commit.sha }) })
      else await this.request(`/git/refs/heads/${encodeURIComponent(this.options.branch)}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) })
    } catch (error) {
      if ((error as Error & { status?: number }).status === 409 || (error as Error & { status?: number }).status === 422) return { commitSha: expectedHead ?? parent, conflict: true, status: "sync_conflict" }
      throw error
    }
    return { commitSha: commit.sha, status: "completed" }
  }
  async listSnapshots(workspaceId: string) { const commits = await this.request(`/commits?sha=${encodeURIComponent(this.options.branch)}&path=${encodeURIComponent(`${this.options.basePath}/${workspaceId}`)}&per_page=100`, {}, true); return (commits ?? []).map((commit: any) => ({ ref: commit.sha })) }
  async restoreWorkspace(workspaceId: string, ref: string): Promise<SerializedWorkspace> {
    const commit = await this.request(`/git/commits/${encodeURIComponent(ref)}`), tree = await this.request(`/git/trees/${commit.tree.sha}?recursive=1`)
    const prefix = `${this.options.basePath}/${workspaceId}/`, files: Record<string, string> = {}
    for (const entry of tree.tree.filter((item: any) => item.type === "blob" && item.path.startsWith(prefix))) { const blob = await this.request(`/git/blobs/${entry.sha}`); files[entry.path.slice(prefix.length)] = Buffer.from(blob.content.replace(/\n/g, ""), blob.encoding === "base64" ? "base64" : "utf8").toString("utf8") }
    return { workspaceId, schemaVersion: 1, files }
  }
}

export const configuredBackupRemote = () => process.env.NODEPAD_GITHUB_TOKEN && process.env.NODEPAD_GITHUB_REPOSITORY ? GitHubBackupRemote.fromEnv() : new LocalGitBackup()
export async function backupWorkspace(workspace: Workspace, remote: BackupRemote = configuredBackupRemote()) { const minimum = Number(process.env.NODEPAD_GITHUB_MIN_COMMIT_INTERVAL_SECONDS ?? 600) * 1000; if (workspace.backup?.lastBackupAt && Date.now() - Date.parse(workspace.backup.lastBackupAt) < minimum) return { commitSha: workspace.backup.lastCommitSha ?? "debounced", skipped: true, status: "clean" as const }; return remote.pushWorkspace(serializeWorkspace(workspace)) }
export async function stageRestore(store: NodepadStore, remote: BackupRemote, id: string, ref: string, newId = `${id}-restored-${Date.now()}`) { const snapshot = await remote.restoreWorkspace(id, ref); const staged = restoreSerialized(snapshot, newId); await store.saveWorkspace(staged); return staged }
