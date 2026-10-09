import { requireAuth } from "@/lib/auth/server"
import { NextRequest, NextResponse } from "next/server"
import { discoverModels } from "@/lib/ai/openai-provider"

export async function GET(req: NextRequest) {
  const denied = requireAuth(req)
  if (denied) return denied
  return NextResponse.json(await discoverModels(), { headers: { "Cache-Control": "no-store" } })
}
