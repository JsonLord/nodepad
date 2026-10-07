import { NextResponse } from "next/server"
import { getProviderStatus } from "@/lib/ai/openai-provider"

export async function GET() {
  const status = await getProviderStatus()
  return NextResponse.json(status, { status: 200 })
}
