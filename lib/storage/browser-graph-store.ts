import { migrateLegacyBrowserState, type LegacyBrowserSnapshot } from "../migrations/browser-v1-to-v2"
import { isCanonicalProjectState, parseCanonicalProjectState } from "./schema"
import type { CanonicalProjectState, ProjectStore } from "./types"

export const PRIMARY_STORAGE_KEY = "nodepad-v2"
export const BACKUP_STORAGE_KEY = "nodepad-v2-backup"
export const MIGRATION_STORAGE_KEY = "nodepad-v2-migrated"

/** Canonical browser store. Legacy keys are read for migration and never deleted. */
export class BrowserGraphStore implements ProjectStore {
  constructor(private readonly storage: Storage) {}

  async load(): Promise<CanonicalProjectState | null> {
    try {
      return parseCanonicalProjectState(this.storage.getItem(PRIMARY_STORAGE_KEY))
    } catch (error) {
      const backup = await this.loadBackup()
      if (backup) {
        console.info(`Recovered ${backup.workspaces.length} canonical workspaces from backup`)
        return backup
      }
      throw error
    }
  }

  async loadBackup(): Promise<CanonicalProjectState | null> {
    try {
      return parseCanonicalProjectState(this.storage.getItem(BACKUP_STORAGE_KEY))
    } catch {
      return null
    }
  }

  async save(state: CanonicalProjectState): Promise<void> {
    if (!isCanonicalProjectState(state)) throw new Error("Refusing to persist invalid canonical Nodepad state")
    const current = this.storage.getItem(PRIMARY_STORAGE_KEY)
    if (current) {
      try {
        if (parseCanonicalProjectState(current)) this.storage.setItem(BACKUP_STORAGE_KEY, current)
      } catch { /* Preserve the existing last-known-good backup. */ }
    }
    const serialised = JSON.stringify(state)
    this.storage.setItem(PRIMARY_STORAGE_KEY, serialised)
    if (!parseCanonicalProjectState(this.storage.getItem(PRIMARY_STORAGE_KEY))) {
      throw new Error("Canonical Nodepad state failed write verification")
    }
  }

  async loadOrMigrate(): Promise<CanonicalProjectState | null> {
    let canonical: CanonicalProjectState | null = null
    try {
      canonical = await this.load()
    } catch {
      // Both canonical records are unreadable. Legacy keys remain untouched and
      // are still a valid recovery source during the migration release.
    }
    if (canonical) return canonical
    const migrated = migrateLegacyBrowserState(this.readLegacySnapshot())
    if (!migrated) return null
    await this.save(migrated)
    const verified = await this.load()
    if (!verified) throw new Error("Canonical Nodepad migration verification failed")
    this.storage.setItem(MIGRATION_STORAGE_KEY, String(Date.now()))
    const entityCount = verified.workspaces.reduce((sum, workspace) => sum + workspace.entities.length, 0)
    const edgeCount = verified.workspaces.reduce((sum, workspace) => sum + workspace.edges.length, 0)
    console.info(`Migrated ${verified.workspaces.length} workspaces, ${entityCount} entities, ${edgeCount} edges`)
    return verified
  }

  private readLegacySnapshot(): LegacyBrowserSnapshot {
    return {
      projects: this.storage.getItem("nodepad-projects"),
      activeProjectId: this.storage.getItem("nodepad-active-project"),
      backup: this.storage.getItem("nodepad-backup"),
      blocks: this.storage.getItem("nodepad-blocks"),
      collapsedIds: this.storage.getItem("nodepad-collapsed"),
    }
  }
}
