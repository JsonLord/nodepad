import {afterEach,describe,it} from "node:test"
import assert from "node:assert/strict"
import {join} from "node:path"
import {CommandProfileRegistry,LocalCliExecutionAdapter,type CommandProfile} from "./adapter"
import type {AgentProfile} from "../control-plane/types"
const fixture=join(process.cwd(),"scripts/fixtures/local-agent.mjs"),base:CommandProfile={id:"fixture",executable:process.execPath,args:[fixture],workingDirectoryPolicy:"none",environmentAllowlist:["SHOULD_FAIL"],timeoutMs:2_000,killGraceMs:50,maxConcurrency:1}
const profile=(id="fixture"):AgentProfile=>({id:"local",name:"Local",adapterType:"local_cli",enabled:true,locality:"local",capabilities:["file_read"],maxConcurrency:1,config:{commandProfileId:id},revision:1,createdAt:1,updatedAt:1})
const request=(agent=profile())=>({delegationId:"delegation",taskId:"task",instruction:"Work",context:{},constraints:{},profile:agent})
const wait=()=>new Promise(resolve=>setTimeout(resolve,500))
afterEach(()=>delete process.env.SHOULD_FAIL)
describe("controlled local CLI adapter",()=>{
  it("rejects unknown server-side commands and never accepts a browser command",async()=>{const adapter=new LocalCliExecutionAdapter(new CommandProfileRegistry([base]));await assert.rejects(adapter.dispatch(request(profile("rm -rf /"))),/PROFILE_NOT_FOUND/);assert.equal((await adapter.health({...profile(),config:{executable:"/bin/sh"}})).status,"disabled")})
  it("spawns a known command with the JSONL protocol and preserves reference-only artifacts",async()=>{const adapter=new LocalCliExecutionAdapter(new CommandProfileRegistry([base])),run=await adapter.dispatch(request());await wait();const snapshot=await adapter.reconcile(run);assert.equal(snapshot.status,"succeeded");assert.equal(snapshot.artifacts?.[0].externalRef,"fixture://delegation");await adapter.close()})
  it("separates stderr, reports failure, filters environment, and does not fake restart recovery",async()=>{process.env.SHOULD_FAIL="true";process.env.NODEPAD_SECRET="must-not-inherit";const adapter=new LocalCliExecutionAdapter(new CommandProfileRegistry([base])),run=await adapter.dispatch(request());await wait();const snapshot=await adapter.reconcile(run);assert.equal(snapshot.status,"failed");assert.match(snapshot.diagnostic??"",/fixture failure/);const restarted=new LocalCliExecutionAdapter(new CommandProfileRegistry([base]));assert.equal((await restarted.reconcile(run)).status,"interrupted");delete process.env.NODEPAD_SECRET})
  it("cancels only an owned child and rejects unowned PIDs",async()=>{const slow={...base,args:["-e","setTimeout(()=>{},10000)"],timeoutMs:20_000},adapter=new LocalCliExecutionAdapter(new CommandProfileRegistry([slow])),run=await adapter.dispatch(request());assert.equal((await adapter.cancel(run)).status,"requested");assert.equal((await adapter.cancel({...run,externalRunId:"123"})).message,"CLI_PROCESS_NOT_OWNED");await adapter.close()})
})
