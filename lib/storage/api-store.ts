import { isCanonicalProjectState, parseCanonicalProjectState } from "./schema"
import type { CanonicalProjectState, ProjectStore } from "./types"
import type { HubConnectionStatus, HubStatusListener } from "./hub-status"

const CACHE_KEY = "nodepad-server-cache-v2"

export class ApiStoreConflictError extends Error {
  readonly code = "revision_conflict"
  constructor(message: string, public readonly workspaceId?: string, public readonly actualRevision?: number) { super(message) }
}

export class ApiStoreAuthenticationError extends Error {}

/** Server-authoritative store with a read-only last-known-good browser cache. */
export class ApiStore implements ProjectStore {
  private revisions: Record<string, number> = {}
  private status: HubConnectionStatus = "connecting"
  constructor(private readonly cache?: Storage, private readonly baseUrl = "/api/hub", private readonly onStatus?: HubStatusListener) { this.onStatus?.("connecting") }

  private setStatus(status: HubConnectionStatus) { this.status = status; this.onStatus?.(status) }

  async authenticate(token: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/auth`, {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }),
    })
    if (!response.ok) { this.setStatus("authentication-required"); throw new ApiStoreAuthenticationError("Invalid Nodepad server credentials") }
    this.setStatus("connecting")
  }

  async load(): Promise<CanonicalProjectState | null> {
    try {
      const response = await fetch(`${this.baseUrl}/state`, { credentials: "same-origin", cache: "no-store" })
      if (response.status === 401) { this.setStatus("authentication-required"); throw new ApiStoreAuthenticationError("Nodepad server authentication is required") }
      if (!response.ok) throw new Error(`Nodepad Hub load failed (${response.status})`)
      const value: unknown = await response.json()
      if (value === null) { this.setStatus("online"); return null }
      if (!isCanonicalProjectState(value)) throw new Error("Nodepad Hub returned invalid canonical state")
      this.captureRevisions(value)
      this.cache?.setItem(CACHE_KEY, JSON.stringify(value))
      this.setStatus("online")
      return value
    } catch (error) {
      if (error instanceof ApiStoreAuthenticationError) throw error
      const cached = await this.loadBackup()
      if (cached) {
        console.warn("Nodepad Hub unavailable; displaying read-only last-known-good cache")
        this.setStatus("offline-cache"); return cached
      }
      this.setStatus("error")
      throw error
    }
  }

  async loadBackup(): Promise<CanonicalProjectState | null> {
    try { return parseCanonicalProjectState(this.cache?.getItem(CACHE_KEY) ?? null) } catch { return null }
  }

  async save(state: CanonicalProjectState): Promise<void> {
    if (this.status === "offline-cache") throw new Error("Offline cache is read-only")
    const response = await fetch(`${this.baseUrl}/state`, {
      method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, expectedRevisions: this.revisions }),
    })
    const body = await response.json().catch(() => ({})) as Record<string, unknown>
    const structured = body.error as { code?: string; message?: string; details?: Record<string, unknown> } | undefined
    if (response.status === 401) { this.setStatus("authentication-required"); throw new ApiStoreAuthenticationError(structured?.message ?? "Nodepad server authentication is required") }
    if (response.status === 409) { this.setStatus("conflict"); throw new ApiStoreConflictError(structured?.message ?? "This workspace changed elsewhere. Reload before continuing.", typeof structured?.details?.workspaceId === "string" ? structured.details.workspaceId : undefined, typeof structured?.details?.actualRevision === "number" ? structured.details.actualRevision : undefined) }
    if (!response.ok) { this.setStatus("error"); throw new Error(structured?.message ?? `Nodepad Hub save failed (${response.status})`) }
    if (!isCanonicalProjectState(body)) throw new Error("Nodepad Hub returned invalid saved state")
    this.captureRevisions(body)
    this.cache?.setItem(CACHE_KEY, JSON.stringify(body))
    this.setStatus("online")
  }

  private captureRevisions(state: CanonicalProjectState): void {
    this.revisions = Object.fromEntries(state.workspaces.flatMap(workspace =>
      typeof workspace.revision === "number" ? [[workspace.id, workspace.revision]] : [],
    ))
  }
}
