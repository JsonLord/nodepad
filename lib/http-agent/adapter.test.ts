import {afterEach,describe,it} from "node:test"
import assert from "node:assert/strict"
import {createServer} from "node:http"
import type {AddressInfo} from "node:net"
import {HttpExecutionAdapter,parseHttpAgentConfig} from "./adapter"
import type {AgentProfile} from "../control-plane/types"

const previous={hosts:process.env.HTTP_AGENT_ALLOWED_HOSTS,private:process.env.HTTP_AGENT_ALLOW_PRIVATE_NETWORKS,token:process.env.WORKER_TOKEN}
afterEach(()=>{for(const [key,value] of Object.entries(previous)){const name=key==="hosts"?"HTTP_AGENT_ALLOWED_HOSTS":key==="private"?"HTTP_AGENT_ALLOW_PRIVATE_NETWORKS":"WORKER_TOKEN";if(value===undefined)delete process.env[name];else process.env[name]=value}})
const profile=(baseUrl:string,overrides:Record<string,unknown>={}):AgentProfile=>({id:"http-agent",name:"HTTP",adapterType:"http",enabled:true,locality:"remote",capabilities:["research"],maxConcurrency:1,config:{baseUrl,credentialRef:"env:WORKER_TOKEN",...overrides},revision:1,createdAt:1,updatedAt:1})

describe("HTTP execution adapter",()=>{
  it("rejects invalid schemes, embedded credentials, paths, unapproved hosts and private targets",async()=>{
    assert.throws(()=>parseHttpAgentConfig(profile("file:///tmp/worker")),/INVALID_SCHEME/)
    assert.throws(()=>parseHttpAgentConfig(profile("https://user:pass@example.com")),/CREDENTIALS_FORBIDDEN/)
    assert.throws(()=>parseHttpAgentConfig(profile("https://example.com",{submitPath:"https://evil.test/runs"})),/INVALID_PATH/)
    const adapter=new HttpExecutionAdapter(async()=>new Response("{}") as never)
    assert.equal((await adapter.health(profile("https://example.com"))).message,"HTTP_AGENT_HOST_NOT_ALLOWED")
    process.env.HTTP_AGENT_ALLOWED_HOSTS="127.0.0.1"
    assert.equal((await adapter.health(profile("http://127.0.0.1"))).message,"HTTP_AGENT_PRIVATE_NETWORK_FORBIDDEN")
  })

  it("validates live dispatch, bearer auth, idempotency, reconcile, artifacts and cancellation",async()=>{
    let submissions=0,authorization="",idempotency="",body:Record<string,unknown>={}
    const server=createServer(async(req,res)=>{let raw="";for await(const chunk of req)raw+=chunk;if(req.url==="/health")return void res.end('{"ok":true}');if(req.url==="/runs"&&req.method==="POST"){submissions++;authorization=String(req.headers.authorization??"");idempotency=String(req.headers["idempotency-key"]??"");body=JSON.parse(raw);return void res.end('{"runId":"worker-1","status":"queued"}')}if(req.url==="/runs/worker-1"&&req.method==="GET")return void res.end('{"runId":"worker-1","status":"succeeded","requiresHumanInput":false,"artifacts":[{"type":"report","label":"Result","externalRef":"worker://report/1"}]}');if(req.url==="/runs/worker-1/cancel"&&req.method==="POST")return void res.end('{"status":"cancelled"}');res.statusCode=404;res.end('{}')})
    await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));const port=(server.address() as AddressInfo).port
    process.env.HTTP_AGENT_ALLOWED_HOSTS="127.0.0.1";process.env.HTTP_AGENT_ALLOW_PRIVATE_NETWORKS="true";process.env.WORKER_TOKEN="secret-token"
    const agent=profile(`http://127.0.0.1:${port}`),adapter=new HttpExecutionAdapter()
    assert.equal((await adapter.health(agent)).status,"ready")
    const run=await adapter.dispatch({delegationId:"delegation",taskId:"task",projectId:"project",instruction:"Research",context:{safe:true},constraints:{private:false},profile:agent})
    assert.equal(submissions,1);assert.equal(authorization,"Bearer secret-token");assert.equal(idempotency,"delegation");assert.equal(body.delegationId,"delegation");assert.ok(!JSON.stringify(run).includes("secret-token"))
    const snapshot=await adapter.reconcile(run);assert.equal(snapshot.status,"succeeded");assert.equal(snapshot.artifacts?.[0].externalRef,"worker://report/1")
    assert.equal((await adapter.cancel(run)).status,"cancelled")
    await new Promise<void>(resolve=>server.close(()=>resolve()))
  })

  it("supports explicit no-cancel profiles and bounds artifact responses",async()=>{
    process.env.HTTP_AGENT_ALLOWED_HOSTS="worker.test";process.env.HTTP_AGENT_ALLOW_PRIVATE_NETWORKS="true";process.env.WORKER_TOKEN="token"
    const adapter=new HttpExecutionAdapter(async()=>new Response(JSON.stringify({status:"running",artifacts:Array.from({length:101},(_,index)=>({type:"log",label:String(index)}))})) as never)
    const config=parseHttpAgentConfig(profile("https://worker.test",{cancelPath:null})),run={id:"r",delegationId:"d",provider:"http" as const,externalRunId:"e",createdAt:1,updatedAt:1,metadata:{httpConfig:config}}
    assert.equal((await adapter.cancel(run)).status,"unsupported")
    assert.equal((await adapter.reconcile(run)).artifacts?.length,100)
  })
})
