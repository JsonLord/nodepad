export function validVector(value: unknown): value is number[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 65536 && value.every(n => typeof n === "number" && Number.isFinite(n)) && value.some(n => n !== 0)
}
export function cosine(a?: number[], b?: number[]): number | undefined {
  if (!validVector(a) || !validVector(b) || a.length !== b.length) return undefined
  const scaleA = Math.max(...a.map(Math.abs)), scaleB = Math.max(...b.map(Math.abs))
  const left = a.map(n => n / scaleA), right = b.map(n => n / scaleB)
  return Math.max(-1, Math.min(1, left.reduce((sum, n, i) => sum + n * right[i], 0) / Math.sqrt(left.reduce((sum, n) => sum + n*n, 0) * right.reduce((sum, n) => sum + n*n, 0))))
}
export function centroid(vectors: number[][]): number[] | undefined {
  if (!vectors.length || vectors.some(v => !validVector(v) || v.length !== vectors[0].length)) return undefined
  return vectors[0].map((_, i) => vectors.reduce((sum, v) => sum + v[i] / vectors.length, 0))
}
// Similarity alone cannot distinguish negation. Refuse automatic duplicate merges across this boundary.
export const samePolarity = (a: string, b: string) => /\b(no|not|never|cannot|without)\b|n't\b/i.test(a) === /\b(no|not|never|cannot|without)\b|n't\b/i.test(b)

export const duplicateCompatible = (a: string, b: string) => samePolarity(a, b) && JSON.stringify(a.match(/\d+(?:[.,]\d+)?/g) || []) === JSON.stringify(b.match(/\d+(?:[.,]\d+)?/g) || [])
