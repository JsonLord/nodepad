import { EmbeddingError, type EmbeddingHealth, type EmbeddingProvider } from "./provider"
import { validVector } from "./similarity"
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  constructor(readonly url: string, readonly model: string, private fetchImpl: typeof fetch = fetch, private timeout = 5000) {}
  private async request(endpoint: string, options: RequestInit = {}) {
    try {
      let url: URL
      try { url = new URL(this.url) } catch { throw new EmbeddingError("not_configured") }
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || !this.model.trim()) throw new EmbeddingError("not_configured")
      const response = await this.fetchImpl(`${this.url.replace(/\/+$/, "")}${endpoint}`, { ...options, signal: AbortSignal.timeout(this.timeout), redirect: "error" })
      if (!response.ok) throw new EmbeddingError(response.status === 404 || response.status === 400 ? "model_error" : "degraded")
      return await response.json()
    } catch (error) {
      if (error instanceof EmbeddingError) throw error
      throw new EmbeddingError(error instanceof Error && ["AbortError", "TimeoutError", "SyntaxError"].includes(error.name) ? "degraded" : "unreachable")
    }
  }
  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return []
    const data = await this.request("/api/embed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: this.model, input: texts, truncate: false }) })
    if (!Array.isArray(data?.embeddings) || data.embeddings.length !== texts.length || !data.embeddings.every(validVector) || data.embeddings.some((v: number[]) => v.length !== data.embeddings[0].length)) throw new EmbeddingError("degraded")
    return data.embeddings
  }
  async health(): Promise<EmbeddingHealth> {
    const base = { enabled: true, provider: "ollama", model: this.model }
    try {
      const data = await this.request("/api/tags")
      if (!Array.isArray(data?.models)) return { ...base, status: "degraded" }
      const installed = data.models.some((item: {name?: string; model?: string}) => [item.name, item.model].some(name => name === this.model || name === `${this.model}:latest`))
      return { ...base, status: installed ? "available" : "model_error" }
    } catch (error) { return { ...base, status: error instanceof EmbeddingError ? error.status : "unreachable" } }
  }
}
