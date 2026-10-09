import type { NextRequest } from "next/server"

/** Enforce actual streamed bytes, including requests without Content-Length. */
export async function boundedJson(req: NextRequest, limit = 1_000_000) {
  if (Number(req.headers.get("content-length") || 0) > limit) throw new Error("request_body_too_large")
  const reader = req.body?.getReader()
  if (!reader) return {}
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) { await reader.cancel(); throw new Error("request_body_too_large") }
    chunks.push(value)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) } catch { return {} }
}
