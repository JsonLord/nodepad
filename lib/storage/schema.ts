import { isEdge } from "../domain/edge"
import { isEntity } from "../domain/entity"
import type { Workspace } from "../domain/workspace"
import { STORAGE_SCHEMA_VERSION, type CanonicalProjectState } from "./types"

export function isWorkspace(value: unknown): value is Workspace {
  if (!value || typeof value !== "object") return false
  const workspace = value as Partial<Workspace>
  if (typeof workspace.id !== "string" || typeof workspace.name !== "string" ||
      !Array.isArray(workspace.entities) || !workspace.entities.every(isEntity) ||
      !Array.isArray(workspace.edges) || !workspace.edges.every(isEdge) ||
      !Array.isArray(workspace.collapsedIds) || !workspace.collapsedIds.every(id => typeof id === "string") ||
      !Array.isArray(workspace.ghostNotes) || !workspace.ghostNotes.every(note =>
        Boolean(note) && typeof note.id === "string" && typeof note.text === "string" &&
        typeof note.category === "string" && typeof note.isGenerating === "boolean")) return false
  const ids = new Set(workspace.entities.map(entity => entity.id))
  return ids.size === workspace.entities.length &&
    workspace.edges.every(edge => ids.has(edge.sourceId) && ids.has(edge.targetId))
}

export function isCanonicalProjectState(value: unknown): value is CanonicalProjectState {
  if (!value || typeof value !== "object") return false
  const state = value as Partial<CanonicalProjectState>
  return state.version === STORAGE_SCHEMA_VERSION &&
    typeof state.activeWorkspaceId === "string" && typeof state.savedAt === "number" &&
    Array.isArray(state.workspaces) && state.workspaces.every(isWorkspace) &&
    (state.workspaces.length === 0 || state.workspaces.some(workspace => workspace.id === state.activeWorkspaceId))
}

export function parseCanonicalProjectState(raw: string | null): CanonicalProjectState | null {
  if (!raw) return null
  const value: unknown = JSON.parse(raw)
  if (!isCanonicalProjectState(value)) throw new Error("Invalid canonical Nodepad storage state")
  return value
}
