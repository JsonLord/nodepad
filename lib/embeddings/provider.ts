export type EmbeddingStatus = "disabled" | "not_configured" | "available" | "degraded" | "unreachable" | "model_error"
export interface EmbeddingHealth { enabled: boolean; provider: string; model: string; status: EmbeddingStatus }
export interface EmbeddingProvider { embed(texts: string[]): Promise<number[][]>; health(): Promise<EmbeddingHealth> }
export class EmbeddingError extends Error {
  constructor(public status: EmbeddingStatus) { super(`Embedding provider ${status}`) }
}
export function embeddingConfig() {
  return { enabled: process.env.NODEPAD_EMBEDDING_ENABLED === "true", provider: process.env.NODEPAD_EMBEDDING_PROVIDER || "ollama",
    url: process.env.NODEPAD_EMBEDDING_URL ?? "http://127.0.0.1:11434", model: process.env.NODEPAD_EMBEDDING_MODEL ?? "embeddinggemma2",
    timeout: Math.min(30_000, Math.max(100, Number(process.env.NODEPAD_EMBEDDING_TIMEOUT_MS) || 5000)) }
}
export function threshold(name: string, fallback: number) {
  const raw = process.env[`NODEPAD_EMBEDDING_${name}_THRESHOLD`]
  const number = raw === undefined ? fallback : Number(raw)
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : fallback
}
