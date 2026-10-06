import type { EvidenceRecord, HypothesisProposal, SynthesisResult, Workspace } from "../domain/types"
import { contentHash, stableId } from "../domain/id"
import { getSynthesisDefinition } from "./registry"
import { selectSynthesisContext, type SynthesisScope } from "./context"
import { runFamily } from "./families"

export interface GeneratedSynthesis extends Partial<SynthesisResult> { hypotheses?: HypothesisProposal[] }
export interface StructuredSynthesisGenerator {
  generate(input: { definition: NonNullable<ReturnType<typeof getSynthesisDefinition>>; evidence: EvidenceRecord[] }): Promise<GeneratedSynthesis>
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
  generator: StructuredSynthesisGenerator = new DeterministicSynthesisGenerator(), scope: SynthesisScope = {}): Promise<SynthesisExecution> {
  const definition = getSynthesisDefinition(type)
  if (!definition) throw new Error(`Unknown synthesis ${type}`)
  const selected = selectSynthesisContext(workspace, scope)
  const evidence = selected.evidence
  if (evidence.length < definition.minEvidence) throw new Error(`${type} needs ${definition.minEvidence} evidence record(s)`)
  const inputHash = contentHash({ type, evidence: evidence.map(item => ({
    id: item.id, claim: item.claim, strength: item.strength, weight: item.weight, stale: item.stale,
  })), supports: selected.supportIds, contradicts: selected.contradictionIds })
  const existing = workspace.syntheses.find(item => item.synthesisType === type && item.inputHash === inputHash)
  if (existing) return { result: existing, proposals: [], reused: true }
  let generated = await generator.generate({ definition, evidence })
  if (generator instanceof DeterministicSynthesisGenerator) { const family = runFamily(definition, evidence, selected.supportIds, selected.contradictionIds); generated = { ...generated, ...family } }
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
    runId, inputHash, status: contradicts.length ? "contested" : "supported",
    provenance: { origin: "ai", actorId: "synthesis-runner", runId, createdAt: at, explanation: `Executed registry definition ${type}` },
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
