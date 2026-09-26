import type { DatabaseSync } from "node:sqlite"
import type { Edge } from "../domain/edge"
import type { Entity } from "../domain/entity"
import type { Workspace } from "../domain/workspace"
import { isCanonicalProjectState } from "../storage/schema"
import { STORAGE_SCHEMA_VERSION, type CanonicalProjectState } from "../storage/types"

export class RevisionConflictError extends Error {
  constructor(public readonly workspaceId: string, public readonly expected: number, public readonly actual: number) {
    super(`Workspace ${workspaceId} changed elsewhere (expected revision ${expected}, current revision ${actual})`)
  }
}

const json = (value: unknown) => value === undefined ? null : JSON.stringify(value)
const parse = <T>(value: unknown, fallback: T): T => typeof value === "string" ? JSON.parse(value) as T : fallback

export class WorkspaceRepository {
  constructor(private readonly db: DatabaseSync) {}

  loadState(): CanonicalProjectState | null {
    const workspaceRows = this.db.prepare("SELECT * FROM workspaces ORDER BY rowid").all() as Record<string, unknown>[]
    if (!workspaceRows.length) return null
    const workspaces = workspaceRows.map(row => this.readWorkspace(row))
    const app = this.db.prepare("SELECT active_workspace_id, saved_at FROM app_state WHERE singleton = 1").get() as Record<string, unknown> | undefined
    const requested = typeof app?.active_workspace_id === "string" ? app.active_workspace_id : ""
    return {
      version: STORAGE_SCHEMA_VERSION,
      activeWorkspaceId: workspaces.some(workspace => workspace.id === requested) ? requested : workspaces[0].id,
      workspaces,
      savedAt: typeof app?.saved_at === "number" ? app.saved_at : Date.now(),
    }
  }

  saveState(state: CanonicalProjectState, expectedRevisions?: Record<string, number>): CanonicalProjectState {
    if (!isCanonicalProjectState(state)) throw new Error("Invalid canonical project state")
    this.db.exec("BEGIN IMMEDIATE")
    try {
      const incomingIds = new Set(state.workspaces.map(workspace => workspace.id))
      const existing = this.db.prepare("SELECT id, revision FROM workspaces").all() as { id: string; revision: number }[]
      for (const row of existing) {
        if (!incomingIds.has(row.id)) {
          if (expectedRevisions) this.assertRevision(row.id, expectedRevisions[row.id])
          this.db.prepare("DELETE FROM workspaces WHERE id = ?").run(row.id)
        }
      }
      for (const workspace of state.workspaces) this.replaceWorkspace(workspace, expectedRevisions?.[workspace.id] ?? workspace.revision)
      this.db.prepare(`INSERT INTO app_state(singleton, active_workspace_id, saved_at) VALUES (1, ?, ?)
        ON CONFLICT(singleton) DO UPDATE SET active_workspace_id=excluded.active_workspace_id, saved_at=excluded.saved_at`)
        .run(state.activeWorkspaceId, state.savedAt)
      this.db.exec("COMMIT")
    } catch (error) {
      this.db.exec("ROLLBACK")
      throw error
    }
    return this.loadState()!
  }

  deleteWorkspace(id: string, expectedRevision?: number): void {
    this.db.exec("BEGIN IMMEDIATE")
    try {
      this.assertRevision(id, expectedRevision)
      this.db.prepare("DELETE FROM workspaces WHERE id = ?").run(id)
      this.db.exec("COMMIT")
    } catch (error) { this.db.exec("ROLLBACK"); throw error }
  }

  private replaceWorkspace(workspace: Workspace, expectedRevision?: number): void {
    const current = this.db.prepare("SELECT revision FROM workspaces WHERE id = ?").get(workspace.id) as { revision: number } | undefined
    if (current && expectedRevision !== current.revision) {
      throw new RevisionConflictError(workspace.id, expectedRevision ?? 0, current.revision)
    }
    const revision = current ? current.revision + 1 : 1
    if (current) {
      const incoming = new Set(workspace.entities.map(entity => entity.id))
      const active = this.db.prepare("SELECT payload_json FROM delegations WHERE status NOT IN ('succeeded','failed','cancelled')").all() as { payload_json: string }[]
      for (const row of active) {
        const delegation = JSON.parse(row.payload_json) as { taskEntityId?: string; externalProvider?: string }
        if (delegation.externalProvider === "agtx" && delegation.taskEntityId && !incoming.has(delegation.taskEntityId) && this.db.prepare("SELECT 1 FROM entities WHERE workspace_id=? AND id=?").get(workspace.id, delegation.taskEntityId)) throw new Error("ACTIVE_AGTX_DELEGATION")
      }
    }
    this.db.prepare(`INSERT INTO workspaces(id,name,revision,created_at,updated_at,collapsed_ids_json,ghost_notes_json,last_ghost_texts_json,last_ghost_block_count,last_ghost_timestamp,metadata_json)
      VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,revision=excluded.revision,created_at=excluded.created_at,updated_at=excluded.updated_at,collapsed_ids_json=excluded.collapsed_ids_json,ghost_notes_json=excluded.ghost_notes_json,last_ghost_texts_json=excluded.last_ghost_texts_json,last_ghost_block_count=excluded.last_ghost_block_count,last_ghost_timestamp=excluded.last_ghost_timestamp,metadata_json=excluded.metadata_json`)
      .run(workspace.id, workspace.name, revision, workspace.createdAt ?? null, workspace.updatedAt ?? Date.now(), json(workspace.collapsedIds), json(workspace.ghostNotes), json(workspace.lastGhostTexts), workspace.lastGhostBlockCount ?? null, workspace.lastGhostTimestamp ?? null, "{}")
    this.db.prepare("DELETE FROM edges WHERE workspace_id = ?").run(workspace.id)
    this.db.prepare("DELETE FROM entities WHERE workspace_id = ?").run(workspace.id)
    const entityInsert = this.db.prepare(`INSERT INTO entities(id,workspace_id,type,title,body,status,priority,created_at,updated_at,due_at,scheduled_start,scheduled_end,source,source_id,source_url,metadata_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    for (const e of workspace.entities) entityInsert.run(e.id, workspace.id, e.type, e.title, e.body ?? null, e.status ?? null, e.priority ?? null, e.createdAt, e.updatedAt, e.dueAt ?? null, e.scheduledStart ?? null, e.scheduledEnd ?? null, e.source ?? null, e.sourceId ?? null, e.sourceUrl ?? null, json(e.metadata))
    const edgeInsert = this.db.prepare(`INSERT INTO edges(id,workspace_id,source_id,target_id,type,origin,confidence,explanation,created_at,updated_at,metadata_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    for (const e of workspace.edges) edgeInsert.run(e.id, workspace.id, e.sourceId, e.targetId, e.type, e.origin, e.confidence ?? null, e.explanation ?? null, e.createdAt, e.updatedAt, json(e.metadata))
  }

  private assertRevision(id: string, expected?: number): void {
    const row = this.db.prepare("SELECT revision FROM workspaces WHERE id = ?").get(id) as { revision: number } | undefined
    if (!row) return
    if (expected !== row.revision) throw new RevisionConflictError(id, expected ?? 0, row.revision)
  }

  private readWorkspace(row: Record<string, unknown>): Workspace {
    const id = String(row.id)
    const entities = (this.db.prepare("SELECT * FROM entities WHERE workspace_id = ? ORDER BY rowid").all(id) as Record<string, unknown>[]).map(r => ({
      id: String(r.id), type: String(r.type), title: String(r.title), body: r.body ?? undefined, status: r.status ?? undefined,
      priority: r.priority ?? undefined, workspaceId: id, createdAt: Number(r.created_at), updatedAt: Number(r.updated_at),
      dueAt: r.due_at ?? undefined, scheduledStart: r.scheduled_start ?? undefined, scheduledEnd: r.scheduled_end ?? undefined,
      source: r.source ?? undefined, sourceId: r.source_id ?? undefined, sourceUrl: r.source_url ?? undefined,
      metadata: parse(r.metadata_json, undefined),
    })) as Entity[]
    const edges = (this.db.prepare("SELECT * FROM edges WHERE workspace_id = ? ORDER BY rowid").all(id) as Record<string, unknown>[]).map(r => ({
      id: String(r.id), sourceId: String(r.source_id), targetId: String(r.target_id), type: String(r.type), origin: String(r.origin),
      confidence: r.confidence ?? undefined, explanation: r.explanation ?? undefined, createdAt: Number(r.created_at), updatedAt: Number(r.updated_at), metadata: parse(r.metadata_json, undefined),
    })) as Edge[]
    return {
      id, name: String(row.name), revision: Number(row.revision), createdAt: row.created_at == null ? undefined : Number(row.created_at), updatedAt: row.updated_at == null ? undefined : Number(row.updated_at),
      entities, edges, collapsedIds: parse(row.collapsed_ids_json, []), ghostNotes: parse(row.ghost_notes_json, []),
      lastGhostTexts: parse(row.last_ghost_texts_json, undefined), lastGhostBlockCount: row.last_ghost_block_count == null ? undefined : Number(row.last_ghost_block_count), lastGhostTimestamp: row.last_ghost_timestamp == null ? undefined : Number(row.last_ghost_timestamp),
    }
  }
}
