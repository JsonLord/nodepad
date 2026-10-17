import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/server"
import { embeddingHealth } from "@/lib/embeddings"
export async function GET(req: NextRequest) {
  const denied = requireAuth(req)
  if (denied) return denied
  return NextResponse.json(await embeddingHealth(), { headers: { "Cache-Control": "no-store" } })
}
