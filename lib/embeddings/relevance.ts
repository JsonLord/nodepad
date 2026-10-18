import { threshold } from "./provider"
import type { SemanticLayer } from "./index"
export async function relevancePrefilter(text: string, hypothesis: string, layer: SemanticLayer) {
  const similarity = await layer.similarity([text, hypothesis])
  const score = similarity?.(text, hypothesis)
  return { score, shouldAdjudicate: score === undefined || score >= threshold("RELEVANCE", .35) }
}
export async function adjudicateRelevant<T>(text: string, hypothesis: string, layer: SemanticLayer, adjudicate: () => T | Promise<T>) {
  const relevance = await relevancePrefilter(text, hypothesis, layer)
  return { ...relevance, result: relevance.shouldAdjudicate ? await adjudicate() : undefined }
}
