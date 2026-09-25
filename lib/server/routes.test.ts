import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { NextRequest } from "next/server"
import { openDatabase, setDatabaseForTests } from "./database"
import { sessionValue } from "./auth"
import { POST as login, DELETE as logout } from "../../app/api/hub/auth/route"
import { GET as health } from "../../app/api/hub/health/route"
import { GET as getState, PUT as putState } from "../../app/api/hub/state/route"
import { GET as getSession } from "../../app/api/hub/session/route"

const url = "http://localhost/api/hub"
const mutationHeaders = { origin: "http://localhost", host: "localhost", "content-type": "application/json" }
const cookie = () => `nodepad_hub_session=${sessionValue()}`
const state = (revision?: number) => ({ version:2, activeWorkspaceId:"w", savedAt:1, workspaces:[{ id:"w", name:"W", revision, entities:[], edges:[], collapsedIds:[], ghostNotes:[] }] })

describe("Hub route handlers", () => {
  before(() => { process.env.NODEPAD_API_TOKEN="route-secret"; process.env.NODEPAD_DB_PATH=":memory:"; setDatabaseForTests(openDatabase(":memory:")) })
  after(() => setDatabaseForTests(undefined))

  it("returns structured auth errors, a secure session cookie, and clears logout", async () => {
    const wrong = await login(new NextRequest(`${url}/auth`, { method:"POST", headers:mutationHeaders, body:JSON.stringify({token:"wrong"}) }))
    assert.equal(wrong.status, 401); assert.equal((await wrong.json()).error.code, "INVALID_AUTH")
    process.env.NODEPAD_COOKIE_SECURE="true"
    const ok = await login(new NextRequest(`${url}/auth`, { method:"POST", headers:mutationHeaders, body:JSON.stringify({token:"route-secret"}) }))
    delete process.env.NODEPAD_COOKIE_SECURE
    const setCookie = ok.headers.get("set-cookie") ?? ""
    assert.match(setCookie, /HttpOnly/i); assert.match(setCookie, /SameSite=strict/i); assert.match(setCookie, /Path=\//i); assert.match(setCookie, /Secure/i)
    assert.deepEqual(await getSession(new NextRequest(`${url}/session`, { headers:{ cookie:cookie() } })).json(), { authenticated:true })
    assert.deepEqual(await getSession(new NextRequest(`${url}/session`)).json(), { authenticated:false })
    const out = logout(new NextRequest(`${url}/auth`, { method:"DELETE", headers:{ origin:"http://localhost", host:"localhost" } }))
    assert.match(out.headers.get("set-cookie") ?? "", /Expires=Thu, 01 Jan 1970/i)
  })

  it("rejects cross-origin and oversized mutations", async () => {
    const cross = await login(new NextRequest(`${url}/auth`, { method:"POST", headers:{ origin:"https://evil.example", host:"localhost", "content-type":"application/json" }, body:"{}" }))
    assert.equal(cross.status,403); assert.equal((await cross.json()).error.code,"CROSS_ORIGIN_REQUEST")
    const prior=process.env.NODEPAD_MAX_REQUEST_BYTES; process.env.NODEPAD_MAX_REQUEST_BYTES="10"
    const large = await putState(new NextRequest(`${url}/state`, { method:"PUT", headers:{...mutationHeaders,cookie:cookie()}, body:JSON.stringify({state:state(),expectedRevisions:{}}) }))
    process.env.NODEPAD_MAX_REQUEST_BYTES=prior
    assert.equal(large.status,413); assert.equal((await large.json()).error.code,"REQUEST_TOO_LARGE")
  })

  it("requires a session and persists, rejects stale, and rejects invalid state", async () => {
    const unauthorized=getState(new NextRequest(`${url}/state`)); assert.equal(unauthorized.status,401); assert.equal((await unauthorized.json()).error.code,"AUTH_REQUIRED")
    const headers={...mutationHeaders,cookie:cookie()}
    const saved=await putState(new NextRequest(`${url}/state`,{method:"PUT",headers,body:JSON.stringify({state:state(),expectedRevisions:{}})})); assert.equal(saved.status,200)
    const loaded=getState(new NextRequest(`${url}/state`,{headers:{cookie:cookie()}})); assert.equal((await loaded.json()).workspaces[0].revision,1)
    const stale=await putState(new NextRequest(`${url}/state`,{method:"PUT",headers,body:JSON.stringify({state:state(0),expectedRevisions:{w:0}})})); assert.equal(stale.status,409); assert.equal((await stale.json()).error.code,"REVISION_CONFLICT")
    const invalid=await putState(new NextRequest(`${url}/state`,{method:"PUT",headers,body:JSON.stringify({state:{version:2},expectedRevisions:{w:1}})})); assert.equal(invalid.status,400); assert.equal((await invalid.json()).error.code,"INVALID_PAYLOAD")
  })

  it("reports safe health metadata", async () => {
    const response=health(); const body=await response.json(); assert.equal(response.status,200); assert.deepEqual(body,{status:"ok",database:"ready",schemaVersion:4,writable:true})
  })
})
