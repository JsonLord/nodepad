import rawDefinitions from "./definitions.json"
import type { KnowledgeNodeKind } from "../domain/types"
export interface SynthesisDefinition { id:string; category:string; name:string; description:string; inputKinds:KnowledgeNodeKind[]; outputKinds:KnowledgeNodeKind[]; minEvidence:number; requiresIndependentSources:number; promptTemplate:string; deterministicPostProcessor:string; generatesHypotheses:boolean; heartbeatEligible:boolean; priority:number; specialized:boolean }
const specialized = new Set(["S001","S004","S006","S010",...Array.from({length:10},(_,i)=>`S0${11+i}`),"S031","S036","S038","S039","S040","S064","S066","S091","S092","S098","S099","S111","S112","S113","S114","S121","S122","S124","S125","S126","S127","S128","S129","S130"])
export const synthesisRegistry:SynthesisDefinition[] = rawDefinitions.map((d,i)=>({...d,inputKinds:["evidence","observation","hypothesis"],outputKinds:[d.id>="S121"?"insight":"hypothesis"],minEvidence:1,requiresIndependentSources:d.id==="S002"?2:1,promptTemplate:`${d.description}. Cite every input id, retain contradictions, distinguish facts from proposals, and list unknowns.`,deterministicPostProcessor:d.id==="S004"?"contradiction-map":d.id==="S001"?"evidence-sufficiency":"provenance-required",generatesHypotheses:true,heartbeatEligible:true,priority:130-i,specialized:specialized.has(d.id)}))
const byId=new Map(synthesisRegistry.map(d=>[d.id,d]))
if(byId.size<130)throw new Error("Synthesis registry must contain 130 unique definitions")
export const getSynthesisDefinition=(id:string)=>byId.get(id)
