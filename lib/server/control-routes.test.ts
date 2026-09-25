import {after,before,describe,it} from "node:test"
import assert from "node:assert/strict"
import {NextRequest} from "next/server"
import {sessionValue} from "./auth"
import {openDatabase,setDatabaseForTests} from "./database"
import {GET,PUT} from "../../app/api/control/state/route"
import {POST as preview} from "../../app/api/control/preview/route"
const url="http://localhost/api/control", mutation={origin:"http://localhost",host:"localhost","content-type":"application/json"}
describe("control-plane routes",()=>{before(()=>{process.env.NODEPAD_API_TOKEN="control-secret";setDatabaseForTests(openDatabase(":memory:"))});after(()=>setDatabaseForTests(undefined));const auth=()=>({...mutation,cookie:`nodepad_hub_session=${sessionValue()}`})
 it("requires Hub authentication",async()=>{const r=GET(new NextRequest(`${url}/state`));assert.equal(r.status,401);assert.equal((await r.json()).error.code,"AUTH_REQUIRED")})
 it("supports validated CRUD state, conflicts, preview, and structured errors",async()=>{const empty={revision:0,agents:[],rules:[],assignments:[],delegations:[]};let r=await PUT(new NextRequest(`${url}/state`,{method:"PUT",headers:auth(),body:JSON.stringify({state:empty,expectedRevision:0})}));assert.equal(r.status,200);assert.equal((await r.json()).revision,1);r=await PUT(new NextRequest(`${url}/state`,{method:"PUT",headers:auth(),body:JSON.stringify({state:empty,expectedRevision:0})}));assert.equal(r.status,409);assert.equal((await r.json()).error.code,"REVISION_CONFLICT");r=await PUT(new NextRequest(`${url}/state`,{method:"PUT",headers:auth(),body:JSON.stringify({state:{...empty,revision:1,agents:[{id:"bad"}]},expectedRevision:1})}));assert.equal(r.status,400);assert.equal((await r.json()).error.code,"INVALID_PAYLOAD");const p=await preview(new NextRequest(`${url}/preview`,{method:"POST",headers:auth(),body:JSON.stringify({requiresCode:true})}));assert.equal(p.status,200);assert.deepEqual((await p.json()).eligibleAgentIds,[])})
})
