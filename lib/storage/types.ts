import type { Workspace } from "../domain/workspace"

export const STORAGE_SCHEMA_VERSION = 2 as const

export interface CanonicalProjectState {
  version: typeof STORAGE_SCHEMA_VERSION
  activeWorkspaceId: string
  workspaces: Workspace[]
  savedAt: number
}

export interface ProjectStore {
  load(): Promise<CanonicalProjectState | null>
  loadBackup(): Promise<CanonicalProjectState | null>
  save(state: CanonicalProjectState): Promise<void>
}
