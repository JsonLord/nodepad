import type {AgentSelectionRequest} from "../control-plane/types"
export interface LayaProviderResult {selectedAgentId:string;probabilities:Record<string,number>;model?:string;metadata?:Record<string,unknown>}
export interface LayaProviderHealth {enabled:boolean;provider:"remote_openai";reachable:boolean;configuredModel:string;state:"ready"|"unavailable"|"model_not_found"|"incompatible";probabilitiesAvailable?:boolean}
export interface LayaDecisionProvider {selectAgent(request:AgentSelectionRequest):Promise<LayaProviderResult>;health():Promise<LayaProviderHealth>}
export type LayaErrorCode="LAYA_NOT_CONFIGURED"|"LAYA_AUTH_FAILED"|"LAYA_UNAVAILABLE"|"LAYA_BUSY"|"LAYA_TIMEOUT"|"LAYA_INVALID_RESPONSE"|"LAYA_MODEL_NOT_FOUND"|"LAYA_RATE_LIMITED"|"PROBABILITY_DATA_UNAVAILABLE"
export class LayaProviderError extends Error {constructor(public code:LayaErrorCode,public retryAfter?:string){super(code)}}
