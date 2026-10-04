import type { EvidenceRecord, HypothesisQualification, HypothesisRecord } from "../domain/types"

export const qualificationForScore = (score: number): HypothesisQualification => {
  if (score <= -80) return "strongly_disqualified"
  if (score <= -55) return "disqualified"
  if (score <= -30) return "leaning_disqualified"
  if (score <= -10) return "weakly_disfavored"
  if (score <= 9) return "unresolved"
  if (score <= 29) return "weak_signal"
  if (score <= 49) return "potentially_qualified"
  if (score <= 69) return "provisionally_qualified"
  if (score <= 89) return "qualified"
  return "strongly_qualified"
}

function value(e: EvidenceRecord, now: number) {
  const age = e.recencyDays ?? Math.max(0, (now - Date.parse(e.observedAt ?? e.ingestedAt)) / 86400000)
  const freshness = e.stale ? .25 : Math.max(.25, Math.exp(-age / 365))
  const kind = e.evidenceType === "behavioral" ? 1.3 : e.evidenceType === "measured" ? 1.4 : e.evidenceType === "synthetic" ? .25 : 1
  return e.strength * Math.max(.1, e.weight) * freshness * kind * (e.firstParty ? 1.2 : 1) * (e.reliability ?? 1)
}

export function scoreHypothesis(h: HypothesisRecord, all: EvidenceRecord[], now = Date.now()): HypothesisRecord {
  const byId = new Map(all.map(e => [e.id, e]))
  const supports = h.supportingEvidence.map(id => byId.get(id)).filter(Boolean) as EvidenceRecord[]
  const contradicts = h.contradictingEvidence.map(id => byId.get(id)).filter(Boolean) as EvidenceRecord[]
  const positive = supports.reduce((n,e) => n + value(e, now), 0)
  const negative = contradicts.reduce((n,e) => n + value(e, now), 0)
  const magnitude = positive + negative
  const score = magnitude ? Math.round(Math.max(-100, Math.min(100, ((positive - negative) / Math.max(5, magnitude)) * 100))) : 0
  const sources = new Set([...supports, ...contradicts].map(e => e.sourceId ?? e.sourceType))
  const sourceTypes = new Set([...supports, ...contradicts].map(e => e.sourceType))
  const confidence = Math.round(Math.min(100, magnitude * 7 + sources.size * 5))
  const overlays = h.overlays.filter(o => !["unresearched", "contested", "stale"].includes(o))
  if (!magnitude) overlays.push("unresearched")
  if (positive >= 4 && negative >= 4) overlays.push("contested")
  const stale = [...supports, ...contradicts].length > 0 && [...supports, ...contradicts].every(e => e.stale)
  if (stale) overlays.push("stale")
  const freshnessScore = magnitude ? Math.round([...supports,...contradicts].reduce((n,e)=>n+(e.stale?0:100),0)/([...supports,...contradicts].length)) : 0
  return { ...h, evidenceScore: score, confidence, qualification: qualificationForScore(score), overlays, sourceDiversity: sourceTypes.size, firstPartyWeight: [...supports,...contradicts].filter(e=>e.firstParty).reduce((n,e)=>n+e.weight,0), behavioralWeight: [...supports,...contradicts].filter(e=>e.evidenceType==="behavioral").reduce((n,e)=>n+e.weight,0), freshnessScore, lastEvaluatedAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() }
}

export const canPromote = (h: HypothesisRecord) => ["qualified","strongly_qualified"].includes(h.qualification) && h.confidence >= 70 && h.sourceDiversity >= 2 && !h.overlays.some(x => x === "contested" || x === "stale")
