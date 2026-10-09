import { requireAuth } from "@/lib/auth/server"
import { NextRequest, NextResponse } from "next/server"
import { completeChat } from "@/lib/ai/openai-provider"

export async function POST(req: NextRequest) {
  const denied = requireAuth(req)
  if (denied) return denied
  try {
    const body = await req.json()
    const result = await completeChat({ messages: body.messages, model: typeof body.model === "string" ? body.model.trim() : undefined,
      temperature: body.temperature, maxTokens: body.max_tokens })
    return NextResponse.json({ model: result.model, choices: [{ message: { role: "assistant", content: result.content } }] })
  } catch {
    return NextResponse.json({ error: { message: "The configured model provider is unavailable. Check deployment configuration." } }, { status: 502 })
  }
}
