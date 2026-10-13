import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { NextRequest } from "next/server"
import { createSession, validateSession, invalidateSession, isAuthenticated, requireAuth, SESSION_COOKIE, SESSION_MAX_AGE, sessionCookieOptions, timingSafeMatch, clientIp, loginRetryAfter } from "../lib/auth/server"
import { POST as login } from "../app/api/auth/login/route"
import { POST as logout } from "../app/api/auth/logout/route"
import { GET as status } from "../app/api/auth/status/route"
import { GET as dataGet } from "../app/api/v1/[...path]/route"
import { GET as modelsGet } from "../app/api/v1/llm/models/route"
import { proxy } from "../proxy"
import { serializeWorkspace } from "../lib/github-sync/serialization"
import { fixture } from "./helpers"
import { loginReducer } from "../components/login-view"

const request = (url: string, init: NonNullable<ConstructorParameters<typeof NextRequest>[1]> = {}) => new NextRequest(`http://localhost${url}`, init)
const loginRequest = (accessKey: string, ip = "192.0.2.10") => request("/api/auth/login", {
  method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ip, Origin: "http://localhost" }, body: JSON.stringify({ accessKey }),
})

// Configuration mutations are scoped; tests in other files run in separate workers.
test("Nodepad human sessions and machine bearer authentication", async t => {
  const names = ["NODEPAD_LOGIN_KEY", "NODEPAD_API_KEY", "NODEPAD_AUTH_DIR", "NODEPAD_TRUST_PROXY", "NODE_ENV", "OPENAI_URL", "OPENAI_MODEL", "OPENAI_API"]
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]))
  const mutableEnv = process.env as Record<string, string | undefined>
  const directory = mkdtempSync(path.join(tmpdir(), "nodepad-auth-test-"))
  process.env.NODEPAD_LOGIN_KEY = "human-test-key"
  process.env.NODEPAD_API_KEY = "machine-test-key"
  process.env.NODEPAD_AUTH_DIR = directory
  process.env.NODEPAD_TRUST_PROXY = "true"
  mutableEnv.NODE_ENV = "production"
  delete process.env.OPENAI_URL
  delete process.env.OPENAI_MODEL
  let cookie = ""
  let token = ""
  try {
    await t.test("public login, health and docs; anonymous app and all workspace/brain GETs blocked", async () => {
      assert.equal(proxy(request("/"))?.status, 307)
      assert.equal(proxy(request("/"))?.headers.get("location"), "http://localhost/login")
      for (const url of ["/login", "/health", "/api-docs", "/api/auth/status", "/api/auth/login", "/api/auth/logout"]) assert.equal(proxy(request(url))?.status, 200)
      for (const url of ["/api/v1/portfolio", "/api/v1/workspaces", "/api/v1/workspaces/test/brain", "/api/v1/workspaces/test/context", "/api/v1/llm/status", "/api/v1/llm/models", "/api/v1/config", "/api/fetch-url"]) assert.equal(proxy(request(url))?.status, 401)
      assert.equal((await dataGet(request("/api/v1/workspaces/test/brain"), { params: Promise.resolve({ path: ["workspaces", "test", "brain"] }) })).status, 401)
      assert.deepEqual(await (await status(request("/api/auth/status"))).json(), { authenticated: false, required: true })
    })
    await t.test("only human login key works; successful response has HttpOnly Secure Lax expiring cookie, no secrets", async () => {
      assert.equal((await login(loginRequest("wrong-key"))).status, 401)
      assert.equal((await login(loginRequest("machine-test-key"))).status, 401)
      const response = await login(loginRequest("human-test-key"))
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { success: true })
      const header = response.headers.get("set-cookie") || ""
      for (const property of ["HttpOnly", "Secure", "SameSite=lax", "Path=/", `Max-Age=${SESSION_MAX_AGE}`]) assert.ok(header.includes(property))
      token = response.cookies.get(SESSION_COOKIE)!.value
      cookie = `${SESSION_COOKIE}=${token}`
      assert.equal(validateSession(token), true)
      const files = readdirSync(directory)
      assert.equal(files.length, 1)
      assert.equal(statSync(path.join(directory, files[0])).mode & 0o777, 0o600)
      assert.equal(readFileSync(path.join(directory, files[0]), "utf8").includes(token), false)
      assert.equal(files[0].includes(token), false)
      assert.equal(sessionCookieOptions().secure, true)
      mutableEnv.NODE_ENV = "development"
      assert.equal(sessionCookieOptions().secure, false)
      mutableEnv.NODE_ENV = "production"
    })
    await t.test("browser cookie and separate bearer can access APIs; missing, invalid and login-key bearers cannot", async () => {
      for (const headers of [{ Cookie: cookie }, { Authorization: "Bearer machine-test-key" }] as Record<string, string>[]) {
        const req = request("/api/v1/workspaces/test/brain", { headers })
        assert.equal(isAuthenticated(req), true)
        assert.equal(requireAuth(req), null)
        assert.equal(proxy(request("/", { headers }))?.status, 200)
        assert.equal((await dataGet(req, { params: Promise.resolve({ path: ["workspaces", "test", "brain"] }) })).status, 200)
        assert.equal((await modelsGet(request("/api/v1/llm/models", { headers }))).status, 200)
        assert.equal((await (await status(request("/api/auth/status", { headers }))).json()).authenticated, true)
      }
      for (const headers of [{ Authorization: "Bearer human-test-key" }, { Authorization: "Bearer bad" }, { Cookie: "nodepad_session=bad" }] as Record<string, string>[]) assert.equal(isAuthenticated(request("/", { headers })), false)
    })
    await t.test("cookie mutations and login reject foreign origins; bearer automation still works", async () => {
      const crossSite = { method: "POST", headers: { Cookie: cookie, Origin: "https://evil.example" } }
      assert.equal(requireAuth(request("/api/v1/workspaces/test/evidence", crossSite))?.status, 403)
      assert.equal((await logout(request("/api/auth/logout", crossSite))).status, 403)
      assert.equal((await login(request("/api/auth/login", { ...crossSite, body: '{"accessKey":"human-test-key"}' }))).status, 403)
      assert.equal(requireAuth(request("/api/v1/workspaces/test/evidence", { method: "POST", headers: { Authorization: "Bearer machine-test-key", Origin: "https://machine.example" } })), null)
    })
    await t.test("logout revokes copied cookie immediately", async () => {
      const response = await logout(request("/api/auth/logout", { method: "POST", headers: { Cookie: cookie, Origin: "http://localhost" } }))
      assert.equal(response.status, 200)
      assert.ok(response.headers.get("set-cookie")?.includes("Max-Age=0"))
      assert.equal(isAuthenticated(request("/", { headers: { Cookie: cookie } })), false)
      assert.equal(validateSession(token), false)
    })
    await t.test("five failures per minute then 429; spoofed prefix cannot change trusted rightmost IP", async () => {
      for (let i = 0; i < 5; i++) assert.equal((await login(loginRequest("wrong", `203.0.113.${i}, 192.0.2.11`))).status, 401)
      const response = await login(loginRequest("human-test-key", "203.0.113.99, 192.0.2.11"))
      assert.equal(response.status, 429)
      assert.ok(Number(response.headers.get("retry-after")) > 0)
      assert.equal(loginRetryAfter("192.0.2.11", Date.now() + 61_000), 0)
      process.env.NODEPAD_TRUST_PROXY = "false"
      assert.equal(clientIp(loginRequest("x", "192.0.2.99")), "unknown")
      process.env.NODEPAD_TRUST_PROXY = "true"
    })
    await t.test("concurrent login failures cannot bypass the five-attempt limiter", async () => {
      const responses = await Promise.all(Array.from({ length: 20 }, () => login(loginRequest("wrong", "192.0.2.13"))))
      assert.equal(responses.filter(r => r.status === 401).length, 5)
      assert.equal(responses.filter(r => r.status === 429).length, 15)
    })
    await t.test("expiry, forged tokens and key rotation invalidate sessions; absent keys fail closed", async () => {
      const expiring = createSession()
      assert.equal(validateSession(expiring, Date.now() + SESSION_MAX_AGE * 1000 + 1), false)
      assert.equal(validateSession("../sessions"), false)
      process.env.NODEPAD_LOGIN_KEY = "rotated-human-key"
      assert.equal(validateSession(expiring), false)
      process.env.NODEPAD_LOGIN_KEY = "human-test-key"
      invalidateSession(expiring)
      delete process.env.NODEPAD_LOGIN_KEY
      assert.equal((await login(loginRequest("human-test-key", "192.0.2.12"))).status, 503)
      assert.equal(isAuthenticated(request("/", { headers: { Authorization: "Bearer machine-test-key" } })), true)
      delete process.env.NODEPAD_API_KEY
      assert.equal(isAuthenticated(request("/")), false)
      assert.equal(timingSafeMatch("", undefined), false)
      assert.equal(timingSafeMatch("short", "longer"), false)
      process.env.NODEPAD_LOGIN_KEY = "human-test-key"
    })
    await t.test("human login keys never enter serialized brain/workspace metadata", () => {
      const workspace = fixture()
      workspace.nodes.push({ id: "auth-test", workspaceId: workspace.id, title: "test", kind: "observation", body: "safe", metadata: { NODEPAD_LOGIN_KEY: "human-test-key", loginKey: "human-test-key", accessKey: "human-test-key", sessionCookie: cookie }, version: 1, createdAt: workspace.createdAt, updatedAt: workspace.updatedAt, provenance: { origin: "human", createdAt: workspace.createdAt } })
      const serialized = JSON.stringify(serializeWorkspace(workspace))
      assert.equal(serialized.includes("human-test-key"), false)
      assert.equal(serialized.includes(token), false)
    })
    await t.test("login reducer discards human key after authentication or error; supports retry", () => {
      const ready = loginReducer({ phase: "checking_server", attempt: 1, generation: 0 }, { type: "AUTH_REQUIRED" })
      const entered = loginReducer(ready, { type: "UPDATE_KEY", value: "human-test-key" })
      const logging = loginReducer(entered, { type: "SUBMIT" })
      assert.equal(JSON.stringify(loginReducer(logging, { type: "AUTH_VALID" })).includes("human-test-key"), false)
      assert.equal(JSON.stringify(loginReducer(logging, { type: "LOGIN_ERROR", message: "Invalid access key." })).includes("human-test-key"), false)
      assert.equal(loginReducer({ phase: "server_error", message: "Offline" }, { type: "RETRY" }).phase, "checking_server")
    })
  } finally {
    for (const [name, value] of Object.entries(saved)) { if (value === undefined) delete process.env[name]; else process.env[name] = value }
    rmSync(directory, { recursive: true, force: true })
  }
})
