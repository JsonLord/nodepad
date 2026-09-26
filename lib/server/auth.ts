import { createHash, timingSafeEqual } from "node:crypto"
import type { NextRequest } from "next/server"

export const HUB_SESSION_COOKIE = "nodepad_hub_session"

function configuredToken(): string {
  const token = process.env.NODEPAD_API_TOKEN
  if (!token) throw new Error("NODEPAD_API_TOKEN is not configured")
  return token
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest()
}

export function tokenMatches(candidate: string): boolean {
  return timingSafeEqual(digest(candidate), digest(configuredToken()))
}

export function sessionValue(): string {
  return digest(`nodepad-session:${configuredToken()}`).toString("base64url")
}

export function isHubAuthenticated(request: NextRequest): boolean {
  const cookie = request.cookies.get(HUB_SESSION_COOKIE)?.value
  if (!cookie) return false
  return timingSafeEqual(digest(cookie), digest(sessionValue()))
}
