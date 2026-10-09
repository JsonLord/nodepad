import { NextRequest, NextResponse } from "next/server"
import { clientIp, clearSuccessfulLoginAttempt, createSession, isSameOrigin, loginRetryAfter, recordLoginFailure, SESSION_COOKIE, sessionCookieOptions, timingSafeMatch } from "@/lib/auth/server"

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return NextResponse.json({ error: "JSON required" }, { status: 415 })
  if (!process.env.NODEPAD_LOGIN_KEY) return NextResponse.json({ error: "Browser login is not configured. Set NODEPAD_LOGIN_KEY in deployment secrets." }, { status: 503 })
  const ip = clientIp(req)
  const retryAfter = loginRetryAfter(ip)
  if (retryAfter) return NextResponse.json({ error: "Too many login attempts. Please try again later." }, { status: 429, headers: { "Retry-After": String(retryAfter) } })
  // Reserve a limiter slot before awaiting the body, so concurrent failures cannot bypass it.
  recordLoginFailure(ip)
  let accessKey: unknown
  try {
    const reader = req.body?.getReader()
    if (!reader) throw new Error("Missing body")
    const chunks: Uint8Array[] = []
    let length = 0
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > 4096) { await reader.cancel(); throw new Error("Request too large") }
      chunks.push(value)
    }
    accessKey = JSON.parse(Buffer.concat(chunks).toString("utf8")).accessKey
  } catch { accessKey = undefined }
  if (typeof accessKey !== "string" || !timingSafeMatch(accessKey, process.env.NODEPAD_LOGIN_KEY)) {
    return NextResponse.json({ error: "Invalid access key." }, { status: 401 })
  }
  try {
    const token = createSession()
    clearSuccessfulLoginAttempt(ip)
    const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } })
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())
    return response
  } catch {
    return NextResponse.json({ error: "Unable to create a session. Please retry." }, { status: 503 })
  }
}
