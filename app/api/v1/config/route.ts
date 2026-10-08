import { NextResponse } from "next/server"

export async function GET() {
  const envUrl = process.env.OPENAI_URL
  const envModel = process.env.OPENAI_MODEL
  const envApi = process.env.OPENAI_API || ""

  return NextResponse.json({
    hasEnvKey: !!(envUrl && envModel) || !!envApi,
    envModel: envModel || null
  })
}
