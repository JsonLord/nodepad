import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "node:os"
import { EmbeddingCache } from "../lib/embeddings/cache"
import { OllamaEmbeddingProvider } from "../lib/embeddings/ollama"
import { createSemanticLayer, embeddingHealth, SemanticLayer } from "../lib/embeddings"
import { cosine } from "../lib/embeddings/similarity"
import { dedupeEvidence } from "../lib/embeddings/dedupe"
import { semanticClusters } from "../lib/embeddings/themes"
import { adjudicateRelevant } from "../lib/embeddings/relevance"
import { matchOrCreateHypothesis } from "../lib/hypotheses/matching"
import { runHeartbeat } from "../lib/heartbeat"
import { FileNodepadStore } from "../lib/persistence/file-store"
import { serializeWorkspace } from "../lib/github-sync/serialization"
import { fixture, evidence, hypothesis, fixtureAdjudicator } from "./helpers"
import type { EmbeddingProvider } from "../lib/embeddings/provider"
const provider = (map: Record<string, number[]> = {}): EmbeddingProvider => ({ async embed(texts) { return texts.map(t => map[t] || [1, 0]) }, async health() { return { enabled: true, provider: "mock", model: "test", status: "available" } } })
async function temporary(run: (dir: string) => Promise<void>) { const dir = await mkdtemp(path.join(tmpdir(), "nodepad-embeddings-")); try { await run(dir) } finally { await rm(dir, { recursive: true, force: true }) } }
function layer(dir: string, vectors: Record<string, number[]> = {}) { return new SemanticLayer(provider(vectors), new EmbeddingCache(dir, "mock", "test")) }
const proposal = (statement: string) => ({ statement, hypothesisType: "problem", derivedFrom: [] })

test("Ollama batches /api/embed, keeps configurable model, rejects malformed vectors", async () => {
  const client = new OllamaEmbeddingProvider("http://ollama.test/", "custom/tag:v2", async (url, options) => {
    assert.equal(url, "http://ollama.test/api/embed")
    assert.deepEqual(JSON.parse(String(options?.body)), { model: "custom/tag:v2", input: ["a", "b"], truncate: false })
    return new Response('{"embeddings":[[1,0],[0,1]]}')
  })
  assert.deepEqual(await client.embed(["a", "b"]), [[1, 0], [0, 1]])
  for (const body of ['{"embeddings":[[0,0]]}', '{"embeddings":[[1],[1,0]]}', '{}']) {
    const malformed = new OllamaEmbeddingProvider("http://ollama.test", "m", async () => new Response(body))
    await assert.rejects(() => malformed.embed(["a", "b"]), /degraded/)
  }
})
test("health reports installation, missing model, auth/server/network failure without raw secrets", async () => {
  for (const [status, expected] of [[404, "model_error"], [500, "degraded"], [401, "degraded"]] as const) {
    const client = new OllamaEmbeddingProvider("http://ollama.test", "m", async () => new Response("SECRET_FROM_BODY", { status }))
    const health = await client.health(); assert.equal(health.status, expected); assert.equal(JSON.stringify(health).includes("SECRET"), false)
  }
  const up = new OllamaEmbeddingProvider("http://ollama.test", "m", async () => new Response('{"models":[{"name":"m:latest"}]}'))
  assert.equal((await up.health()).status, "available")
  const missing = new OllamaEmbeddingProvider("http://ollama.test", "m", async () => new Response('{"models":[]}'))
  assert.equal((await missing.health()).status, "model_error")
  const bad = new OllamaEmbeddingProvider("http://ollama.test", "m", async () => { throw new Error("SECRET") })
  assert.equal((await bad.health()).status, "unreachable")
})
test("disabled provider makes no calls and heartbeat retains deterministic behavior", async () => temporary(async dir => {
  const previous = process.env.NODEPAD_EMBEDDING_ENABLED; process.env.NODEPAD_EMBEDDING_ENABLED = "false"
  try {
    const semantic = createSemanticLayer(dir, async () => { throw new Error("should not call") })
    assert.equal((await semantic.vectors(["a"])).size, 0)
    assert.equal((await embeddingHealth()).status, "disabled")
    const store = new FileNodepadStore(dir), w = fixture(); w.evidence = [evidence("a", "support")]; await store.saveWorkspace(w)
    assert.equal((await runHeartbeat(store, w.id, { runId: "disabled", semanticLayer: semantic, providers: [], synthesisIds: [] })).status, "completed")
  } finally { if (previous === undefined) delete process.env.NODEPAD_EMBEDDING_ENABLED; else process.env.NODEPAD_EMBEDDING_ENABLED = previous }
}))
test("unavailable Ollama never fails heartbeat and is retried at most once per run", async () => temporary(async dir => {
  let calls = 0
  const bad: EmbeddingProvider = { ...provider(), async embed() { calls++; throw new Error("offline") } }
  const semantic = new SemanticLayer(bad, new EmbeddingCache(dir, "mock", "test"))
  const store = new FileNodepadStore(dir), w = fixture(); w.evidence = [evidence("a", "support")]; await store.saveWorkspace(w)
  assert.equal((await runHeartbeat(store, w.id, { runId: "offline", semanticLayer: semantic, providers: [], synthesisIds: [] })).status, "completed")
  assert.equal(calls, 1)
}))
test("durable content cache avoids repeat batches, rekeys model/URL and rejects corruption", async () => temporary(async dir => {
  let calls = 0
  const p = { ...provider(), async embed(texts: string[]) { calls++; return texts.map(() => [1, 0]) } }
  const cache = new EmbeddingCache(dir, "ollama", "m", "url")
  await cache.embed(["a", "a", "b"], p)
  await new EmbeddingCache(dir, "ollama", "m", "url").embed(["a", "b"], p)
  assert.equal(calls, 1)
  await new EmbeddingCache(dir, "ollama", "other", "url").embed(["a"], p)
  assert.equal(calls, 2)
  assert.notEqual(cache.key("a"), new EmbeddingCache(dir, "ollama", "m", "other").key("a"))
  await writeFile(path.join(dir, ".embeddings", `${cache.key("a")}.json`), "invalid")
  assert.equal(await cache.get("a"), undefined)
  await cache.embed(["a"], p); assert.equal(calls, 3)
  assert.equal((await readFile(path.join(dir, ".embeddings", `${cache.key("a")}.json`), "utf8")).includes('"a"'), false)
}))
test("exact evidence dedupe preserves source/provenance/aliases without embeddings", () => {
  const w = fixture(), first = evidence("a", "support"), second = { ...first, id: "b", provenance: { ...first.provenance, actorId: "other" } }
  w.evidence = [first, second]; w.hypotheses = [hypothesis(["b"])]
  assert.equal(dedupeEvidence(w).get("b"), "a")
  assert.deepEqual(w.hypotheses[0].supportingEvidence, ["a"])
  assert.equal(w.evidence[0].duplicateRecords?.[0].provenance.actorId, "other")
  assert.deepEqual(w.evidence[0].aliases, ["b"])
})
test("semantic evidence duplicate merges conservatively; related and negated claims stay separate", () => {
  const w = fixture(); w.evidence = [{ ...evidence("a", "support"), claim: "Checkout is slow" }, { ...evidence("b", "support"), claim: "Purchasing takes too long", sourceRef: "source-b" }, { ...evidence("c", "support"), claim: "Checkout has navigation problems" }, { ...evidence("d", "support"), claim: "Checkout is not slow" }]
  const before = w.evidence[1].sourceRef
  dedupeEvidence(w, (a, b) => b === "Checkout has navigation problems" ? .8 : .99)
  assert.equal(w.evidence.length, 3)
  assert.equal(w.evidence[0].duplicateRecords?.[0].sourceRef, before)
  assert.ok(w.evidence.some(e => e.id === "d"))
})
test("semantic duplicate detection cannot collapse opposing adjudicated evidence", () => {
  const w = fixture(); w.evidence = [evidence("a", "support"), evidence("b", "contradict")]; w.hypotheses = [hypothesis(["a"], ["b"])]
  dedupeEvidence(w, () => .999)
  assert.equal(w.evidence.length, 2)
})
test("high hypothesis similarity matches duplicate; moderate similarity creates no epistemic edges", () => {
  const w = fixture()
  const original = matchOrCreateHypothesis(w, proposal("Checkout takes too long"), "s1", "r1").hypothesis
  const before = { qualification: original.qualification, evidenceScore: original.evidenceScore, confidence: original.confidence }
  const match = matchOrCreateHypothesis(w, proposal("Purchasing is slow"), "s2", "r2", { similarity: () => .96 })
  assert.equal(match.created, false); assert.equal(match.hypothesis.id, original.id)
  assert.deepEqual({ qualification: original.qualification, evidenceScore: original.evidenceScore, confidence: original.confidence }, before)
  matchOrCreateHypothesis(w, proposal("Invoices require manual checks"), "s3", "r3", { similarity: () => .65 })
  assert.equal(w.hypotheses.length, 2)
  assert.equal(w.edges.some(e => ["supersedes", "alternative_to", "supports", "contradicts"].includes(e.type)), false)
})
test("semantic themes group paraphrases with stable keys and lexical fallback", () => {
  const w = fixture(); w.evidence = [{ ...evidence("a", "support"), claim: "Slow checkout" }, { ...evidence("b", "support"), claim: "Purchasing takes time" }, { ...evidence("c", "support"), claim: "Invoices fail" }]
  const vectors = new Map([["Slow checkout", [1, 0]], ["Purchasing takes time", [.99, .01]], ["Invoices fail", [0, 1]]])
  const clusters = semanticClusters(w.evidence, vectors)
  assert.equal(clusters.length, 2); assert.equal(clusters[0].evidence.length, 2)
  assert.deepEqual(semanticClusters([...w.evidence].reverse(), vectors).map(c => c.key), clusters.map(c => c.key))
  assert.equal(semanticClusters(w.evidence, new Map()).every(c => !c.centroid), true)
})
test("relevance only gates adjudicator; low scores store/no classification, high scores invoke callback", async () => temporary(async dir => {
  const semantic = layer(dir, { result: [1, 0], unrelated: [0, 1], related: [.99, .01] })
  let calls = 0
  const low = await adjudicateRelevant("result", "unrelated", semantic, () => { calls++; return "contradicts" })
  assert.equal(low.shouldAdjudicate, false); assert.equal(calls, 0); assert.equal(low.result, undefined)
  const high = await adjudicateRelevant("result", "related", semantic, () => { calls++; return "supports" })
  assert.equal(calls, 1); assert.equal(high.result, "supports")
}))
test("heartbeat persists semantic membership without cache/config in backup and reuses cache", async () => temporary(async dir => {
  const store = new FileNodepadStore(dir), w = fixture(); w.evidence = [{ ...evidence("a", "support"), claim: "Slow checkout" }, { ...evidence("b", "support"), claim: "Invoices fail" }]; await store.saveWorkspace(w)
  const semantic = layer(dir, { "Slow checkout": [1, 0], "Invoices fail": [0, 1] })
  await runHeartbeat(store, w.id, { runId: "one", semanticLayer: semantic, providers: [], synthesisIds: [] })
  const after = await store.getWorkspace(w.id)
  assert.equal(after.evidence.length, 2)
  assert.ok(after.nodes.some(n => n.kind === "theme" && Array.isArray(n.metadata.memberEvidenceIds) && Array.isArray(n.metadata.centroid)))
  const keys = Object.keys(serializeWorkspace(after).files)
  assert.equal(keys.some(key => key.includes(".embeddings")), false)
  assert.equal(JSON.stringify(serializeWorkspace(after)).includes("NODEPAD_EMBEDDING_URL"), false)
  assert.ok((await readdir(path.join(dir, ".embeddings"))).length > 0)
}))
test("invalid/different dimensionality and zero vectors never produce false similarity", () => {
  assert.equal(cosine([1], [1, 0]), undefined)
  assert.equal(cosine([0, 0], [1, 0]), undefined)
  assert.equal(cosine([NaN], [1]), undefined)
})

test("heartbeat relevance prefilter retains research evidence but gates explicit relation handling", async () => temporary(async dir => {
  for (const related of [false, true]) {
    const subdir = path.join(dir, String(related)), store = new FileNodepadStore(subdir), w = fixture()
    w.hypotheses = [hypothesis()]
    w.researchTasks = [{ id: "task", workspaceId: w.id, hypothesisIds: ["h1"], question: "test", objective: "support", preferredSources: [], requiredSourceDiversity: 1, maxCostClass: "free", status: "running", priority: 1, attempts: 0, maxAttempts: 1, createdBy: "test" }]
    w.researchResults = [{ id: "result", taskId: "task", providerId: "mock", title: "Result", excerpt: "independent finding", retrievedAt: new Date().toISOString(), relation: "supports" }]
    await store.saveWorkspace(w)
    const semantic = layer(subdir, { "Result: independent finding": [1, 0], [w.hypotheses[0].statement]: related ? [1, 0] : [0, 1] })
    await runHeartbeat(store, w.id, { adjudicator: fixtureAdjudicator, runId: "relevance", semanticLayer: semantic, providers: [], synthesisIds: [] })
    const after = await store.getWorkspace(w.id)
    assert.equal(after.evidence.length, 1)
    assert.equal(after.hypotheses[0].supportingEvidence.length, related ? 1 : 0)
    assert.equal(after.edges.some(e => e.type === "supports"), related)
    assert.equal((after.researchResults[0].metadata?.semanticRelevance as Record<string, number>).h1, related ? 1 : 0)
  }
}))
test("Ollama health/requests reject credential-bearing URLs and malformed config", async () => {
  const client = new OllamaEmbeddingProvider("http://user:secret@host", "m", async () => { throw new Error("must not fetch") })
  assert.equal((await client.health()).status, "not_configured")
  assert.equal(JSON.stringify(await client.health()).includes("secret"), false)
})

test("high similarity cannot merge numerically different claims", () => {
  const w = fixture(); w.evidence = [{ ...evidence("a", "support"), claim: "Price is 10 dollars" }, { ...evidence("b", "support"), claim: "Price is 100 dollars" }]
  dedupeEvidence(w, () => .999)
  assert.equal(w.evidence.length, 2)
})

test("embedding status route requires authentication and disabled mode returns only operational fields", async () => {
  const { GET } = await import("../app/api/v1/embeddings/status/route")
  const { NextRequest } = await import("next/server")
  const previousKey = process.env.NODEPAD_API_KEY, previousEnabled = process.env.NODEPAD_EMBEDDING_ENABLED
  process.env.NODEPAD_API_KEY = "embedding-status-fixture"; process.env.NODEPAD_EMBEDDING_ENABLED = "false"
  try {
    assert.equal((await GET(new NextRequest("http://localhost/api/v1/embeddings/status"))).status, 401)
    const response = await GET(new NextRequest("http://localhost/api/v1/embeddings/status", { headers: { Authorization: "Bearer embedding-status-fixture" } }))
    assert.equal(response.status, 200)
    assert.deepEqual(Object.keys(await response.json()).sort(), ["enabled", "model", "provider", "status"])
  } finally {
    if (previousKey === undefined) delete process.env.NODEPAD_API_KEY; else process.env.NODEPAD_API_KEY = previousKey
    if (previousEnabled === undefined) delete process.env.NODEPAD_EMBEDDING_ENABLED; else process.env.NODEPAD_EMBEDDING_ENABLED = previousEnabled
  }
})
