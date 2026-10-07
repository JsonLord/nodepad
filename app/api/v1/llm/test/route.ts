import { NextRequest, NextResponse } from "next/server"
import { completeChat } from "@/lib/ai/openai-provider"

const authorized = (r: NextRequest) =>
  !process.env.NODEPAD_API_KEY ||
  r.headers.get("authorization") === `Bearer ${process.env.NODEPAD_API_KEY}`

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const prompt = body.prompt || "Respond only with NODEPAD_LLM_OK"

    const response = await completeChat({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    })

    return NextResponse.json(response, { status: 200 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
