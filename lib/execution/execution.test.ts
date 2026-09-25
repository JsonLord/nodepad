import {describe,it} from "node:test"
import assert from "node:assert/strict"
import {openDatabase} from "../server/database"
import {ExecutionRepository} from "../server/execution-repository"
import {ExecutionAdapterError,ExecutionAdapterRegistry} from "./registry"
import {GenericDelegationDispatcher} from "./dispatcher"
import type {ExecutionAdapter,ExternalRun} from "./types"

const adapter=(adapterType:"agtx"|"http"|"local_cli"):ExecutionAdapter=>({adapterType,async health(){return{status:"ready"}},async dispatch(request){return{id:"run",delegationId:request.delegationId,provider:adapterType,externalRunId:"external",createdAt:1,updatedAt:1}},async reconcile(run){return{externalRunId:run.externalRunId,status:"running"}}})

describe("provider-neutral execution core",()=>{
  it("selects only registered and server-enabled executable adapters",()=>{
    const registry=new ExecutionAdapterRegistry(new Set(["agtx"])).register(adapter("agtx")).register(adapter("http"))
    assert.equal(registry.get("agtx").adapterType,"agtx")
    assert.throws(()=>registry.get("http"),error=>error instanceof ExecutionAdapterError&&error.code==="EXECUTION_ADAPTER_NOT_ENABLED")
    assert.throws(()=>registry.get("hermes"),/EXECUTION_ADAPTER_NOT_ENABLED/)
  })

  it("persists generic runs, events and artifact references without fetching artifacts",()=>{
    const db=openDatabase(":memory:")
    db.prepare("INSERT INTO agent_profiles(id,enabled,adapter_type,created_at,updated_at,payload_json) VALUES('agent',1,'agtx',1,1,'{}')").run()
    db.prepare("INSERT INTO delegations(id,agent_profile_id,status,created_at,updated_at,payload_json) VALUES('delegation','agent','queued',1,1,?)").run(JSON.stringify({id:"delegation",status:"queued",requestedBy:"user",request:{instruction:"x"},createdAt:1,updatedAt:1}))
    const repository=new ExecutionRepository(db),run:ExternalRun={id:"run",delegationId:"delegation",provider:"agtx",externalRunId:"native-1",providerStatus:"planning",createdAt:1,updatedAt:1,metadata:{phase:"Planning"}}
    repository.createRun(run)
    assert.deepEqual(repository.getRunForDelegation("delegation"),{...run,startedAt:undefined,finishedAt:undefined})
    repository.addEvent({delegationId:"delegation",provider:"agtx",eventType:"external_run_created",providerStatus:"planning"},"created:native-1")
    const artifact=repository.addArtifact({delegationId:"delegation",provider:"agtx",type:"diff",label:"Review diff",externalRef:"agtx://native-1/diff",metadata:{bytes:123}})
    assert.equal(repository.artifacts("delegation")[0].externalRef,artifact.externalRef)
    assert.equal((db.prepare("SELECT COUNT(*) count FROM delegation_events").get() as {count:number}).count,1)
    db.close()
  })

  it("migrates legacy delegation external identity without loss",()=>{
    const db=openDatabase(":memory:")
    db.prepare("INSERT INTO agent_profiles(id,enabled,adapter_type,created_at,updated_at,payload_json) VALUES('agent',1,'agtx',1,1,'{}')").run()
    const legacy={id:"legacy",agentProfileId:"agent",status:"running",requestedBy:"user",request:{instruction:"x"},externalProvider:"agtx",externalRunId:"agtx-task",lastExternalStatus:"Running",createdAt:10,updatedAt:20,startedAt:15}
    db.prepare("INSERT INTO delegations(id,agent_profile_id,status,created_at,updated_at,payload_json) VALUES('legacy','agent','running',10,20,?)").run(JSON.stringify(legacy))
    const repository=new ExecutionRepository(db)
    const migrated=repository.getRunForDelegation("legacy")!
    assert.equal(migrated.externalRunId,"agtx-task")
    assert.equal(migrated.providerStatus,"Running")
    assert.equal(migrated.metadata?.migratedFromDelegation,true)
    db.close()
  })

  it("preserves authorization, dispatch idempotency, reconciliation and native status",async()=>{
    const db=openDatabase(":memory:"),now=Date.now(),profile={id:"agent",name:"Agent",adapterType:"http" as const,enabled:true,locality:"remote" as const,capabilities:["research" as const],maxConcurrency:1,config:{},revision:1,createdAt:now,updatedAt:now}
    db.prepare("INSERT INTO agent_profiles(id,enabled,adapter_type,created_at,updated_at,payload_json) VALUES(?,?,?,?,?,?)").run(profile.id,1,"http",now,now,JSON.stringify(profile))
    db.prepare("INSERT INTO routing_decisions(id,selected_agent_id,decision,decision_source,control_plane_revision,created_at,payload_json) VALUES('decision','agent','selected','laya',0,?,?)").run(now,JSON.stringify({decisionId:"decision",selectedAgentId:"agent",eligibleAgentIds:["agent"],probabilities:{agent:1},decision:"selected",decisionSource:"laya",filteredAgents:[],matchedRuleIds:[],controlPlaneRevision:0,createdAt:now}))
    const delegation={id:"delegation",requestedBy:"user" as const,agentProfileId:"agent",routingDecisionId:"decision",status:"queued" as const,request:{instruction:"Research"},dispatchAuthorizedAt:now,dispatchAuthorizedBy:"user" as const,createdAt:now,updatedAt:now}
    db.prepare("INSERT INTO delegations(id,agent_profile_id,status,created_at,updated_at,payload_json) VALUES(?,?,?,?,?,?)").run(delegation.id,"agent","queued",now,now,JSON.stringify(delegation))
    let reconciles=0
    const http:ExecutionAdapter={...adapter("http"),async reconcile(run){reconciles++;return{externalRunId:run.externalRunId,status:"succeeded",providerStatus:"worker.complete",artifacts:[{type:"report",label:"Report",externalRef:"worker://report"}]}}}
    const registry=new ExecutionAdapterRegistry().register(http),first=new GenericDelegationDispatcher(db,registry)
    assert.equal((await first.dispatch("delegation")).idempotent,false)
    assert.equal((await new GenericDelegationDispatcher(db,registry).dispatch("delegation")).idempotent,true)
    const completed=await new GenericDelegationDispatcher(db,registry).reconcile("delegation")
    assert.equal(completed.status,"succeeded");assert.equal(completed.lastExternalStatus,"worker.complete");assert.equal(reconciles,1)
    assert.equal(new ExecutionRepository(db).artifacts("delegation")[0].type,"report")
    db.close()
  })
})
