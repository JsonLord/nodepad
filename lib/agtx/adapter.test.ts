import {describe,it} from "node:test"
import assert from "node:assert/strict"
import {AgTxMcpAdapter} from "./adapter"
import type {McpJsonRpcClient} from "./mcp-client"

class FakeClient {
  calls:Array<{name:string;args:Record<string,unknown>}>=[]
  async callTool(name:string,args:Record<string,unknown>={}) {
    this.calls.push({name,args})
    if(name==="list_tasks") return [{id:"task-1",project_id:"repo",title:"Probe",description:"Nodepad delegation: marker",status:"backlog",plugin:"void",allowed_actions:[]}]
    if(name==="wait_for_board_change") return {changed_task_ids:[],transition_outcomes:[]}
    return []
  }
  async close() {}
}

const config={binary:"agtx",mode:"project" as const,executionEnabled:false,requestTimeoutMs:1_000,projectRoots:[]}

describe("AGTX 1.0.6 adapter contract",()=>{
  it("normalizes lowercase native statuses and requests descriptions for correlation recovery",async()=>{
    const client=new FakeClient(),adapter=new AgTxMcpAdapter(client as unknown as McpJsonRpcClient,config)
    const tasks=await adapter.listTasks("repo")
    assert.equal(tasks[0].phase,"Backlog")
    assert.equal(tasks[0].workflow,"void")
    assert.deepEqual(client.calls[0],{name:"list_tasks",args:{project_id:"repo",include_description:true}})
    assert.equal((await adapter.findByCorrelation("repo","marker"))?.id,"task-1")
  })

  it("translates millisecond monitor waits to AGTX timeout_secs",async()=>{
    const client=new FakeClient(),adapter=new AgTxMcpAdapter(client as unknown as McpJsonRpcClient,config)
    await adapter.waitForChange(1_001)
    assert.deepEqual(client.calls[0],{name:"wait_for_board_change",args:{timeout_secs:2}})
  })
})
