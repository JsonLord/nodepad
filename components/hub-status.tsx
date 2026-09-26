"use client"
import type { HubConnectionStatus } from "@/lib/storage/hub-status"

const labels: Record<HubConnectionStatus, string> = {
  browser: "Browser storage", connecting: "Hub connecting", online: "Hub online",
  "offline-cache": "Offline cache — editing disabled", "authentication-required": "Hub authentication required",
  conflict: "Hub conflict — reload required", error: "Hub unavailable",
}

export function HubStatus({ status, onReconnect }: { status: HubConnectionStatus; onReconnect?: () => void }) {
  const warning = status === "offline-cache" || status === "conflict" || status === "error" || status === "authentication-required"
  return <div className={`flex h-6 shrink-0 items-center justify-end gap-2 border-b px-3 font-mono text-[9px] uppercase tracking-wider ${warning ? "border-amber-700/40 bg-amber-950/50 text-amber-300" : "border-border/50 bg-card/30 text-muted-foreground"}`}>
    <span>{status === "online" ? "●" : "○"} {labels[status]}</span>
    {onReconnect && (status === "offline-cache" || status === "conflict" || status === "error") && <button data-hub-action className="underline" onClick={onReconnect}>Reload server version</button>}
  </div>
}
