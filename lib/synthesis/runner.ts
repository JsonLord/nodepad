import { createHash } from "node:crypto"
import { routedSynthesisGenerator, synthesisMode, SYNTHESIS_VERSION } from "./llm"
import { roleModel } from "../ai/reasoning"
import type { ReasoningProvenance } from "../domain/types"
import type { EvidenceRecord, HypothesisProposal, SynthesisResult, Workspace } from "../domain/types"
import { stableId } from "../domain/id"
import { getSynthesisDefinition } from "./registry"
import { selectSynthesisContext, type SynthesisScope } from "./context"
import { runFamily } from "./families"

export interface GeneratedSynthesis extends Partial<SynthesisResult> { reasoning?: ReasoningProvenance; hypotheses?: HypothesisProposal[] }
export interface SynthesisGenerationInput { definition: NonNullable<ReturnType<typeof getSynthesisDefinition>>; evidence: EvidenceRecord[]; runId?: string; context?: { family: GeneratedSynthesis; supportIds: string[]; contradictionIds: string[]; themes: {id:string;title:string;memberEvidenceIds:unknown}[]; hypotheses: {id:string;statement:string;supportingEvidence:string[];contradictingEvidence:string[]}[]; unknowns: string[]; semanticContextIds: string[] } }
export interface StructuredSynthesisGenerator {
  generate(input: SynthesisGenerationInput): Promise<GeneratedSynthesis>
}

const TYPE_BY_FAMILY: Record<string, string> = {
  S012: "root_cause", S031: "value_proposition", S038: "differentiation", S051: "pricing",
  S091: "assumption", S121: "cross_cluster", S122: "second_order", S124: "counter_hypothesis",
  S127: "opportunity", S128: "venture", S130: "world_model",
}

export class DeterministicSynthesisGenerator implements StructuredSynthesisGenerator {
  async generate({ definition, evidence }: Parameters<StructuredSynthesisGenerator["generate"]>[0]): Promise<GeneratedSynthesis> {
    const output = runFamily(definition, evidence, [], [])
    return { title: definition.name, statement: output.statement, rationale: output.rationale, unknowns: output.unknowns,
      suggestedResearch: output.suggestedResearch, generationConfidence: Math.min(88, 20 + evidence.length * 5), hypotheses: output.hypotheses }
  }
}

export interface SynthesisExecution { result: SynthesisResult; proposals: HypothesisProposal[]; reused: boolean }
export async function executeSynthesis(workspace: Workspace, type: string, runId: string,
  generator: StructuredSynthesisGenerator | undefined = undefined, scope: SynthesisScope = {}): Promise<SynthesisExecution> {
  const definition = getSynthesisDefinition(type)
  if (!definition) throw new Error(`Unknown synthesis ${type}`)
  const selected = selectSynthesisContext(workspace, scope)
  const evidence = selected.evidence
  if (evidence.length < definition.minEvidence) throw new Error(`${type} needs ${definition.minEvidence} evidence record(s)`)
  const inputHash = createHash("sha256").update(JSON.stringify({ type, routing: [SYNTHESIS_VERSION, synthesisMode(), roleModel("synthesis")], evidence: evidence.map(item => ({
    id: item.id, claim: item.claim, strength: item.strength, weight: item.weight, stale: item.stale,
  })), supports: selected.supportIds, contradicts: selected.contradictionIds })).digest("hex")
  const existing = workspace.syntheses.find(item => item.synthesisType === type && item.inputHash === inputHash)
  if (existing) return { result: existing, proposals: [], reused: true }
  const deterministic = await new DeterministicSynthesisGenerator().generate({ definition, evidence })
  const family = runFamily(definition, evidence, selected.supportIds, selected.contradictionIds)
  let generated: GeneratedSynthesis = { ...deterministic, ...family }
  const allowedIds = new Set(evidence.map(e => e.id))
  const themes = workspace.nodes.filter(n => n.kind === "theme" && Array.isArray(n.metadata.memberEvidenceIds) && n.metadata.memberEvidenceIds.some(id => allowedIds.has(String(id)))).slice(0, 10).map(n => ({ id: n.id, title: n.title.slice(0,200), memberEvidenceIds: (n.metadata.memberEvidenceIds as string[]).filter(id => allowedIds.has(id)) }))
  const hypotheses = workspace.hypotheses.filter(h => h.id === scope.hypothesisId || h.derivedFrom.some(id => allowedIds.has(id)) || [...h.supportingEvidence,...h.contradictingEvidence].some(id => allowedIds.has(id))).slice(0,10).map(h => ({id:h.id,statement:h.statement.slice(0,2000),supportingEvidence:h.supportingEvidence.filter(id=>allowedIds.has(id)),contradictingEvidence:h.contradictingEvidence.filter(id=>allowedIds.has(id))}))
  const chosen = generator ?? routedSynthesisGenerator()
  let fallback = false
  if (chosen && !(chosen instanceof DeterministicSynthesisGenerator)) {
    try { generated = await chosen.generate({ definition, evidence, runId, context: { family: generated, supportIds: selected.supportIds, contradictionIds: selected.contradictionIds, themes, hypotheses, unknowns: generated.unknowns || [], semanticContextIds: [...themes.map(t => t.id),...hypotheses.map(h => h.id)] } }) }
    catch { fallback = true }
  }
  // Source derivation never grants validation authority to a newly generated hypothesis.
  generated.hypotheses = (generated.hypotheses || []).map(p => ({ ...p, derivedFrom: p.derivedFrom.filter(id => allowedIds.has(id)), supportingEvidence: [], contradictingEvidence: [] }))
  const at = new Date().toISOString()
  const supports = selected.supportIds
  const contradicts = selected.contradictionIds
  const id = stableId("syn", workspace.id, type, inputHash)
  const result: SynthesisResult = {
    id, synthesisType: type, workspaceId: workspace.id, title: generated.title ?? definition.name,
    statement: generated.statement ?? definition.description, rationale: generated.rationale ?? "",
    derivedFrom: evidence.map(item => item.id), supports, contradicts, unknowns: generated.unknowns ?? [],
    suggestedResearch: generated.suggestedResearch ?? [], generatedHypotheses: [],
    generationConfidence: Math.max(0, Math.min(100, generated.generationConfidence ?? 0)), createdAt: at,
    runId, inputHash, status: contradicts.length ? "contested" : supports.length ? "supported" : "draft_ai",
    provenance: { reasoning: generated.reasoning ?? { provider: "deterministic", model: "", promptVersion: SYNTHESIS_VERSION, schemaVersion: SYNTHESIS_VERSION, runId, createdAt: at, sourceEvidenceIds: evidence.map(e=>e.id), semanticContextIds: [...themes.map(t=>t.id),...hypotheses.map(h=>h.id)], fallback, escalated: false }, origin: generated.reasoning ? "ai" : "system", actorId: "synthesis-runner", runId, createdAt: at, explanation: `Executed registry definition ${type}` },
  }
  workspace.syntheses.push(result)
  workspace.nodes.push({ id, workspaceId: workspace.id, kind: "insight", title: result.title, body: result.statement,
    metadata: { synthesisType: type, inputHash }, provenance: result.provenance, createdAt: at, updatedAt: at, version: 1 })
  return { result, proposals: generated.hypotheses ?? [], reused: false }
}

export async function runSynthesis(workspace: Workspace, type: string, runId: string,
  generator?: StructuredSynthesisGenerator, scope?: SynthesisScope): Promise<SynthesisResult> {
  return (await executeSynthesis(workspace, type, runId, generator, scope)).result
}
