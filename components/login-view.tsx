"use client"

// Ported from Automaker login-view.tsx (MIT). See docs/AUTOMAKER_LICENSE.txt.
import { useEffect, useReducer } from "react"
import { AlertCircle, KeyRound, LoaderCircle, RefreshCw, ServerCrash } from "lucide-react"

type State =
  | { phase: "checking_server"; attempt: number; generation: number }
  | { phase: "server_error"; message: string }
  | { phase: "awaiting_login"; accessKey: string; error: string | null }
  | { phase: "logging_in"; accessKey: string }
  | { phase: "authenticated" }
type Action =
  | { type: "CHECK_ATTEMPT"; attempt: number }
  | { type: "SERVER_ERROR"; message: string }
  | { type: "AUTH_REQUIRED" }
  | { type: "AUTH_VALID" }
  | { type: "UPDATE_KEY"; value: string }
  | { type: "SUBMIT" }
  | { type: "LOGIN_ERROR"; message: string }
  | { type: "RETRY" }
export function loginReducer(state: State, action: Action): State {
  switch (action.type) {
    case "CHECK_ATTEMPT": return state.phase === "checking_server" ? { ...state, attempt: action.attempt } : state
    case "SERVER_ERROR": return { phase: "server_error", message: action.message }
    case "AUTH_REQUIRED": return { phase: "awaiting_login", accessKey: "", error: null }
    case "AUTH_VALID": return { phase: "authenticated" } // Drop the entered key immediately.
    case "UPDATE_KEY": return state.phase === "awaiting_login" ? { ...state, accessKey: action.value } : state
    case "SUBMIT": return state.phase === "awaiting_login" ? { phase: "logging_in", accessKey: state.accessKey } : state
    case "LOGIN_ERROR": return { phase: "awaiting_login", accessKey: "", error: action.message }
    case "RETRY": return { phase: "checking_server", attempt: 1, generation: Date.now() }
  }
}

export function LoginView() {
  const [state, dispatch] = useReducer(loginReducer, { phase: "checking_server", attempt: 1, generation: 0 })
  const generation = state.phase === "checking_server" ? state.generation : null
  useEffect(() => {
    if (generation === null) return
    const controller = new AbortController()
    async function check() {
      for (let attempt = 1; attempt <= 5; attempt++) {
        if (controller.signal.aborted) return
        dispatch({ type: "CHECK_ATTEMPT", attempt })
        try {
          const response = await fetch("/api/auth/status", { credentials: "same-origin", cache: "no-store",
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) })
          if (!response.ok) throw new Error("Server unavailable")
          const data = await response.json()
          if (!controller.signal.aborted) dispatch({ type: data.authenticated ? "AUTH_VALID" : "AUTH_REQUIRED" })
          return
        } catch {
          if (controller.signal.aborted) return
          if (attempt === 5) {
            dispatch({ type: "SERVER_ERROR", message: "Unable to connect to server. Please check that the server is running." })
            return
          }
          await new Promise(resolve => setTimeout(resolve, 400 * 2 ** (attempt - 1)))
        }
      }
    }
    void check()
    return () => controller.abort()
  }, [generation])

  const loginKey = state.phase === "logging_in" ? state.accessKey : null
  useEffect(() => {
    if (loginKey === null) return
    const controller = new AbortController()
    async function login() {
      try {
        const response = await fetch("/api/auth/login", { method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessKey: loginKey }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) })
        if (!controller.signal.aborted) {
          if (response.ok) dispatch({ type: "AUTH_VALID" })
          else dispatch({ type: "LOGIN_ERROR", message: response.status === 429 ? "Too many login attempts. Please try again later." :
            response.status === 503 ? "Browser login is unavailable. Ask the deployment owner to check NODEPAD_LOGIN_KEY." : "Invalid access key." })
        }
      } catch {
        if (!controller.signal.aborted) dispatch({ type: "LOGIN_ERROR", message: "Failed to connect to server" })
      }
    }
    void login()
    return () => controller.abort()
  }, [loginKey])

  useEffect(() => {
    if (state.phase === "authenticated") window.location.replace("/")
  }, [state.phase])

  const spinner = <LoaderCircle aria-label="Loading" className="h-10 w-10 animate-spin mx-auto text-primary" />
  if (state.phase === "checking_server" || state.phase === "authenticated") return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="text-center space-y-4">{spinner}<p className="text-sm text-muted-foreground">
        {state.phase === "authenticated" ? "Redirecting…" : `Connecting to server${state.attempt > 1 ? ` (attempt ${state.attempt}/5)` : "…"}`}
      </p></div>
    </div>
  )
  if (state.phase === "server_error") return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"><ServerCrash className="h-8 w-8 text-destructive" /></div>
        <div className="space-y-2"><h1 className="text-2xl font-bold tracking-tight">Server Unavailable</h1><p className="text-sm text-muted-foreground">{state.message}</p></div>
        <button onClick={() => dispatch({ type: "RETRY" })} className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium gap-2 hover:bg-accent/10"><RefreshCw className="h-4 w-4" />Retry Connection</button>
      </div>
    </div>
  )
  const isLoggingIn = state.phase === "logging_in"
  const error = state.phase === "awaiting_login" ? state.error : null
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"><KeyRound className="h-8 w-8 text-primary" /></div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">Authentication Required</h1>
          <p className="mt-2 text-sm text-muted-foreground">Enter your Nodepad access key to continue.</p>
        </div>
        <form className="space-y-6" onSubmit={event => { event.preventDefault(); if (state.phase === "awaiting_login" && state.accessKey.trim()) dispatch({ type: "SUBMIT" }) }}>
          <div className="space-y-2">
            <label htmlFor="accessKey" className="text-sm font-medium">Access Key</label>
            <input id="accessKey" type="password" placeholder="Enter access key…" value={state.accessKey}
              onChange={event => dispatch({ type: "UPDATE_KEY", value: event.target.value })} disabled={isLoggingIn} autoFocus autoComplete="off"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono disabled:opacity-50" data-testid="login-access-key-input" />
          </div>
          {error && <div role="alert" className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span></div>}
          <button type="submit" disabled={isLoggingIn || !state.accessKey.trim()} data-testid="login-submit-button"
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none">
            {isLoggingIn ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Authenticating…</> : "Login"}
          </button>
        </form>
        <div className="rounded-lg border bg-muted/50 p-4 text-sm">
          <p className="font-medium">Where to find your access key:</p>
          <p className="mt-2 text-muted-foreground">Ask the owner of this Nodepad deployment for your access key.</p>
        </div>
      </div>
    </div>
  )
}
