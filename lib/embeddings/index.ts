import path from "node:path"
import { embeddingConfig, type EmbeddingProvider, type EmbeddingHealth } from "./provider"
import { OllamaEmbeddingProvider } from "./ollama"
import { EmbeddingCache } from "./cache"
import { cosine } from "./similarity"
export type SemanticSimilarity = (left: string, right: string) => number | undefined
export class SemanticLayer {
  private unavailable = false
  private known = new Map<string, number[]>()
  constructor(private provider: EmbeddingProvider | undefined, private cache: EmbeddingCache) {}
  async vectors(texts: string[]) {
    if (!this.provider) return new Map<string, number[]>()
    if (this.unavailable) return new Map(texts.filter(text => this.known.has(text)).map(text => [text, this.known.get(text)!]))
    const found = await this.cache.embed(texts, this.provider)
    for (const [text, vector] of found) this.known.set(text, vector)
    if (found.size < new Set(texts).size) this.unavailable = true
    return found
  }
  async similarity(texts: string[]): Promise<SemanticSimilarity | undefined> {
    const vectors = await this.vectors(texts)
    if (!vectors.size) return undefined
    return (left, right) => cosine(vectors.get(left), vectors.get(right))
  }
}
export function createSemanticLayer(root = process.env.NODEPAD_DATA_DIR || path.join(process.cwd(), "data"), fetchImpl: typeof fetch = fetch) {
  const config = embeddingConfig()
  const provider = config.enabled && config.provider === "ollama" ? new OllamaEmbeddingProvider(config.url, config.model, fetchImpl, config.timeout) : undefined
  return new SemanticLayer(provider, new EmbeddingCache(root, config.provider, config.model, config.url))
}
export async function embeddingHealth(fetchImpl: typeof fetch = fetch): Promise<EmbeddingHealth> {
  const config = embeddingConfig()
  const base = { enabled: config.enabled, provider: config.provider, model: config.model }
  if (!config.enabled) return { ...base, status: "disabled" }
  if (config.provider !== "ollama" || !config.url || !config.model) return { ...base, status: "not_configured" }
  return new OllamaEmbeddingProvider(config.url, config.model, fetchImpl, config.timeout).health()
}
