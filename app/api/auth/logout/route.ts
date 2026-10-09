import { NextRequest, NextResponse } from "next/server"
import { invalidateSession, isSameOrigin, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/server"

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  try { invalidateSession(req.cookies.get(SESSION_COOKIE)?.value || "") } catch {
    return NextResponse.json({ error: "Unable to end session. Please retry." }, { status: 503 })
  }
  const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } })
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0, expires: new Date(0) })
  return response
}
