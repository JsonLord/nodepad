import { NextRequest, NextResponse } from "next/server"
import { isAuthenticated } from "@/lib/auth/server"

export async function GET(req: NextRequest) {
  return NextResponse.json({ authenticated: isAuthenticated(req), required: true }, { headers: { "Cache-Control": "no-store" } })
}
