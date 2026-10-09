import { NextRequest, NextResponse } from "next/server"
import { discoverModels } from "@/lib/ai/openai-provider"

export async function GET(req: NextRequest) {
  if (process.env.NODEPAD_API_KEY && req.headers.get("authorization") !== `Bearer ${process.env.NODEPAD_API_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.json(await discoverModels(), { headers: { "Cache-Control": "no-store" } })
}
