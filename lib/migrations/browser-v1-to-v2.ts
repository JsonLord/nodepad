import type { Workspace } from "../domain/workspace"
import type { TextBlock } from "../nodepad/legacy-types"
import { blocksToWorkGraph } from "../nodepad/legacy-adapter"
import { STORAGE_SCHEMA_VERSION, type CanonicalProjectState } from "../storage/types"

export interface LegacyBrowserSnapshot {
  projects: string | null
  activeProjectId: string | null
  backup: string | null
  blocks: string | null
  collapsedIds: string | null
}

interface LegacyProject {
  id: string
  name: string
  blocks: TextBlock[]
  collapsedIds?: string[]
  ghostNotes?: Workspace["ghostNotes"]
  lastGhostTexts?: string[]
  lastGhostBlockCount?: number
  lastGhostTimestamp?: number
}

function parseProjects(raw: string | null): LegacyProject[] | null {
  if (!raw) return null
  const value: unknown = JSON.parse(raw)
  if (!Array.isArray(value)) throw new Error("Legacy projects are not an array")
  return value as LegacyProject[]
}

export function legacyProjectToWorkspace(project: LegacyProject): Workspace {
  const graph = blocksToWorkGraph(project.blocks ?? [], project.id)
  return {
    id: project.id,
    name: project.name,
    ...graph,
    collapsedIds: project.collapsedIds ?? [],
    ghostNotes: project.ghostNotes ?? [],
    lastGhostTexts: project.lastGhostTexts,
    lastGhostBlockCount: project.lastGhostBlockCount,
    lastGhostTimestamp: project.lastGhostTimestamp,
  }
}

export function migrateLegacyBrowserState(snapshot: LegacyBrowserSnapshot): CanonicalProjectState | null {
  let projects: LegacyProject[] | null = null
  try { projects = parseProjects(snapshot.projects) } catch { /* Try rollback data. */ }
  if (!projects?.length) {
    try { projects = parseProjects(snapshot.backup) } catch { /* Try oldest format. */ }
  }
  if (!projects?.length && snapshot.blocks) {
    const blocks = JSON.parse(snapshot.blocks) as TextBlock[]
    const collapsedIds = snapshot.collapsedIds ? JSON.parse(snapshot.collapsedIds) as string[] : []
    projects = [{ id: "default", name: "Default Space", blocks, collapsedIds, ghostNotes: [] }]
  }
  if (!projects?.length) return null
  const workspaces = projects.map(legacyProjectToWorkspace)
  const requestedActiveId = snapshot.activeProjectId
  const activeWorkspaceId = requestedActiveId && workspaces.some(workspace => workspace.id === requestedActiveId)
    ? requestedActiveId : workspaces[0].id
  return { version: STORAGE_SCHEMA_VERSION, activeWorkspaceId, workspaces, savedAt: Date.now() }
}
