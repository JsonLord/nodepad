import { NextRequest, NextResponse } from "next/server"
import { completeChat } from "@/lib/ai/openai-provider"

export async function POST(req: NextRequest) {
  if (process.env.NODEPAD_API_KEY && req.headers.get("authorization") !== `Bearer ${process.env.NODEPAD_API_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const body = await req.json()
    const result = await completeChat({ messages: body.messages, model: typeof body.model === "string" ? body.model.trim() : undefined,
      temperature: body.temperature, maxTokens: body.max_tokens })
    return NextResponse.json({ model: result.model, choices: [{ message: { role: "assistant", content: result.content } }] })
  } catch {
    return NextResponse.json({ error: { message: "The configured model provider is unavailable. Check deployment configuration." } }, { status: 502 })
  }
}
