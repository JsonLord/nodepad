import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { NextRequest } from "next/server"
import { POST as login } from "../app/api/auth/login/route"
import { nodepadStore } from "../lib/server"
import { POST as mutation } from "../app/api/v1/[...path]/route"
import { createSession, isAuthenticated, loginRetryAfter, recordLoginFailure, SESSION_COOKIE } from "../lib/auth/server"

test("AUTH-05/API-02 malformed/empty login and limiter do not invalidate existing sessions", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "predeploy-routes-"))
  const names = ["NODEPAD_LOGIN_KEY", "NODEPAD_AUTH_DIR", "NODEPAD_API_KEY"]
  const before = names.map(name => process.env[name])
  Object.assign(process.env, { NODEPAD_LOGIN_KEY: "routes-human-fixture", NODEPAD_AUTH_DIR: dir, NODEPAD_API_KEY: "routes-machine-fixture" })
  try {
    const token = createSession()
    for (const body of ["{", "{}", '{"accessKey":""}']) {
      const result = await login(new NextRequest("http://localhost/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body }))
      assert.equal(result.status, 401)
      assert.deepEqual(await result.json(), { error: "Invalid access key." })
    }
    for (let i = 0; i < 5; i++) recordLoginFailure("fixture-ip")
    assert.ok(loginRetryAfter("fixture-ip") > 0)
    assert.equal(isAuthenticated(new NextRequest("http://localhost/", { headers: { Cookie: `${SESSION_COOKIE}=${token}` } })), true)
  } finally {
    names.forEach((name, i) => { if (before[i] === undefined) delete process.env[name]; else process.env[name] = before[i] })
    rmSync(dir, { recursive: true, force: true })
  }
})
test("SEC-05 oversized chunked mutations rejected without Content-Length", async () => {
  const previous = process.env.NODEPAD_API_KEY
  const previousRoot = nodepadStore.root
  const temporary = mkdtempSync(path.join(tmpdir(), "predeploy-body-"))
  nodepadStore.root = temporary
  process.env.NODEPAD_API_KEY = "routes-machine-fixture"
  try {
    const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(JSON.stringify({ claim: "x".repeat(1_000_001) }))); controller.close() } })
    const req = new NextRequest("http://localhost/api/v1/workspaces/oversized/evidence", { method: "POST", headers: { Authorization: "Bearer routes-machine-fixture", "Content-Type": "application/json" }, body, duplex: "half" } as ConstructorParameters<typeof NextRequest>[1])
    assert.equal(req.headers.has("content-length"), false)
    const response = await mutation(req, { params: Promise.resolve({ path: ["workspaces", "oversized", "evidence"] }) })
    assert.equal(response.status, 400)
    assert.equal((await response.json()).error, "request_body_too_large")
  } finally { nodepadStore.root = previousRoot; rmSync(temporary, { recursive: true, force: true }); if (previous === undefined) delete process.env.NODEPAD_API_KEY; else process.env.NODEPAD_API_KEY = previous }
})
