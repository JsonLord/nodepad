/** Versioned .nodepad import/export for canonical Personal Work Graph workspaces. */
import type { Edge } from "./domain/edge"
import type { Entity } from "./domain/entity"
import type { Workspace } from "./domain/workspace"
import type { ContentType } from "./content-types"
import { isWorkspace } from "./storage/schema"
import { legacyProjectToWorkspace } from "./migrations/browser-v1-to-v2"

export const NODEPAD_FILE_VERSION = 2 as const

export interface NodepadBlock {
  id: string; text: string; timestamp: number; contentType: ContentType
  category?: string; annotation?: string; confidence?: number | null
  sources?: { url: string; title: string; siteName: string }[]
  influencedBy?: string[]; isUnrelated?: boolean; isPinned?: boolean
  subTasks?: { id: string; text: string; isDone: boolean; timestamp: number }[]
}

export interface NodepadV1File {
  version: 1
  exportedAt: number
  project: {
    id: string; name: string; blocks: NodepadBlock[]; collapsedIds: string[]
    ghostNotes: Workspace["ghostNotes"]
    lastGhostTexts?: string[]; lastGhostBlockCount?: number; lastGhostTimestamp?: number
  }
}

export interface NodepadFile {
  version: typeof NODEPAD_FILE_VERSION
  exportedAt: number
  workspace: Workspace
  metadata: Record<string, unknown>
}

function cloneWorkspace(workspace: Workspace): Workspace {
  return JSON.parse(JSON.stringify(workspace)) as Workspace
}

export function serialiseProject(workspace: Workspace): NodepadFile {
  const exported = cloneWorkspace(workspace)
  exported.ghostNotes = exported.ghostNotes.map(note => ({ ...note, isGenerating: false }))
  exported.entities = exported.entities.map(entity => {
    const legacy = entity.metadata?.legacy
    if (!legacy || typeof legacy !== "object") return entity
    const { isEnriching: _isEnriching, isError: _isError, statusText: _statusText, ...stableLegacy } = legacy as Record<string, unknown>
    return { ...entity, metadata: { ...entity.metadata, legacy: stableLegacy } }
  })
  return { version: NODEPAD_FILE_VERSION, exportedAt: Date.now(), workspace: exported, metadata: {} }
}

export function downloadNodepadFile(workspace: Workspace): void {
  const data = serialiseProject(workspace)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  const slug = workspace.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 60)
  a.href = url
  a.download = `${slug || "project"}.nodepad`
  a.click()
  URL.revokeObjectURL(url)
}

export class NodepadParseError extends Error {}

function uniqueName(name: string, existingNames: string[]): string {
  if (!existingNames.includes(name)) return name
  let n = 2
  while (existingNames.includes(`${name} (${n})`)) n++
  return `${name} (${n})`
}

function importId(): string {
  return `import-${Math.random().toString(36).slice(2, 10)}`
}

/** Remap every graph reference under an import namespace, preventing cross-workspace collisions. */
function remapImportedWorkspace(workspace: Workspace, existingNames: string[]): Workspace {
  const workspaceId = importId()
  const idMap = new Map(workspace.entities.map(entity => [entity.id, `${workspaceId}:${entity.id}`]))
  const entities: Entity[] = workspace.entities.map(entity => ({
    ...entity,
    id: idMap.get(entity.id)!,
    workspaceId,
    metadata: entity.metadata ? { ...entity.metadata } : undefined,
  }))
  const edges: Edge[] = workspace.edges.map((edge, index) => ({
    ...edge,
    id: `${workspaceId}:edge:${index}`,
    sourceId: idMap.get(edge.sourceId)!,
    targetId: idMap.get(edge.targetId)!,
  }))
  return {
    ...cloneWorkspace(workspace),
    id: workspaceId,
    name: uniqueName(workspace.name || "Imported Project", existingNames),
    entities,
    edges,
    collapsedIds: workspace.collapsedIds.map(id => idMap.get(id)).filter((id): id is string => Boolean(id)),
  }
}

export function parseNodepadFile(raw: string, existingNames: string[]): Workspace {
  let data: unknown
  try { data = JSON.parse(raw) } catch { throw new NodepadParseError("Not a valid .nodepad file — JSON parse failed.") }
  if (!data || typeof data !== "object") throw new NodepadParseError("Not a valid .nodepad file — unexpected root type.")
  const candidate = data as { version?: number; workspace?: unknown; project?: NodepadV1File["project"] }
  let workspace: Workspace
  if (candidate.version === 2) {
    if (!isWorkspace(candidate.workspace)) throw new NodepadParseError("Not a valid .nodepad v2 file — invalid workspace graph.")
    workspace = candidate.workspace
  } else if ((candidate.version === 1 || candidate.version === undefined) && candidate.project?.blocks) {
    workspace = legacyProjectToWorkspace(candidate.project)
  } else {
    throw new NodepadParseError("Unsupported .nodepad version or missing workspace data.")
  }
  return remapImportedWorkspace(workspace, existingNames)
}
