/** Automaker-style server sessions. Never import this module into client components. */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs"
import { isIP } from "node:net"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"

export const SESSION_COOKIE = "nodepad_session"
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60

export function timingSafeMatch(actual: string, expected: string | undefined): boolean {
  if (!expected) return false
  return timingSafeEqual(createHash("sha256").update(actual).digest(), createHash("sha256").update(expected).digest())
}

export function sessionCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: SESSION_MAX_AGE }
}

const authDirectory = () => process.env.NODEPAD_AUTH_DIR || path.join(process.env.NODEPAD_DATA_DIR || path.join(process.cwd(), "data"), ".auth")
function sessionFile(token: string): string | null {
  if (!process.env.NODEPAD_LOGIN_KEY || !/^[a-f0-9]{64}$/.test(token)) return null
  // Token filenames are keyed hashes: rotating the human key invalidates old sessions.
  const digest = createHmac("sha256", process.env.NODEPAD_LOGIN_KEY).update(token).digest("hex")
  return path.join(authDirectory(), `${digest}.session`)
}

export function createSession(now = Date.now()): string {
  const token = randomBytes(32).toString("hex")
  const file = sessionFile(token)
  if (!file) throw new Error("Browser login is not configured")
  mkdirSync(authDirectory(), { recursive: true, mode: 0o700 })
  // Keep expired session files from accumulating; the store is separate from workspaces/backups.
  for (const name of readdirSync(authDirectory())) {
    if (!/^[a-f0-9]{64}\.session$/.test(name)) continue
    const expiredFile = path.join(authDirectory(), name)
    try { if (JSON.parse(readFileSync(expiredFile, "utf8")).expiresAt <= now) unlinkSync(expiredFile) } catch { /* Fail closed on unreadable sessions. */ }
  }
  const temp = `${file}.${process.pid}.tmp`
  writeFileSync(temp, JSON.stringify({ expiresAt: now + SESSION_MAX_AGE * 1000 }), { mode: 0o600, flag: "wx" })
  renameSync(temp, file)
  return token
}

export function validateSession(token: string, now = Date.now()): boolean {
  const file = sessionFile(token)
  if (!file) return false
  try {
    const { expiresAt } = JSON.parse(readFileSync(file, "utf8"))
    return typeof expiresAt === "number" && expiresAt > now && expiresAt <= now + SESSION_MAX_AGE * 1000
  } catch { return false }
}

export function invalidateSession(token: string) {
  const file = sessionFile(token)
  if (!file) return
  try { unlinkSync(file) } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
}

export function hasMachineAuth(req: NextRequest): boolean {
  const header = req.headers.get("authorization") || ""
  return header.startsWith("Bearer ") && timingSafeMatch(header.slice(7), process.env.NODEPAD_API_KEY)
}

export function isAuthenticated(req: NextRequest): boolean {
  return hasMachineAuth(req) || validateSession(req.cookies.get(SESSION_COOKIE)?.value || "")
}

/** Same-origin checks for cookie-authenticated mutations; bearer clients are exempt. */
export function isSameOrigin(req: NextRequest): boolean {
  if (req.headers.get("sec-fetch-site") === "cross-site") return false
  const origin = req.headers.get("origin")
  if (!origin) return true
  try { return new URL(origin).origin === req.nextUrl.origin } catch { return false }
}

export function requireAuth(req: NextRequest): NextResponse | null {
  if (!isAuthenticated(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !hasMachineAuth(req) && !isSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

const attempts = new Map<string, { count: number; start: number }>()
export function clientIp(req: NextRequest): string {
  // Only opt in behind a trusted single proxy that appends/overwrites X-Forwarded-For.
  // Rightmost hop avoids trusting a client-supplied prefix. No proxy trust: shared bucket.
  const candidate = process.env.NODEPAD_TRUST_PROXY === "true" ? req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() : undefined
  return candidate && isIP(candidate) ? candidate : "unknown"
}
export function loginRetryAfter(ip: string, now = Date.now()): number {
  for (const [key, value] of attempts) if (now - value.start >= 60_000) attempts.delete(key)
  const key = attempts.has(ip) || attempts.size < 10_000 ? ip : "unknown"
  const entry = attempts.get(key)
  return entry && entry.count >= 5 ? Math.ceil((60_000 - (now - entry.start)) / 1000) : 0
}
export function recordLoginFailure(ip: string, now = Date.now()) {
  const entry = attempts.get(ip)
  if (entry && now - entry.start < 60_000) entry.count++
  else {
    // Bound memory; new identities share a bucket if the limiter is saturated.
    const key = attempts.size < 10_000 ? ip : "unknown"
    const fallback = attempts.get(key)
    attempts.set(key, { count: (fallback?.count || 0) + 1, start: fallback?.start || now })
  }
}

export function clearSuccessfulLoginAttempt(ip: string) {
  const key = attempts.has(ip) ? ip : "unknown"
  const entry = attempts.get(key)
  if (entry) entry.count = Math.max(0, entry.count - 1)
}
