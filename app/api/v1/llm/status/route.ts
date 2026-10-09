import { requireAuth } from "@/lib/auth/server"
import { NextRequest, NextResponse } from "next/server"
import { getProviderStatus } from "@/lib/ai/openai-provider"

export async function GET(req: NextRequest) {
  const denied = requireAuth(req)
  if (denied) return denied
  const status = await getProviderStatus()
  return NextResponse.json(status, { status: 200 })
}
