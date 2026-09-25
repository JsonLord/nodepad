import { NextRequest, NextResponse } from "next/server"
import { HUB_SESSION_COOKIE, sessionValue, tokenMatches } from "../../../../lib/server/auth"
import { hubError, readLimitedJson, validateMutationOrigin } from "../../../../lib/server/http"
import { logHub } from "../../../../lib/server/log"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const originError = validateMutationOrigin(request)
  if (originError) return originError
  let token = ""
  try { token = String(((await readLimitedJson(request)) as { token?: unknown }).token ?? "") } catch { return hubError("INVALID_PAYLOAD", "Invalid authentication request", 400) }
  let valid = false
  try { valid = Boolean(token) && tokenMatches(token) } catch (error) {
    logHub("hub_request_error", { message: error instanceof Error ? error.message : "authentication configuration error" })
    return hubError("INTERNAL_ERROR", "Hub authentication is not configured", 500)
  }
  if (!valid) {
    logHub("hub_auth_failed")
    return hubError("INVALID_AUTH", "Invalid credentials", 401)
  }
  const response = NextResponse.json({ authenticated: true })
  response.cookies.set(HUB_SESSION_COOKIE, sessionValue(), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production" || process.env.NODEPAD_COOKIE_SECURE === "true", path: "/" })
  return response
}

export function DELETE(request: NextRequest) {
  const originError = validateMutationOrigin(request)
  if (originError) return originError
  const response = NextResponse.json({ authenticated: false })
  response.cookies.set(HUB_SESSION_COOKIE, "", { httpOnly: true, expires: new Date(0), path: "/" })
  return response
}
