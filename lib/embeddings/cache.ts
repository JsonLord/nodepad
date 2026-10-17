import { createHash, randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile, unlink } from "node:fs/promises"
import path from "node:path"
import type { EmbeddingProvider } from "./provider"
import { validVector } from "./similarity"
export class EmbeddingCache {
  constructor(private root: string, readonly provider: string, readonly model: string, private endpoint = "") {}
  key(text: string) { return createHash("sha256").update(JSON.stringify([this.provider, this.model, this.endpoint, createHash("sha256").update(text).digest("hex")])).digest("hex") }
  private file(text: string) { return path.join(this.root, ".embeddings", `${this.key(text)}.json`) }
  async get(text: string): Promise<number[] | undefined> {
    try { const data = JSON.parse(await readFile(this.file(text), "utf8")); return data.key === this.key(text) && validVector(data.vector) ? data.vector : undefined } catch { return undefined }
  }
  async put(text: string, vector: number[]) {
    if (!validVector(vector)) return
    const file = this.file(text), temporary = `${file}.${randomUUID()}.tmp`
    try { await mkdir(path.dirname(file), { recursive: true, mode: 0o700 }); await writeFile(temporary, JSON.stringify({ key: this.key(text), vector }), { mode: 0o600 }); await rename(temporary, file) }
    catch { /* Cache failure cannot disable deterministic processing. */ }
    finally { await unlink(temporary).catch(() => {}) }
  }
  async embed(texts: string[], provider: EmbeddingProvider): Promise<Map<string, number[]>> {
    const unique = [...new Set(texts)], found = new Map<string, number[]>(), missing: string[] = []
    for (const text of unique) { const vector = await this.get(text); if (vector) found.set(text, vector); else missing.push(text) }
    try {
      for (let i = 0; i < missing.length; i += 32) {
        const batch = missing.slice(i, i + 32), vectors = await provider.embed(batch)
        if (vectors.length !== batch.length || !vectors.every(validVector)) break
        await Promise.all(batch.map(async (text, index) => { found.set(text, vectors[index]); await this.put(text, vectors[index]) }))
      }
    } catch { /* Return cached vectors and leave the remainder to lexical fallback. */ }
    // A server/model upgrade may change dimensionality while retaining its model name.
    if (new Set([...found.values()].map(v => v.length)).size > 1) return new Map()
    return found
  }
}
