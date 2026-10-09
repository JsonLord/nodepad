import { requireAuth } from "@/lib/auth/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const denied = requireAuth(req)
  if (denied) return denied
  const envUrl = process.env.OPENAI_URL
  const envModel = process.env.OPENAI_MODEL
  const envApi = process.env.OPENAI_API || ""

  return NextResponse.json({
    hasEnvKey: !!(envUrl && envModel) || !!envApi,
    envModel: envModel || null
  })
}
