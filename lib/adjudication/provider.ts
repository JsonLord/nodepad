import type { EvidenceAdjudication, EvidenceRecord, HypothesisRecord, ResearchResult, ResearchTask } from "../domain/types"
export interface AdjudicationInput { hypothesis: HypothesisRecord; evidence: EvidenceRecord; researchResult?: ResearchResult; task?: ResearchTask; semanticRelevance?: number; runId: string; inputHash: string }
export interface EvidenceAdjudicator { adjudicate(input: AdjudicationInput): Promise<EvidenceAdjudication> }
