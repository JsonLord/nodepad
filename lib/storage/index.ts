import { BrowserGraphStore } from "./browser-graph-store"
import { ApiStore } from "./api-store"
import type { ProjectStore } from "./types"
import type { HubStatusListener } from "./hub-status"

export type StorageMode = "browser" | "server"

export function getStorageMode(): StorageMode {
  const mode = process.env.NEXT_PUBLIC_NODEPAD_STORAGE_MODE ?? "browser"
  if (mode !== "browser" && mode !== "server") throw new Error(`Unsupported Nodepad storage mode: ${mode}`)
  return mode
}

/** Explicit persistence composition root. Server mode never silently falls back to browser authority. */
export function createProjectStore(onStatus?: HubStatusListener): ProjectStore & { loadOrMigrate?: BrowserGraphStore["loadOrMigrate"] } {
  return getStorageMode() === "server"
    ? new ApiStore(window.localStorage, "/api/hub", onStatus)
    : new BrowserGraphStore(window.localStorage)
}
