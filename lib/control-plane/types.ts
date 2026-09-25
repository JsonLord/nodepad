import type { EntityType } from "../domain/entity"

export const AGENT_CAPABILITIES = ["chat","planning","research","web","file_read","file_write","code","git","shell","document_edit","spreadsheet","analysis","review","browser"] as const
export type AgentCapability = typeof AGENT_CAPABILITIES[number]
export const AGENT_ADAPTER_TYPES = ["http","openai_compatible","local_cli","agtx","hermes"] as const
export type AgentAdapterType = typeof AGENT_ADAPTER_TYPES[number]
export type AgentStatus = "unknown"|"available"|"unavailable"|"disabled"|"busy"|"error"

export interface AgentProfile { id:string; name:string; description?:string; adapterType:AgentAdapterType; enabled:boolean; locality:"local"|"remote"; capabilities:AgentCapability[]; maxConcurrency:number; costClass?:"free"|"low"|"medium"|"high"; privacyClass?:string; supervisor?:boolean; config:Record<string,unknown>; revision:number; createdAt:number; updatedAt:number }
export interface RoutingMatch { workTypes?:string[]; entityTypes?:EntityType[]; projectIds?:string[]; hasFiles?:boolean; requiresFileRead?:boolean; requiresFileWrite?:boolean; requiresWeb?:boolean; requiresCode?:boolean; requiredCapabilities?:AgentCapability[]; locality?:"local"|"remote"|"any"; privacyClasses?:string[]; labels?:string[] }
export interface RoutingRule { id:string; name:string; description?:string; enabled:boolean; priority:number; match:RoutingMatch; route:{agentProfileId?:string;fallbackAgentProfileIds?:string[]}; revision:number; createdAt:number; updatedAt:number }
export type AssignmentRole="default"|"coding"|"research"|"file"|"review"|"custom"
export interface AgentAssignment { id:string; scope:"project"|"task"; scopeId:string; agentProfileId:string; role:AssignmentRole; createdAt:number; updatedAt:number }
export const DELEGATION_STATUSES=["draft","queued","starting","running","waiting_for_agent","waiting_for_human","review","succeeded","failed","cancelled"] as const
export type DelegationStatus=typeof DELEGATION_STATUSES[number]
export interface DelegationRequest { instruction:string; contextEntityIds?:string[]; artifactRefs?:string[]; constraints?:Record<string,string|number|boolean> }
export interface Delegation { id:string; taskEntityId?:string; projectEntityId?:string; requestedBy:"user"|"hermes"|"system"; agentProfileId?:string; routingRuleId?:string; routingDecisionId?:string; status:DelegationStatus; request:DelegationRequest; externalProvider?:"agtx"|"http"|"local_cli"; externalRunId?:string; dispatchAuthorizedAt?:number; dispatchAuthorizedBy?:"user"|"hermes"|"system"; lastExternalStatus?:string; runtimeDiagnostic?:string; createdAt:number; updatedAt:number; startedAt?:number; finishedAt?:number }
export interface AgTxProjectMapping {id:string;nodepadProjectEntityId:string;agentProfileId:string;agtxProjectId?:string;repositoryPath:string;enabled:boolean;createdAt:number;updatedAt:number}
export interface ControlPlaneState { revision:number; agents:AgentProfile[]; rules:RoutingRule[]; assignments:AgentAssignment[]; delegations:Delegation[]; agtxMappings?:AgTxProjectMapping[] }
export interface RoutingContext { taskEntityId?:string; projectEntityId?:string; workType?:string; title?:string; entityType?:EntityType; hasFiles?:boolean; requiresFileRead?:boolean; requiresFileWrite?:boolean; requiresWeb?:boolean; requiresCode?:boolean; requiredCapabilities?:AgentCapability[]; privacyClass?:string; localityRequirement?:"local"|"remote"|"any"; labels?:string[] }
export interface RoutingResult { eligibleAgentIds:string[]; filteredAgents:{agentId:string;reasons:string[]}[]; matchedRuleIds:string[]; explicitAssignment?:{assignmentId:string;scope:"task"|"project";agentProfileId:string;eligible:boolean}; selectedAgentId?:string; selectionReason?:"explicit_assignment"|"routing_rule"|"single_eligible" }
export interface AgentSelectionRequest { routingContext:RoutingContext; eligibleAgentIds:string[]; candidates:Record<string,{name:string;description?:string;locality:"local"|"remote";capabilities:AgentCapability[];privacyClass?:string}> }
export type LayaEscalationReason="low_confidence"|"low_margin"|"laya_not_configured"|"laya_auth_failed"|"laya_unavailable"|"laya_busy"|"laya_timeout"|"laya_invalid_response"|"laya_model_not_found"|"laya_rate_limited"|"probability_data_unavailable"|"too_many_candidates"|"no_eligible_agent"|"ineligible_explicit_assignment"
export interface AgentSelectionResult { decisionId:string; selectedAgentId?:string; eligibleAgentIds:string[]; probabilities:Record<string,number>; confidence?:number; margin?:number; decision:"deterministic"|"selected"|"escalate"|"unavailable"; decisionSource:"deterministic"|"laya"; escalationReason?:LayaEscalationReason; retryAfter?:string; latencyMs?:number; provider?:{type:"remote_openai";model:string}; filteredAgents:{agentId:string;reasons:string[]}[]; matchedRuleIds:string[]; explicitAssignment?:RoutingResult["explicitAssignment"] }

/** Configuration-only adapter boundary. There is deliberately no execute method. */
export interface AgentAdapterDefinition { type:AgentAdapterType; validateConfig(config:Record<string,unknown>):string[]; describeCapabilities(profile:AgentProfile):AgentCapability[] }
export interface HttpAgentExecutionRequest { instruction:string; contextEntityIds:string[]; artifactRefs?:string[] }
export interface AgtxAdapterContract { registerProject:boolean; listTasks:boolean; createCodingTask:boolean; inspectPhase:boolean; advancePhase:boolean; startTask:boolean; readArtifacts:boolean; readDiff:boolean; readAgentState:boolean }
