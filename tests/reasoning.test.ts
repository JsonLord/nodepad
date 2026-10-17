import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "node:os"
import { OpenAiEvidenceAdjudicator, uncertain } from "../lib/adjudication/openai"
import { adjudicateEvidence } from "../lib/adjudication/pipeline"
import { SemanticLayer } from "../lib/embeddings"
import { EmbeddingCache } from "../lib/embeddings/cache"
import { LlmSynthesisGenerator } from "../lib/synthesis/llm"
import { executeSynthesis, DeterministicSynthesisGenerator } from "../lib/synthesis/runner"
import { matchOrCreateHypothesis } from "../lib/hypotheses/matching"
import { runHeartbeat } from "../lib/heartbeat"
import { FileNodepadStore } from "../lib/persistence/file-store"
import { serializeWorkspace, restoreSerialized } from "../lib/github-sync/serialization"
import type { ChatCompletion } from "../lib/ai/reasoning"
import type { AdjudicationInput } from "../lib/adjudication/provider"
import { fixture, evidence, hypothesis } from "./helpers"
const interpretation = (extra: Record<string, unknown> = {}) => ({ relevance: 95, confidence: 95, relation: "supports", directness: "direct", rationale: "Independent observation directly confirms the claim.", ...extra })
const chat = (value: unknown): ChatCompletion => async request => ({ content: JSON.stringify(value), model: request.model || "default", provider: "openai-compatible" })
async function configured(run: () => Promise<void>) {
  const names = ["OPENAI_MODEL", "OPENAI_URL", "OPENAI_API", "NODEPAD_LLM_ADJUDICATION_MODEL", "NODEPAD_LLM_SYNTHESIS_MODEL", "NODEPAD_LLM_ESCALATION_MODEL", "NODEPAD_SYNTHESIS_MODE", "NODEPAD_MAX_RESEARCH_TASKS_PER_HEARTBEAT"]
  const before = names.map(n => process.env[n])
  Object.assign(process.env, { OPENAI_MODEL: "default-alias", OPENAI_URL: "http://fixture.invalid/v1", OPENAI_API: "REASONING_SECRET_FIXTURE", NODEPAD_LLM_ADJUDICATION_MODEL: "fast-alias", NODEPAD_LLM_SYNTHESIS_MODEL: "synthesis-alias", NODEPAD_SYNTHESIS_MODE: "hybrid", NODEPAD_MAX_RESEARCH_TASKS_PER_HEARTBEAT: "0" })
  delete process.env.NODEPAD_LLM_ESCALATION_MODEL
  try { await run() } finally { names.forEach((n,i) => { if (before[i] === undefined) delete process.env[n]; else process.env[n] = before[i] }) }
}
async function temporary(run: (dir: string) => Promise<void>) { const dir = await mkdtemp(path.join(tmpdir(), "nodepad-reasoning-")); try { await run(dir) } finally { await rm(dir,{recursive:true,force:true}) } }
const input = (): AdjudicationInput => ({ hypothesis: hypothesis(), evidence: evidence("e1", "support"), runId: "test-run", inputHash: "test-hash" })
const proposal = (statement: string) => ({ statement, hypothesisType: "problem", derivedFrom: [] })

test("moderate lexical and semantic similarity creates no strategic relationship", () => {
  const w = fixture()
  matchOrCreateHypothesis(w, proposal("Customers need faster checkout payment"), "s1", "r1")
  matchOrCreateHypothesis(w, proposal("Customers need simpler checkout navigation"), "s2", "r2", { similarity: () => .6 })
  assert.equal(w.hypotheses.length, 2)
  assert.equal(w.edges.some(e => ["alternative_to", "supersedes", "depends_on", "supports", "contradicts"].includes(e.type)), false)
})
test("high-confidence fast model distinguishes disconfirm objective from supportive observation", async () => configured(async () => {
  const i = input(); i.task = { id: "task", workspaceId: "fixture", hypothesisIds: ["h1"], question: "Try falsifying", objective: "disconfirm", preferredSources: [], requiredSourceDiversity: 1, maxCostClass: "free", status: "running", priority: 1, attempts: 0, maxAttempts: 1, createdBy: "test" }
  let calls = 0
  const adjudicator = new OpenAiEvidenceAdjudicator(async request => {
    calls++; assert.equal(request.model,"fast-alias"); assert.ok(request.responseFormat?.json_schema?.strict)
    assert.match(request.messages[0].content, /objective is NOT evidence relation/)
    return chat(interpretation())(request)
  })
  const result = await adjudicator.adjudicate(i)
  assert.equal(result.relation,"supports"); assert.equal(result.fallback,false); assert.equal(calls,1)
  assert.equal(result.promptVersion,"evidence-v1"); assert.deepEqual(result.sourceEvidenceIds,["e1"])
}))
test("low-confidence strategic case escalates; missing/failed escalation stays uncertain", async () => configured(async () => {
  const i = input(); i.hypothesis.strategicImportance = 90
  const calls: string[] = []
  const engine = new OpenAiEvidenceAdjudicator(async request => {
    calls.push(request.model || "")
    return chat(interpretation({ confidence: request.model === "expert-alias" ? 96 : 40 }))(request)
  })
  assert.equal((await engine.adjudicate(i)).relation,"uncertain")
  process.env.NODEPAD_LLM_ESCALATION_MODEL = "expert-alias"
  const result = await engine.adjudicate(i)
  assert.equal(result.relation,"supports"); assert.equal(result.escalated,true); assert.equal(result.model,"expert-alias")
  assert.deepEqual(calls,["fast-alias","fast-alias","expert-alias"])
  i.hypothesis.strategicImportance = 10
  assert.equal((await engine.adjudicate(i)).relation,"uncertain")
  const broken = new OpenAiEvidenceAdjudicator(async request => { if(request.model === "expert-alias")throw new Error("timeout");return chat(interpretation({confidence:40}))(request) })
  i.hypothesis.strategicImportance=90
  assert.equal((await broken.adjudicate(i)).relation,"uncertain")
}))
test("malformed/prose/authority-injection LLM responses cannot become evidence relations", async () => configured(async () => {
  for (const value of ["prose", '{bad', JSON.stringify(interpretation({confidence:101})), JSON.stringify(interpretation({qualification:"qualified"})), JSON.stringify({relation:"supports"})]) {
    const result = await new OpenAiEvidenceAdjudicator(async () => ({content:value,model:"bad",provider:"openai-compatible"})).adjudicate(input())
    assert.equal(result.relation,"uncertain"); assert.equal(result.fallback,true)
  }
}))
test("embedding prefilter gates LLM, accepted relations produce deterministic transition audit and durable backup", async () => configured(async () => temporary(async dir => {
  for (const related of [false,true]) {
    const w = fixture(); w.hypotheses=[hypothesis()]; w.evidence=[evidence("e1","support")]
    const h = w.hypotheses[0]
    const layer = new SemanticLayer({ async embed(texts){return texts.map(t => t === h.statement && !related ? [0,1] : [1,0])}, async health(){return {enabled:true,provider:"mock",model:"mock",status:"available"}} }, new EmbeddingCache(path.join(dir,String(related)),"mock","mock"))
    let calls=0
    const record = await adjudicateEvidence(w,h,w.evidence[0],{runId:"run",layer,adjudicator:new OpenAiEvidenceAdjudicator(async request=>{calls++;return chat(interpretation())(request)})})
    assert.equal(calls,related?1:0); assert.equal(w.evidence.length,1)
    assert.equal(h.supportingEvidence.length,related?1:0)
    if(related){
      assert.ok(h.evidenceScore>0)
      assert.ok(w.events.some(e=>e.causedBy?.includes(record.id)))
      const event=w.events.find(e=>e.type==="hypothesis.qualification_changed")!
      assert.ok((event.after as any).adjudicationIds.includes(record.id)); assert.equal(typeof(event.before as any).confidence,"number")
    } else assert.equal(h.qualification,"unresolved")
    // Fixture nodes are required by the graph validator.
    w.nodes=[{id:h.id,workspaceId:w.id,kind:"hypothesis",title:h.title,metadata:{},version:1,createdAt:w.createdAt,updatedAt:w.updatedAt,provenance:{origin:"human",createdAt:w.createdAt}},{id:"e1",workspaceId:w.id,kind:"evidence",title:"Evidence",metadata:{},version:1,createdAt:w.createdAt,updatedAt:w.updatedAt,provenance:{origin:"human",createdAt:w.createdAt}}]
    const snapshot=serializeWorkspace(w)
    assert.equal(restoreSerialized(snapshot).adjudications?.[0].id,record.id)
    assert.equal(JSON.stringify(snapshot).includes("REASONING_SECRET_FIXTURE"),false)
  }
})))
test("neutral, uncertain and below-threshold validated interpretations create no score-bearing edge",async()=>configured(async()=>{
  for(const value of [interpretation({relation:"neutral"}),interpretation({relation:"uncertain"}),interpretation({relevance:30})]){
    const w=fixture();w.hypotheses=[hypothesis()];w.evidence=[evidence("e1","support")]
    await adjudicateEvidence(w,w.hypotheses[0],w.evidence[0],{runId:"r",adjudicator:new OpenAiEvidenceAdjudicator(chat(value))})
    assert.equal(w.edges.length,0);assert.equal(w.hypotheses[0].evidenceScore,0);assert.equal(w.adjudications?.length,1)
  }
}))
const synthesis = {title:"Root cause",statement:"Manual coordination may explain delays",rationale:"Test this explanation.",unknowns:["Causal mechanism"],suggestedResearch:["Observe workflow"],generationConfidence:80,hypotheses:[{title:"Coordination",statement:"Coordination creates delays",hypothesisType:"root_cause",derivedFrom:["e1"],rationale:"Needs validation"}]}
test("LLM synthesis emits unvalidated proposals with complete safe provenance and role routing",async()=>configured(async()=>{
  const w=fixture();w.evidence=[evidence("e1","support")]
  const output=await executeSynthesis(w,"S012","run",new LlmSynthesisGenerator(async request=>{assert.equal(request.model,"synthesis-alias");return chat(synthesis)(request)}))
  assert.deepEqual(output.proposals[0].supportingEvidence,[]);assert.deepEqual(output.proposals[0].contradictingEvidence,[])
  const h=matchOrCreateHypothesis(w,output.proposals[0],output.result.id,"run").hypothesis
  assert.equal(h.qualification,"unresolved");assert.equal(h.evidenceScore,0)
  assert.equal(output.result.provenance.reasoning?.provider,"openai-compatible")
  assert.equal(output.result.provenance.reasoning?.model,"synthesis-alias")
  assert.equal(h.generation.reasoning?.promptVersion,"synthesis-v1")
}))
test("hybrid synthesis fails safely; mechanical definitions remain deterministic; budgets bound requests",async()=>configured(async()=>{
  for(const failure of [async()=>{throw new Error("offline")},async()=>({content:"bad JSON",model:"m",provider:"openai-compatible" as const})]){
    const w=fixture();w.evidence=[evidence("e1","support")]
    const output=await executeSynthesis(w,"S012","r",new LlmSynthesisGenerator(failure))
    assert.equal(output.result.provenance.reasoning?.fallback,true)
    assert.ok(output.result.statement)
  }
  let calls=0;const generator=new LlmSynthesisGenerator(async request=>{calls++;return chat(synthesis)(request)},1)
  for(const type of ["S001","S012","S124"]){const w=fixture();w.evidence=[evidence("e1","support")];await executeSynthesis(w,type,"r",generator)}
  assert.equal(calls,1)
  process.env.NODEPAD_SYNTHESIS_MODE="deterministic"
  const w=fixture();w.evidence=[evidence("e1","support")]
  const output=await executeSynthesis(w,"S012","r",new DeterministicSynthesisGenerator())
  assert.equal(output.result.provenance.reasoning?.provider,"deterministic")
}))
test("heartbeat embedding/adjudication/rescore loop survives inference failures and retains audit",async()=>configured(async()=>temporary(async dir=>{
  for(const failure of [false,true]){
    const store=new FileNodepadStore(path.join(dir,String(failure))),w=fixture();w.hypotheses=[hypothesis()]
    w.researchTasks=[{id:"t",workspaceId:w.id,hypothesisIds:["h1"],question:"falsify",objective:"disconfirm",preferredSources:[],requiredSourceDiversity:1,maxCostClass:"free",status:"running",priority:1,attempts:0,maxAttempts:1,createdBy:"test"}]
    w.researchResults=[{id:"r",taskId:"t",providerId:"mock",title:"Observed success",excerpt:"Users completed the task",retrievedAt:new Date().toISOString()}]
    await store.saveWorkspace(w)
    const adjudicator=new OpenAiEvidenceAdjudicator(async request=>{if(failure)throw new DOMException("timeout","AbortError");return chat(interpretation())(request)})
    const semanticLayer = new SemanticLayer({async embed(texts){return texts.map(()=>[1,0])},async health(){return {enabled:true,provider:"mock",model:"mock",status:"available"}}},new EmbeddingCache(path.join(dir,String(failure)),"mock","v1"))
    const result=await runHeartbeat(store,w.id,{runId:"hb",adjudicator,semanticLayer,providers:[],synthesisIds:[]})
    assert.equal(result.status,"completed")
    const after=await store.getWorkspace(w.id)
    assert.equal(after.adjudications?.length,1)
    assert.equal(after.adjudications?.[0].semanticRelevance,1)
    assert.equal(after.hypotheses[0].supportingEvidence.length,failure?0:1)
    assert.equal(after.hypotheses[0].contradictingEvidence.length,0)
  }
})))

test("role-specific models fall back to OPENAI_MODEL; deterministic mode never requires LLM",async()=>configured(async()=>{
  delete process.env.NODEPAD_LLM_ADJUDICATION_MODEL
  const result=await new OpenAiEvidenceAdjudicator(async request=>{assert.equal(request.model,"default-alias");return chat(interpretation())(request)}).adjudicate(input())
  assert.equal(result.model,"default-alias")
  process.env.NODEPAD_SYNTHESIS_MODE="deterministic"
  delete process.env.OPENAI_URL;delete process.env.OPENAI_MODEL
  const w=fixture();w.evidence=[evidence("e1","support")]
  const output=await executeSynthesis(w,"S012","r")
  assert.equal(output.result.provenance.reasoning?.provider,"deterministic")
}))
test("research submission and subsequent heartbeat reuse evidence and adjudication for every target",async()=>configured(async()=>temporary(async dir=>{
  const {NodepadService}=await import("../lib/services/nodepad")
  const store=new FileNodepadStore(dir),w=fixture()
  w.hypotheses=[hypothesis(),{...hypothesis(),id:"h2",statement:"A competing explanation"}]
  w.researchTasks=[{id:"t",workspaceId:w.id,hypothesisIds:["h1","h2"],question:"try falsifying",objective:"disconfirm",preferredSources:[],requiredSourceDiversity:1,maxCostClass:"free",status:"claimed",priority:1,attempts:0,maxAttempts:1,createdBy:"test"}]
  await store.saveWorkspace(w)
  let calls=0;const adjudicator=new OpenAiEvidenceAdjudicator(async request=>{calls++;return chat(interpretation())(request)})
  const service=new NodepadService(store,{adjudicator})
  const actor={actorType:"agent" as const,actorId:"test"}
  const result=await service.submitResearchResult(w.id,"t",{providerId:"fixture",title:"Observed success",excerpt:"Actual evidence supports the hypothesis",relation:"contradicts"},actor,"same")
  assert.equal(calls,2)
  const after=await store.getWorkspace(w.id)
  assert.equal(after.evidence.length,1);assert.equal(after.adjudications?.length,2)
  assert.ok(after.hypotheses.every(h=>h.supportingEvidence.length===1&&h.contradictingEvidence.length===0))
  const repeat=await service.submitResearchResult(w.id,"t",{providerId:"fixture",title:"Observed success",excerpt:"same"},actor,"same")
  assert.equal(repeat.id,result.id);assert.equal(calls,2)
  await runHeartbeat(store,w.id,{runId:"after-submit",providers:[],synthesisIds:[],adjudicator})
  const final=await store.getWorkspace(w.id)
  assert.equal(final.evidence.length,1);assert.equal(final.adjudications?.length,2);assert.equal(calls,2)
})))
test("provider output cannot leak quoted credentials into adjudication or synthesis provenance",async()=>configured(async()=>{
  process.env.OPENAI_API='fixture-secret-with-"quotes"'
  const record=await new OpenAiEvidenceAdjudicator(chat(interpretation({rationale:`Reason ${process.env.OPENAI_API}`}))).adjudicate(input())
  assert.equal(record.rationale.includes(process.env.OPENAI_API),false)
  const w=fixture();w.evidence=[evidence("e1","support")]
  const output=await executeSynthesis(w,"S012","r",new LlmSynthesisGenerator(chat({...synthesis,rationale:`Reason ${process.env.OPENAI_API}`})))
  assert.equal(JSON.stringify(output).includes(process.env.OPENAI_API),false)
}))

test("model failures are bounded within a run and retried by a fresh run",async()=>configured(async()=>{
  const engine=new OpenAiEvidenceAdjudicator(async()=>{calls++;throw new Error("offline")})
  let calls=0
  const w=fixture();w.hypotheses=[hypothesis()];w.evidence=[evidence("e1","support"),evidence("e2","support")]
  for(const e of w.evidence)await adjudicateEvidence(w,w.hypotheses[0],e,{runId:"failed-run",adjudicator:engine})
  assert.equal(calls,1);assert.equal(w.adjudications?.length,2);assert.equal(w.hypotheses[0].evidenceScore,0)
  await adjudicateEvidence(w,w.hypotheses[0],w.evidence[0],{runId:"retry-run",adjudicator:new OpenAiEvidenceAdjudicator(chat(interpretation()))})
  assert.equal(w.hypotheses[0].supportingEvidence.length,1)
}))
test("a confident neutral reclassification removes a prior scored link with causal audit",async()=>configured(async()=>{
  const w=fixture();w.hypotheses=[hypothesis()];w.evidence=[evidence("e1","support")]
  await adjudicateEvidence(w,w.hypotheses[0],w.evidence[0],{runId:"support",adjudicator:new OpenAiEvidenceAdjudicator(chat(interpretation()))})
  assert.ok(w.hypotheses[0].evidenceScore>0)
  w.hypotheses[0].statement="A revised and unrelated claim"
  const record=await adjudicateEvidence(w,w.hypotheses[0],w.evidence[0],{runId:"neutral",adjudicator:new OpenAiEvidenceAdjudicator(chat(interpretation({relation:"neutral"})))})
  assert.equal(w.hypotheses[0].supportingEvidence.length,0);assert.equal(w.hypotheses[0].evidenceScore,0)
  assert.equal(w.edges.some(e=>e.type==="supports"),false)
  const transition=w.events.find(e=>e.causedBy?.includes(record.id))!
  assert.equal((transition.after as any).relationChange.before,"supports");assert.equal((transition.after as any).relationChange.after,"neutral")
}))
test("synthesis hashes actual claim content and rejects authoritative/citation injection",async()=>configured(async()=>{
  const w=fixture();w.evidence=[evidence("e1","support")]
  const first=await executeSynthesis(w,"S012","one",new DeterministicSynthesisGenerator())
  w.evidence[0].claim="A different observed fact"
  const second=await executeSynthesis(w,"S012","two",new DeterministicSynthesisGenerator())
  assert.notEqual(first.result.inputHash,second.result.inputHash)
  for(const value of [{...synthesis,confidence:100},{...synthesis,hypotheses:[{...synthesis.hypotheses[0],derivedFrom:["unknown-id"]}]},{...synthesis,hypotheses:[{...synthesis.hypotheses[0],supportingEvidence:["e1"]}]}]){
    const workspace=fixture();workspace.evidence=[evidence("e1","support")]
    const output=await executeSynthesis(workspace,"S012","r",new LlmSynthesisGenerator(chat(value)))
    assert.equal(output.result.provenance.reasoning?.fallback,true)
    assert.ok(output.proposals.every(p=>p.supportingEvidence?.length===0&&p.contradictingEvidence?.length===0))
  }
}))

test("corrupt adjudication snapshots fail restore while valid records retain provenance",async()=>configured(async()=>{
  const w=fixture();w.hypotheses=[hypothesis()];w.evidence=[evidence("e1","support")]
  const record=await adjudicateEvidence(w,w.hypotheses[0],w.evidence[0],{runId:"r",adjudicator:new OpenAiEvidenceAdjudicator(chat(interpretation({relation:"neutral"})))})
  const snapshot=serializeWorkspace(w)
  assert.equal(restoreSerialized(snapshot).adjudications?.[0].promptVersion,"evidence-v1")
  snapshot.files["adjudications/records.ndjson"]=JSON.stringify({...record,confidence:200})+"\n"
  assert.throws(()=>restoreSerialized(snapshot),/invalid interpretation certainty/)
}))
