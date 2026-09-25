import type {AgentProfile,DelegationStatus} from "../control-plane/types"

export const EXECUTABLE_ADAPTER_TYPES=["agtx","http","local_cli"] as const
export type ExecutableAdapterType=typeof EXECUTABLE_ADAPTER_TYPES[number]
export type ExecutionStatus="queued"|"starting"|"running"|"waiting_for_agent"|"waiting_for_human"|"review"|"succeeded"|"failed"|"cancelled"|"interrupted"
export type CancellationCapability="supported"|"unsupported"|"unknown"
export interface HumanInputRequirement {required:boolean;message?:string;externalRef?:string}
export interface ExecutionArtifact {id:string;delegationId:string;provider:string;type:"diff"|"file"|"document"|"report"|"log"|"url"|"other";label:string;externalRef?:string;url?:string;metadata?:Record<string,unknown>}
export interface ExecutionEvent {id:string;delegationId:string;provider:string;eventType:"dispatch_authorized"|"dispatch_started"|"external_run_created"|"provider_status_changed"|"waiting_for_human"|"artifact_available"|"review_ready"|"completed"|"failed"|"cancel_requested"|"cancelled"|"reconciled";providerStatus?:string;message?:string;metadata?:Record<string,unknown>;createdAt:number}
export interface ExternalRun {id:string;delegationId:string;provider:ExecutableAdapterType;externalRunId:string;providerStatus?:string;createdAt:number;updatedAt:number;startedAt?:number;finishedAt?:number;metadata?:Record<string,unknown>}
export interface ExternalRunSnapshot {externalRunId:string;status:ExecutionStatus;providerStatus?:string;humanInput?:HumanInputRequirement;artifacts?:Omit<ExecutionArtifact,"id"|"delegationId"|"provider">[];diagnostic?:string;metadata?:Record<string,unknown>}
export interface ExecutionHealth {status:"ready"|"degraded"|"unavailable"|"disabled"|"unknown";message?:string;metadata?:Record<string,unknown>}
export interface ExecutionRequest {delegationId:string;taskId?:string;projectId?:string;instruction:string;context:Record<string,unknown>;constraints:Record<string,unknown>;profile:AgentProfile;providerConfig?:Record<string,unknown>}
export interface CancelResult {status:"requested"|"cancelled"|"unsupported";message?:string}
export interface ExecutionAdapter {adapterType:ExecutableAdapterType;health(profile:AgentProfile):Promise<ExecutionHealth>;dispatch(request:ExecutionRequest):Promise<ExternalRun>;reconcile(run:ExternalRun):Promise<ExternalRunSnapshot>;cancel?(run:ExternalRun):Promise<CancelResult>;close?():Promise<void>}
export const toDelegationStatus=(status:ExecutionStatus):DelegationStatus=>status==="interrupted"?"failed":status
