import type { EvidenceRelation, ResearchResult, ResearchTask } from "../domain/types"
import { stableId } from "../domain/id"

export type CostClass = "local" | "free" | "free_quota" | "paid_optional"
export interface ResearchProviderPolicy { id: string; costClass: CostClass; requestsPerWindow?: number; windowSeconds?: number; concurrency: number; minIntervalMs?: number; enabled: boolean; health: "healthy" | "degraded" | "cooldown" | "disabled" }
export interface ResearchArtifact { title: string; excerpt: string; url?: string; publishedAt?: string; relation?: EvidenceRelation; hypothesisId?: string; metadata?: Record<string, unknown> }
export interface ResearchProvider { policy: ResearchProviderPolicy; search(task: ResearchTask, signal?: AbortSignal): Promise<ResearchArtifact[]> }

abstract class HttpProvider implements ResearchProvider {
  abstract policy: ResearchProviderPolicy
  abstract url(query: string): string
  abstract parse(value: any): ResearchArtifact[]
  async search(task: ResearchTask, signal?: AbortSignal) {
    if (!this.policy.enabled) return []
    const response = await fetch(this.url(task.question), { signal, headers: { "User-Agent": "nodepad-research/1.0" } })
    if (!response.ok) throw new Error(`${this.policy.id}: HTTP ${response.status}`)
    return this.parse(await response.json())
  }
}
export class HackerNewsProvider extends HttpProvider {
  policy = { id: "hacker-news", costClass: "free" as const, requestsPerWindow: 20, windowSeconds: 60, concurrency: 1, minIntervalMs: 1000, enabled: true, health: "healthy" as const }
  url(query: string) { return `https://hn.algolia.com/api/v1/search?tags=story&query=${encodeURIComponent(query)}` }
  parse(value: any) { return (value.hits ?? []).slice(0, 10).map((item: any) => ({ title: item.title || item.story_title, excerpt: item.comment_text || item.title || "", url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`, publishedAt: item.created_at, metadata: { points: item.points } })) }
}
export class GitHubProvider extends HttpProvider {
  policy = { id: "github", costClass: "free_quota" as const, requestsPerWindow: 10, windowSeconds: 60, concurrency: 1, enabled: true, health: "healthy" as const }
  url(query: string) { return `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=10` }
  parse(value: any) { return (value.items ?? []).map((item: any) => ({ title: item.title, excerpt: item.body?.slice(0, 800) || "", url: item.html_url, publishedAt: item.created_at, metadata: { state: item.state, comments: item.comments } })) }
}
export class WebSearchProvider implements ResearchProvider {
  policy = { id: "web", costClass: "free" as const, concurrency: 1, minIntervalMs: 1500, enabled: true, health: "degraded" as const }
  constructor(private endpoint = process.env.NODEPAD_WEB_SEARCH_ENDPOINT) {}
  async search(task: ResearchTask, signal?: AbortSignal) { if (!this.endpoint) return []; const response = await fetch(`${this.endpoint}?q=${encodeURIComponent(task.question)}`, { signal }); if (!response.ok) throw new Error(`web: HTTP ${response.status}`); const value = await response.json() as any; return (value.results ?? []).slice(0, 10).map((item: any) => ({ title: item.title, excerpt: item.body || item.snippet || "", url: item.href || item.url })) }
}
export const defaultProviders = () => [new HackerNewsProvider(), new GitHubProvider(), new WebSearchProvider()]
const COST: Record<CostClass, number> = { local: 0, free: 1, free_quota: 2, paid_optional: 3 }
export async function executeResearch(task: ResearchTask, providers: ResearchProvider[], runtime = new ResearchProviderRuntime()): Promise<ResearchResult[]> {
  const eligible = providers.filter(provider => provider.policy.enabled && !["disabled", "cooldown"].includes(provider.policy.health)
    && (!task.preferredSources.length || task.preferredSources.includes(provider.policy.id))
    && COST[provider.policy.costClass] <= COST[task.maxCostClass])
  const settled = await Promise.allSettled(eligible.map(async provider => (await runtime.run(provider, task)).map(artifact => ({
    id: stableId("result", task.id, provider.policy.id, artifact.url ?? artifact.title), taskId: task.id,
    providerId: provider.policy.id, ...artifact, retrievedAt: new Date().toISOString(),
  }))))
  return settled.flatMap(item => item.status === "fulfilled" ? item.value : [])
}

export interface ResearchCapabilityClient { invoke(tool: string, input: Record<string, unknown>): Promise<ResearchArtifact[]> }
export class CapabilityResearchProvider implements ResearchProvider {
  constructor(public policy: ResearchProviderPolicy, private client: ResearchCapabilityClient, private tool: string) {}
  search(task: ResearchTask) { return this.client.invoke(this.tool, { question: task.question, objective: task.objective, hypothesisIds: task.hypothesisIds }) }
}
interface RuntimeState { timestamps:number[]; active:number; lastAt:number; failures:number; cooldownUntil:number }
export class ResearchProviderRuntime {
 private states=new Map<string,RuntimeState>()
 constructor(private now=()=>Date.now(),private sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms))){}
 private state(id:string){let s=this.states.get(id);if(!s){s={timestamps:[],active:0,lastAt:0,failures:0,cooldownUntil:0};this.states.set(id,s)}return s}
 async run(provider:ResearchProvider,task:ResearchTask){const p=provider.policy,s=this.state(p.id),now=this.now();if(!p.enabled||p.health==="disabled"||s.cooldownUntil>now)return[];s.timestamps=s.timestamps.filter(t=>t>now-(p.windowSeconds??60)*1000);if(p.requestsPerWindow&&s.timestamps.length>=p.requestsPerWindow){p.health="cooldown";s.cooldownUntil=s.timestamps[0]+(p.windowSeconds??60)*1000;return[]}while(s.active>=Math.max(1,p.concurrency))await this.sleep(5);const wait=Math.max(0,(p.minIntervalMs??0)-(this.now()-s.lastAt));if(wait)await this.sleep(wait);s.active++;s.lastAt=this.now();s.timestamps.push(s.lastAt);try{const out=await provider.search(task);s.failures=0;p.health="healthy";return out}catch(error){s.failures++;const retry=Number((error as any)?.retryAfterMs??0);if(retry){p.health="cooldown";s.cooldownUntil=this.now()+retry}else p.health=s.failures>=3?"cooldown":"degraded";return[]}finally{s.active--}}
}
export function classifyArtifact(artifact:ResearchArtifact,providerId:string): {sourceType:string;evidenceType:"behavioral"|"measured"|"stated";firstParty:boolean;reliability?:number;personId:string|null;accountId:string|null;observedAt?:string;sourceId:string;directness:"direct"|"unknown"} {const meta=artifact.metadata??{},sourceType=String(meta.sourceType??providerId),explicit=meta.evidenceType;const evidenceType=explicit==="behavioral"||explicit==="measured"||explicit==="stated"?explicit:"stated";return{sourceType,evidenceType,firstParty:meta.firstParty===true,reliability:typeof meta.reliability==="number"?Math.max(0,Math.min(1,meta.reliability)):undefined,personId:typeof meta.personId==="string"?meta.personId:null,accountId:typeof meta.accountId==="string"?meta.accountId:null,observedAt:artifact.publishedAt,sourceId:String(meta.sourceId??artifact.url??providerId),directness:meta.directness==="direct"?"direct":"unknown"}}
