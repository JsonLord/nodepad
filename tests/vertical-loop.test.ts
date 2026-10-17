import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { FileNodepadStore } from "../lib/persistence/file-store"
import { runHeartbeat } from "../lib/heartbeat"
import type { ResearchProvider, ResearchArtifact } from "../lib/research/providers"
import { evidence, fixture, hypothesis } from "./helpers"
import { stableId } from "../lib/domain/id"

class MockProvider implements ResearchProvider {
  policy = { id: "web", costClass: "free" as const, concurrency: 1, enabled: true, health: "healthy" as const }
  constructor(private artifacts: ResearchArtifact[], id = "web") { this.policy.id = id }
  async search() { return this.artifacts }
}
const nodeForHypothesis = (h: ReturnType<typeof hypothesis>) => ({ id: h.id, workspaceId: "fixture", kind: "hypothesis" as const, title: h.title, body: h.statement, metadata: {}, provenance: { origin: "human" as const, actorId: "test", createdAt: h.createdAt }, createdAt: h.createdAt, updatedAt: h.updatedAt, version: 1 })

import { NodepadService } from "../lib/services/nodepad"

test("external evidence canonical linkage", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "nodepad-canonical-")), store = new FileNodepadStore(directory)
  const workspace = fixture(), h1 = hypothesis([], []); h1.strategicImportance = 100
  workspace.hypotheses = [h1]; workspace.nodes = [nodeForHypothesis(h1)]
  await store.saveWorkspace(workspace)
  const service = new NodepadService(store), actor = { actorType: "system" as const, actorId: "test-client" }

  // Missing hypothesis
  await assert.rejects(service.addEvidence(workspace.id, { claim: "Bad", hypothesisId: "does_not_exist" }, actor), /hypothesis_not_found/)

  // Qualification injection attempt
  await assert.rejects(service.addEvidence(workspace.id, { claim: "Inject", hypothesisId: h1.id, qualification: "strongly_qualified" } as any, actor), /authoritative scoring fields/)

  // Supporting evidence
  const e1 = await service.addEvidence(workspace.id, { claim: "Supporting claim", hypothesisId: h1.id, relation: "supports" }, actor, "key1")
  const w1 = await store.getWorkspace(workspace.id), h1Updated = w1.hypotheses[0]
  assert.equal(w1.evidence.length, 1); assert.equal(h1Updated.supportingEvidence[0], e1.id)
  assert.equal(h1Updated.contradictingEvidence.length, 0)
  assert.ok(w1.edges.some(edge => edge.type === "supports" && edge.sourceId === e1.id && edge.targetId === h1.id))
  assert.ok(h1Updated.evidenceScore > 0)

  // Contradicting evidence
  const e2 = await service.addEvidence(workspace.id, { claim: "Contradicting claim", hypothesisId: h1.id, relation: "contradicts" }, actor, "key2")
  const w2 = await store.getWorkspace(workspace.id), h1Updated2 = w2.hypotheses[0]
  assert.equal(w2.evidence.length, 2); assert.equal(h1Updated2.contradictingEvidence[0], e2.id)
  assert.ok(w2.edges.some(edge => edge.type === "contradicts" && edge.sourceId === e2.id && edge.targetId === h1.id))
  assert.ok(h1Updated2.evidenceScore < h1Updated.evidenceScore)

  // Neutral evidence
  const e3 = await service.addEvidence(workspace.id, { claim: "Neutral claim", hypothesisId: h1.id, relation: "neutral" }, actor, "key3")
  const w3 = await store.getWorkspace(workspace.id), h1Updated3 = w3.hypotheses[0]
  assert.equal(w3.evidence.length, 3); assert.equal(h1Updated3.supportingEvidence.length, 1); assert.equal(h1Updated3.contradictingEvidence.length, 1)

  // Idempotency
  const e1Repeat = await service.addEvidence(workspace.id, { claim: "Supporting claim", hypothesisId: h1.id, relation: "supports" }, actor, "key1")
  assert.equal(e1Repeat.id, e1.id)
  const w4 = await store.getWorkspace(workspace.id)
  assert.equal(w4.evidence.length, 3); assert.equal(w4.edges.filter(e => e.type === "supports").length, 1)

  // Conflicting Idempotency
  await assert.rejects(service.addEvidence(workspace.id, { claim: "Different claim", hypothesisId: h1.id, relation: "supports" }, actor, "key1"), /idempotency_conflict/)

  await rm(directory, { recursive: true, force: true })
})

test("automatic heartbeat closes synthesis, hypothesis, research, evidence, score and brain loop", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "nodepad-vertical-")), store = new FileNodepadStore(directory)
  const workspace = fixture(), target = { ...hypothesis(), strategicImportance: 100, uncertainty: 100 }
  workspace.evidence = [evidence("starting", "support", "initial")]
  workspace.hypotheses = [target]; workspace.nodes = [nodeForHypothesis(target)]
  await store.saveWorkspace(workspace)
  process.env.NODEPAD_MAX_RESEARCH_TASKS_PER_HEARTBEAT = "1"
  const support = [new MockProvider([{ title: "support web", excerpt: "Observed successful behavior", url: "https://support/web", relation: "supports" }], "web"), new MockProvider([{ title: "support HN", excerpt: "Observed successful behavior", url: "https://support/hn", relation: "supports" }], "hacker-news"), new MockProvider([{ title: "support GitHub", excerpt: "Observed successful behavior", url: "https://support/github", relation: "supports" }], "github")]
  const first = await runHeartbeat(store, workspace.id, { runId: "vertical-support", now: new Date("2026-10-05"), providers: support, synthesisIds: ["S012"] })
  const supported = await store.getWorkspace(workspace.id), promoted = supported.hypotheses.find(item => item.id === target.id)!
  assert.equal(first.status, "completed"); assert.equal(supported.syntheses.length, 1); assert.ok(supported.syntheses[0].generatedHypotheses.length > 0)
  assert.ok(supported.hypotheses.length > 1); assert.equal(supported.researchTasks.find(item => item.hypothesisIds.includes(target.id))?.status, "complete")
  assert.equal(promoted.supportingEvidence.length, 3); assert.equal(promoted.qualification, "strongly_qualified"); assert.equal(promoted.promoted, true)
  assert.ok(supported.edges.some(edge => edge.type === "produced")); assert.ok(supported.edges.some(edge => edge.type === "supports" && edge.targetId === target.id))
  const hypothesisCount = supported.hypotheses.length
  await runHeartbeat(store, workspace.id, { runId: "vertical-repeat", now: new Date("2026-10-05T01:00:00Z"), providers: [], synthesisIds: ["S012"] })
  const repeated = await store.getWorkspace(workspace.id); assert.equal(repeated.hypotheses.length, hypothesisCount)
  const disconfirmTaskId = stableId("task", target.id, "manual-disconfirm")
  repeated.researchTasks.push({ id: disconfirmTaskId, workspaceId: repeated.id, hypothesisIds: [target.id], question: "Try to falsify target", objective: "disconfirm", preferredSources: ["web"], requiredSourceDiversity: 1, maxCostClass: "free", status: "queued", priority: 101, attempts: 0, maxAttempts: 3, createdBy: "test" })
  await store.saveWorkspace(repeated)
  const contradiction = new MockProvider(Array.from({ length: 6 }, (_, index) => ({ title: `contradiction ${index}`, excerpt: "Observed failure", url: `https://contradict/${index}`, relation: "contradicts" as const })))
  await runHeartbeat(store, workspace.id, { runId: "vertical-disconfirm", now: new Date("2026-10-06"), providers: [contradiction], synthesisIds: ["S012"] })
  const demotedWorkspace = await store.getWorkspace(workspace.id), demoted = demotedWorkspace.hypotheses.find(item => item.id === target.id)!
  assert.ok(demoted.contradictingEvidence.length >= 6); assert.ok(demoted.evidenceScore < 0); assert.ok(["leaning_disqualified", "disqualified", "weakly_disfavored"].includes(demoted.qualification)); assert.equal(demoted.promoted, false)
  assert.ok(demotedWorkspace.events.some(event => event.type === "brain.promoted")); assert.ok(demotedWorkspace.events.some(event => event.type === "brain.demoted")); assert.ok(demotedWorkspace.events.some(event => event.type === "hypothesis.qualification_changed"))
  const counts = [demotedWorkspace.hypotheses.length, demotedWorkspace.evidence.length, demotedWorkspace.researchResults.length]
  const replay = await runHeartbeat(store, workspace.id, { runId: "vertical-disconfirm", now: new Date("2026-10-06"), providers: [contradiction], synthesisIds: ["S012"] })
  const unchanged = await store.getWorkspace(workspace.id); assert.equal(replay.status, "skipped"); assert.deepEqual([unchanged.hypotheses.length, unchanged.evidence.length, unchanged.researchResults.length], counts)
  await rm(directory, { recursive: true, force: true })
})

test("staleness marks important hypotheses and queues one stable refresh task", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "nodepad-stale-")), store = new FileNodepadStore(directory)
  const workspace = fixture(), staleEvidence = evidence("old", "support", "interview"); staleEvidence.observedAt = "2020-01-01T00:00:00.000Z"
  const target = { ...hypothesis(["old"]), strategicImportance: 90 }; workspace.evidence = [staleEvidence]; workspace.hypotheses = [target]; workspace.nodes = [nodeForHypothesis(target)]
  await store.saveWorkspace(workspace); process.env.NODEPAD_MAX_RESEARCH_TASKS_PER_HEARTBEAT = "0"; process.env.NODEPAD_EVIDENCE_STALE_DAYS = "30"
  await runHeartbeat(store, workspace.id, { runId: "stale", now: new Date("2026-10-05"), providers: [], synthesisIds: [] })
  const result = await store.getWorkspace(workspace.id); assert.equal(result.evidence[0].stale, true); assert.ok(result.hypotheses[0].overlays.includes("stale")); assert.equal(result.researchTasks.filter(item => item.objective === "refresh").length, 1); assert.ok(result.events.some(event => event.type === "hypothesis.stale"))
  await rm(directory, { recursive: true, force: true })
})
