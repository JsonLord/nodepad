import type {DelegationStatus} from "../control-plane/types"
export const AGTX_PHASES=["Backlog","Planning","Running","Review","Done"] as const
export type AgTxPhase=typeof AGTX_PHASES[number]
export type AgTxAllowedAction=string
export interface AgTxProject {id:string;name:string;repositoryPath?:string;configured?:boolean}
export interface AgTxTaskSnapshot {id:string;projectId:string;title:string;description?:string;phase:AgTxPhase;allowedActions:string[];workflow?:string;agent?:string;phaseChangedAt?:number;blocked?:boolean;needsInput?:boolean;artifacts?:Array<{type:string;label:string;reference:string}>;diffSummary?:string;outputTail?:string;failure?:{code?:string;summary?:string}}
export interface AgTxTaskRequest {projectId:string;title:string;description:string;correlationId:string}
export interface AgTxBoardChange {changedTaskIds:string[];transitionOutcomes?:unknown[]}
export interface AgTxRuntimeHealth {configured:boolean;binaryAvailable:boolean;mcpConnected:boolean;compatible:boolean;executionEnabled:boolean;version?:string;projectCount:number;errorCode?:string}
export interface AgTxExecutionAdapter {health():Promise<AgTxRuntimeHealth>;listProjects():Promise<AgTxProject[]>;listTasks(projectId?:string):Promise<AgTxTaskSnapshot[]>;createTask(request:AgTxTaskRequest):Promise<AgTxTaskSnapshot>;getTask(projectId:string,externalTaskId:string):Promise<AgTxTaskSnapshot>;transition(projectId:string,externalTaskId:string,action:AgTxAllowedAction):Promise<void>;waitForChange(timeoutMs?:number):Promise<AgTxBoardChange>;close():Promise<void>}
export interface DelegationEvent {id:string;delegationId:string;provider:"agtx";eventType:string;externalStatus?:string;message?:string;metadata?:Record<string,unknown>;createdAt:number}
export const mapAgTxPhase=(task:Pick<AgTxTaskSnapshot,"phase"|"blocked"|"needsInput"|"failure">):DelegationStatus=>task.failure?"failed":task.needsInput||task.blocked?"waiting_for_human":task.phase==="Backlog"?"starting":task.phase==="Planning"||task.phase==="Running"?"running":task.phase==="Review"?"review":"succeeded"
