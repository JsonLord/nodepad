import type { EvidenceRecord, HypothesisProposal, SynthesisResult, Workspace } from "../domain/types"
import { contentHash, stableId } from "../domain/id"
import { getSynthesisDefinition } from "./registry"

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
    const claims = evidence.map(item => item.claim)
    const statement = `${definition.name}: ${claims.slice(0, 3).join("; ")}`
    return {
      title: definition.name,
      statement,
      rationale: `Derived from ${evidence.length} traceable evidence record(s).`,
      unknowns: evidence.length < 2 ? ["Independent corroboration is required."] : [],
      suggestedResearch: [`Seek disconfirming evidence for ${definition.name}.`],
      generationConfidence: Math.min(85, 20 + evidence.length * 12),
      hypotheses: definition.generatesHypotheses ? [{
        statement, title: definition.name, hypothesisType: TYPE_BY_FAMILY[definition.id] ?? definition.category,
        derivedFrom: evidence.map(item => item.id),
        supportingEvidence: evidence.filter(item => item.contradicts.length === 0).map(item => item.id),
        contradictingEvidence: evidence.filter(item => item.contradicts.length > 0).map(item => item.id),
        strategicImportance: definition.priority >= 100 ? 75 : 60, impact: 60, uncertainty: 70,
        rationale: definition.description,
      }] : [],
    }
  }
}

export interface SynthesisExecution { result: SynthesisResult; proposals: HypothesisProposal[]; reused: boolean }
export async function executeSynthesis(workspace: Workspace, type: string, runId: string,
  generator: StructuredSynthesisGenerator = new DeterministicSynthesisGenerator()): Promise<SynthesisExecution> {
  const definition = getSynthesisDefinition(type)
  if (!definition) throw new Error(`Unknown synthesis ${type}`)
  const evidence = [...workspace.evidence].sort((a, b) => a.id.localeCompare(b.id))
  if (evidence.length < definition.minEvidence) throw new Error(`${type} needs ${definition.minEvidence} evidence record(s)`)
  const inputHash = contentHash({ type, evidence: evidence.map(item => ({
    id: item.id, claim: item.claim, strength: item.strength, weight: item.weight, contradicts: item.contradicts,
  })) })
  const existing = workspace.syntheses.find(item => item.synthesisType === type && item.inputHash === inputHash)
  if (existing) return { result: existing, proposals: [], reused: true }
  const generated = await generator.generate({ definition, evidence })
  const at = new Date().toISOString()
  const supports = evidence.filter(item => !item.contradicts.length).map(item => item.id)
  const contradicts = evidence.filter(item => item.contradicts.length).map(item => item.id)
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
  generator?: StructuredSynthesisGenerator): Promise<SynthesisResult> {
  return (await executeSynthesis(workspace, type, runId, generator)).result
}
