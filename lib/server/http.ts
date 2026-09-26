import { NextRequest, NextResponse } from "next/server"

export type HubErrorCode = "AUTH_REQUIRED" | "INVALID_AUTH" | "INVALID_PAYLOAD" | "REVISION_CONFLICT" | "DATABASE_UNAVAILABLE" | "WORKSPACE_NOT_FOUND" | "INTERNAL_ERROR" | "REQUEST_TOO_LARGE" | "CROSS_ORIGIN_REQUEST" | "AGENT_NOT_FOUND" | "AGENT_DISABLED" | "INVALID_AGENT_CONFIG" | "INVALID_ROUTING_RULE" | "ASSIGNMENT_INVALID" | "NO_ELIGIBLE_AGENT" | "INVALID_DELEGATION_STATE" | "LAYA_NOT_CONFIGURED" | "LAYA_AUTH_FAILED" | "LAYA_UNAVAILABLE" | "LAYA_BUSY" | "LAYA_TIMEOUT" | "LAYA_INVALID_RESPONSE" | "LAYA_MODEL_NOT_FOUND" | "LAYA_RATE_LIMITED" | "AGTX_UNAVAILABLE" | "AGTX_INCOMPATIBLE_VERSION" | "AGTX_EXECUTION_DISABLED" | "AGTX_MAPPING_INVALID" | "AGTX_MAPPING_NOT_FOUND" | "AGTX_ACTION_NOT_ALLOWED" | "AGTX_DISPATCH_PRECONDITION_FAILED" | "EXECUTION_ADAPTER_NOT_ENABLED"

export function hubError(code: HubErrorCode, message: string, status: number, details?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, ...(details && { details }) } }, { status })
}

export function validateMutationOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin")
  if (!origin) return null // Non-browser operators may authenticate with a cookie jar.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "")
  if (!host || new URL(origin).host !== host || new URL(origin).protocol !== `${proto}:`) {
    return hubError("CROSS_ORIGIN_REQUEST", "Cross-origin mutations are not allowed", 403)
  }
  return null
}

export async function readLimitedJson(request: NextRequest): Promise<unknown> {
  const limit = Number(process.env.NODEPAD_MAX_REQUEST_BYTES ?? 25 * 1024 * 1024)
  const declared = Number(request.headers.get("content-length") ?? 0)
  if (declared > limit) throw Object.assign(new Error("Request body exceeds configured limit"), { code: "REQUEST_TOO_LARGE" })
  const text = await request.text()
  if (Buffer.byteLength(text, "utf8") > limit) throw Object.assign(new Error("Request body exceeds configured limit"), { code: "REQUEST_TOO_LARGE" })
  try { return JSON.parse(text) } catch { throw Object.assign(new Error("Request body is not valid JSON"), { code: "INVALID_PAYLOAD" }) }
}
