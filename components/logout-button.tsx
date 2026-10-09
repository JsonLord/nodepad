"use client"
import { useState } from "react"
import { LogOut } from "lucide-react"

export function LogoutButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  async function logout() {
    setBusy(true)
    setError(false)
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" })
      if (!response.ok) throw new Error("Logout failed")
      window.location.replace("/login")
    } catch { setError(true); setBusy(false) }
  }
  return <div>
    <button onClick={logout} disabled={busy} className="flex w-full items-center justify-between rounded-sm border border-border px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
      {busy ? "Logging out…" : "Log out"}<LogOut className="h-3 w-3" />
    </button>
    {error && <p role="alert" className="mt-1 text-xs text-destructive">Could not log out. Please retry.</p>}
  </div>
}
