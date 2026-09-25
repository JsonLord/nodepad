import { NextRequest, NextResponse } from "next/server"
import { isHubAuthenticated } from "../../../../lib/server/auth"
export const runtime = "nodejs"
export function GET(request: NextRequest) { return NextResponse.json({ authenticated: isHubAuthenticated(request) }) }
