import type {DatabaseSync} from "node:sqlite"
import {ControlPlaneRepository} from "../server/control-plane-repository"
import {ExecutionRepository} from "../server/execution-repository"
import type {Delegation} from "../control-plane/types"
import {ExecutionAdapterRegistry} from "./registry"
import {toDelegationStatus,type CancelResult,type ExternalRun} from "./types"

export interface DispatchResult {delegationId:string;externalRunId:string;status:string;idempotent:boolean}
export interface DelegationDispatcher {dispatch(delegationId:string):Promise<DispatchResult>;reconcile(delegationId:string):Promise<Delegation>;cancel(delegationId:string):Promise<CancelResult>}

export class GenericDelegationDispatcher implements DelegationDispatcher {
  private executions:ExecutionRepository
  constructor(private db:DatabaseSync,private adapters:ExecutionAdapterRegistry){this.executions=new ExecutionRepository(db)}
  async dispatch(id:string):Promise<DispatchResult>{
    const state=new ControlPlaneRepository(this.db).load(),delegation=state.delegations.find(item=>item.id===id)
    if(!delegation)throw new Error("DELEGATION_NOT_FOUND")
    const existing=this.executions.getRunForDelegation(id)
    if(existing)return{delegationId:id,externalRunId:existing.externalRunId,status:delegation.status,idempotent:true}
    if(delegation.status!=="queued"||!delegation.dispatchAuthorizedAt||!delegation.agentProfileId||!delegation.routingDecisionId)throw new Error("DISPATCH_PRECONDITION_FAILED")
    const profile=state.agents.find(item=>item.id===delegation.agentProfileId)
    if(!profile?.enabled)throw new Error("AGENT_DISABLED")
    const decision=this.db.prepare("SELECT selected_agent_id,decision FROM routing_decisions WHERE id=?").get(delegation.routingDecisionId) as {selected_agent_id:string|null;decision:string}|undefined
    if(!decision||decision.selected_agent_id!==profile.id||!["deterministic","selected"].includes(decision.decision))throw new Error("ROUTING_DECISION_INVALID")
    const adapter=this.adapters.get(profile.adapterType)
    this.executions.addEvent({delegationId:id,provider:adapter.adapterType,eventType:"dispatch_started"},"dispatch_started")
    const run=await adapter.dispatch({delegationId:id,taskId:delegation.taskEntityId,projectId:delegation.projectEntityId,instruction:delegation.request.instruction,context:{entityIds:delegation.request.contextEntityIds??[],artifactRefs:delegation.request.artifactRefs??[]},constraints:delegation.request.constraints??{},profile})
    if(run.delegationId!==id||run.provider!==adapter.adapterType||!run.externalRunId)throw new Error("INVALID_EXTERNAL_RUN")
    this.executions.createRun(run)
    this.executions.addEvent({delegationId:id,provider:run.provider,eventType:"external_run_created",providerStatus:run.providerStatus,metadata:{externalRunId:run.externalRunId}},`external_run_created:${run.externalRunId}`)
    const updated=this.executions.updateDelegation(delegation,"starting",run)
    return{delegationId:id,externalRunId:run.externalRunId,status:updated.status,idempotent:false}
  }
  async reconcile(id:string){const state=new ControlPlaneRepository(this.db).load(),delegation=state.delegations.find(item=>item.id===id);if(!delegation)throw new Error("DELEGATION_NOT_FOUND");const run=this.executions.getRunForDelegation(id);if(!run)throw new Error("EXTERNAL_RUN_MISSING");const adapter=this.adapters.get(run.provider);let snapshot;try{snapshot=await adapter.reconcile(run)}catch(error){return this.executions.updateDelegation(delegation,"waiting_for_agent",run,error instanceof Error?error.message:"Provider unavailable")};const now=Date.now(),terminal=["succeeded","failed","cancelled"].includes(snapshot.status),next:ExternalRun={...run,providerStatus:snapshot.providerStatus,updatedAt:now,finishedAt:terminal?(run.finishedAt??now):run.finishedAt,metadata:{...run.metadata,...snapshot.metadata}};this.executions.updateRun(next);for(const artifact of snapshot.artifacts??[])this.executions.addArtifact({...artifact,delegationId:id,provider:run.provider});const status=toDelegationStatus(snapshot.status),eventType=status==="review"?"review_ready":status==="succeeded"?"completed":status==="failed"?"failed":status==="waiting_for_human"?"waiting_for_human":"reconciled";this.executions.addEvent({delegationId:id,provider:run.provider,eventType,providerStatus:snapshot.providerStatus,message:snapshot.diagnostic},`${eventType}:${snapshot.providerStatus??snapshot.status}`);return this.executions.updateDelegation(delegation,status,next,snapshot.diagnostic)}
  async cancel(id:string):Promise<CancelResult>{const run=this.executions.getRunForDelegation(id);if(!run)throw new Error("EXTERNAL_RUN_MISSING");const adapter=this.adapters.get(run.provider);if(!adapter.cancel)return{status:"unsupported",message:"CANCELLATION_NOT_SUPPORTED"};this.executions.addEvent({delegationId:id,provider:run.provider,eventType:"cancel_requested"},`cancel_requested:${run.externalRunId}`);return adapter.cancel(run)}
}
