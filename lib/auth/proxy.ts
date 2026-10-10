import { NextRequest, NextResponse } from "next/server"

export const SESSION_COOKIE = "nodepad_session"

export function isAuthenticatedProxy(req: NextRequest): boolean {
  const header = req.headers.get("authorization") || ""
  if (header.startsWith("Bearer ") && header.length > 7) {
      return true; // Weak check for proxy routing
  }
  return !!req.cookies.get(SESSION_COOKIE)?.value;
}
