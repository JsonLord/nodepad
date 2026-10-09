import assert from "node:assert/strict"
import { spawn, type ChildProcess } from "node:child_process"
import { createServer, type Server } from "node:http"
import { cp, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"

export const FIXTURES = { NODEPAD_LOGIN_KEY: "SUPER_SECRET_LOGIN_928374", NODEPAD_API_KEY: "SUPER_SECRET_NODEPAD_API_928374", OPENAI_API: "SUPER_SECRET_OPENAI_928374" }
export function isolatedEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  for (const name of Object.keys(env)) if (/^(NODEPAD_|OPENAI_|GH_TOKEN$|GITHUB_TOKEN$|HF_TOKEN$|NEXT_PUBLIC_.*(?:KEY|TOKEN|SECRET))/.test(name)) delete env[name]
  return { ...env, ...FIXTURES, NODE_ENV: "production", NODEPAD_GITHUB_SYNC: "false", NODEPAD_MAX_RESEARCH_TASKS_PER_HEARTBEAT: "0", NODEPAD_RESEARCH_ENABLED: "false", NEXT_TELEMETRY_DISABLED: "1" }
}
const secretSafe = (value: string) => Object.values(FIXTURES).every(secret => !value.includes(secret))
const listen = (server: Server, host = "127.0.0.1") => new Promise<number>((resolve, reject) => { server.once("error", reject); server.listen(0, host, () => resolve((server.address() as { port: number }).port)) })
const close = (server: Server) => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()) })
export async function freePort() { const server = createServer(); const port = await listen(server); await close(server); return port }

export async function smoke(docker = false) {
  const root = process.cwd()
  const temporary = await mkdtemp(path.join(tmpdir(), "nodepad-predeploy-"))
  let child: ChildProcess | undefined
  let logs = ""
  let modelVersion = 1
  let discoveryFailure = false
  let completionFailure = false
  const observed: { model: string; authorized: boolean }[] = []
  const groups: Record<string, { passed: number; failed: number; result: string }> = {}
  let group = ""
  const check = (condition: unknown, message: string) => { assert.ok(condition, message); groups[group].passed++ }
  async function section(name: string, action: () => Promise<void>) {
    group = name; groups[name] = { passed: 0, failed: 0, result: "PASS" }
    try { await action(); console.log(`PASS ${name}: ${groups[name].passed} assertions`) }
    catch (error) { groups[name].failed++; groups[name].result = "FAIL"; throw error }
  }
  const provider = createServer(async (req, res) => {
    const authorized = req.headers.authorization === `Bearer ${FIXTURES.OPENAI_API}`
    if (!authorized) { res.writeHead(401).end(); return }
    if (req.url === "/v1/models") {
      res.setHeader("Content-Type", "application/json")
      if (discoveryFailure) { res.writeHead(404).end("unsupported"); return }
      res.end(JSON.stringify({ data: ["model-a", "Spark-X2.5", "Qwen/Qwen3.8-27B-FP8", "strange/custom:model@v2", ...(modelVersion > 1 ? ["model-c"] : [])].map(id => ({ id })) }))
      return
    }
    if (req.url === "/v1/chat/completions") {
      let text = ""; for await (const chunk of req) text += chunk
      const body = JSON.parse(text); observed.push({ model: body.model, authorized })
      if (completionFailure) { res.writeHead(503).end("fixture provider unavailable"); return }
      res.setHeader("Content-Type", "application/json")
      res.end(JSON.stringify({ model: body.model, choices: [{ message: { content: "NODEPAD_LLM_OK" } }] }))
      return
    }
    res.writeHead(404).end()
  })
  let base = ""
  let cookie = ""
  const captures: string[] = []
  async function request(url: string, method = "GET", body?: unknown, auth: "none" | "session" | "machine" | "bad-session" | "bad-machine" | "human-bearer" = "none", extra: Record<string, string> = {}) {
    const headers: Record<string, string> = { ...extra }
    if (auth === "session") headers.Cookie = cookie
    if (auth === "machine") headers.Authorization = `Bearer ${FIXTURES.NODEPAD_API_KEY}`
    if (auth === "bad-machine") headers.Authorization = "Bearer invalid-fixture"
    if (auth === "human-bearer") headers.Authorization = `Bearer ${FIXTURES.NODEPAD_LOGIN_KEY}`
    if (auth === "bad-session") headers.Cookie = "nodepad_session=invalid-fixture"
    if (body !== undefined) headers["Content-Type"] = "application/json"
    const response = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual", signal: AbortSignal.timeout(20_000) })
    const text = await response.text(); captures.push(text)
    let data: any; try { data = JSON.parse(text) } catch { data = text }
    return { response, data, text }
  }
  async function stop() {
    if (!child || child.exitCode !== null || child.signalCode !== null) return
    const exited = new Promise<void>(resolve => child!.once("exit", () => resolve()))
    child.kill("SIGTERM")
    const timer = setTimeout(() => child?.kill("SIGKILL"), 5000)
    await exited; clearTimeout(timer)
  }
  try {
    const providerPort = await listen(provider, docker ? "0.0.0.0" : "127.0.0.1")
    const port = await freePort()
    base = `http://127.0.0.1:${port}`
    const env = { ...isolatedEnv(), NODEPAD_AUTH_DIR: path.join(temporary, "sessions"), NODEPAD_DATA_DIR: path.join(temporary, "data"), OPENAI_URL: `http://127.0.0.1:${providerPort}/v1`, OPENAI_MODEL: "qwythos-9b", PORT: String(port), HOSTNAME: "127.0.0.1" }
    await cp(path.join(root, ".next/static"), path.join(root, ".next/standalone/.next/static"), { recursive: true })
    await cp(path.join(root, "public"), path.join(root, ".next/standalone/public"), { recursive: true })
    const start = () => {
      child = spawn(process.execPath, [path.join(root, ".next/standalone/server.js")], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] })
      child.stdout?.on("data", data => { logs += data.toString() }); child.stderr?.on("data", data => { logs += data.toString() })
    }
    const ready = async () => {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (child?.exitCode !== null) throw new Error("Production server exited before readiness")
        try { if ((await fetch(base + "/health", { signal: AbortSignal.timeout(500) })).ok) return } catch { /* poll readiness */ }
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      throw new Error("Production server did not become ready")
    }
    start(); await ready()
    await section("Authentication", async () => {
      check((await request("/health")).response.status === 200, "health public")
      check((await request("/login")).response.status === 200, "login public")
      check((await request("/api-docs")).response.status === 200, "docs public")
      const anonymous = await request("/")
      check(anonymous.response.status === 307 && new URL(anonymous.response.headers.get("location")!, base).pathname === "/login", "anonymous redirect")
      check((await request("/api/auth/status")).data.authenticated === false, "anonymous status")
      for (const body of [{}, { accessKey: "" }, { accessKey: "wrong" }, { accessKey: FIXTURES.NODEPAD_API_KEY }]) check((await request("/api/auth/login", "POST", body)).response.status === 401, "bad human login")
      const login = await request("/api/auth/login", "POST", { accessKey: FIXTURES.NODEPAD_LOGIN_KEY })
      check(login.response.status === 200 && login.data.success, "human login works")
      const header = login.response.headers.get("set-cookie") || ""
      for (const attribute of ["HttpOnly", "Secure", "Path=/", "SameSite=lax", "Max-Age="]) check(header.includes(attribute), "cookie security attribute")
      cookie = header.split(";")[0]
      check((await request("/", "GET", undefined, "session")).response.status === 200, "authenticated page no redirect loop")
      check((await request("/api/auth/status", "GET", undefined, "session")).data.authenticated === true, "session status")
    })
    await section("Route protection", async () => {
      const routes: [string, string, unknown?][] = [
        ["/api/v1/workspaces", "GET"], ["/api/v1/portfolio", "GET"], ["/api/v1/llm/status", "GET"], ["/api/v1/llm/models", "GET"],
        ...["context", "graph", "evidence", "hypotheses", "brain", "events"].map(name => [`/api/v1/workspaces/matrix/${name}`, "GET"] as [string, string]),
        ["/api/v1/workspaces/matrix/evidence", "POST", { claim: "Matrix evidence" }], ["/api/v1/workspaces/matrix/heartbeat", "POST", { runId: "matrix" }], ["/api/v1/workspaces/matrix/brain/export", "POST", {}],
      ]
      for (const [url, method, body] of routes) for (const auth of ["none", "bad-session", "bad-machine", "human-bearer", "session", "machine"] as const) {
        const result = await request(url, method, body, auth)
        check(auth === "session" || auth === "machine" ? result.response.ok : result.response.status === 401, `protected matrix ${method} ${url} ${auth}`)
      }
    })
    await section("Custom models", async () => {
      const models = await request("/api/v1/llm/models", "GET", undefined, "session")
      check(models.data.defaultModel === "qwythos-9b", "environment default")
      for (const id of ["qwythos-9b", "Spark-X2.5", "Qwen/Qwen3.8-27B-FP8", "strange/custom:model@v2"]) check(models.data.models.some((m: any) => m.id === id), "opaque discovered model")
      modelVersion++
      check((await request("/api/v1/llm/models", "GET", undefined, "session")).data.models.some((m: any) => m.id === "model-c"), "refresh exposes new model")
      discoveryFailure = true
      check((await request("/api/v1/llm/models", "GET", undefined, "session")).data.models.some((m: any) => m.id === "qwythos-9b"), "failed discovery retains default")
      discoveryFailure = false
      check((await request("/api/v1/llm/test", "POST", {}, "session")).data.content === "NODEPAD_LLM_OK", "mock inference success")
      check(observed.at(-1)?.model === "qwythos-9b" && observed.at(-1)?.authorized, "default inference payload")
      check((await request("/api/v1/llm/chat/completions", "POST", { model: "my-private-model-v37", messages: [{ role: "user", content: "test" }] }, "session")).response.ok, "manual model accepted")
      check(observed.at(-1)?.model === "my-private-model-v37", "manual inference payload")
    })
    await section("Nodepad core", async () => {
      const evidence = await request("/api/v1/workspaces/workspace-a/evidence", "POST", { claim: "Independent demand", strength: 5, sourceType: "interview" }, "machine", { "Idempotency-Key": "e1", "x-nodepad-actor-type": "agent", "x-nodepad-actor-id": "fixture-agent" })
      check(evidence.response.status === 201 && evidence.data.workspaceId === "workspace-a" && evidence.data.provenance.actorId === "fixture-agent", "evidence persisted actor metadata")
      const duplicate = await request("/api/v1/workspaces/workspace-a/evidence", "POST", { claim: "Independent demand" }, "machine", { "Idempotency-Key": "e1" })
      check(duplicate.data.id === evidence.data.id, "idempotent evidence")
      const hypothesis = await request("/api/v1/workspaces/workspace-a/hypotheses", "POST", { statement: "Demand exists", supportingEvidence: [evidence.data.id], evidenceScore: 100, confidence: 100, qualification: "strongly_qualified" }, "machine")
      check(hypothesis.response.status === 201 && hypothesis.data.confidence < 100, "scoring overrides supplied LLM authority")
      for (const name of ["context", "graph", "evidence", "hypotheses", "brain"]) check((await request(`/api/v1/workspaces/workspace-a/${name}`, "GET", undefined, "machine")).response.ok, "workspace retrieval")
      check((await request("/api/v1/workspaces/workspace-b/evidence", "GET", undefined, "machine")).data.length === 0, "workspace isolation")
      const context = (await request("/api/v1/workspaces/workspace-a/context", "GET", undefined, "machine")).data
      check((await request("/api/v1/workspaces/workspace-a/research/tasks", "POST", { question: "q", objective: "support" }, "machine", { "If-Match": String(context.revision) })).response.ok, "revision write")
      const conflict = await request("/api/v1/workspaces/workspace-a/research/tasks", "POST", { question: "stale", objective: "support" }, "machine", { "If-Match": String(context.revision) })
      check(conflict.response.status === 409 && conflict.data.error.startsWith("revision_conflict"), "stale revision conflict")
      completionFailure = true
      check((await request("/api/v1/workspaces/workspace-a/syntheses/run", "POST", { synthesisType: "S011", runId: "fallback" }, "machine")).response.ok, "deterministic synthesis without LLM")
      const before = observed.length
      for (let i = 0; i < 3; i++) check((await request("/api/v1/workspaces/workspace-a/heartbeat", "POST", { runId: `repeat-${i}` }, "machine")).response.ok, "deterministic heartbeat")
      check(observed.length === before, "heartbeat makes no inference calls")
      const graph = (await request("/api/v1/workspaces/workspace-a/graph", "GET", undefined, "machine")).data
      check(new Set(graph.nodes.map((n: any) => n.id)).size === graph.nodes.length && graph.nodes.length < 200, "bounded deduplicated graph")
      const oversized = await request("/api/v1/workspaces/workspace-a/evidence", "POST", { claim: "x".repeat(1_000_001) }, "machine")
      check(!oversized.response.ok && oversized.data.error === "request_body_too_large", "oversized mutation rejected")
      completionFailure = false
    })
    await section("Secret isolation", async () => {
      for (const response of captures) check(secretSafe(response), "response contains no fixture credentials")
      check(secretSafe(logs), "production logs secret safe")
      async function scan(directory: string) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const file = path.join(directory, entry.name)
          if (entry.isDirectory()) await scan(file)
          else check(secretSafe(await readFile(file, "utf8")), "client/persistent file secret safe")
        }
      }
      await scan(path.join(root, ".next/static"))
      await scan(temporary)
    })
    await section("Persistence and logout", async () => {
      await stop(); start(); await ready()
      check((await request("/api/auth/status", "GET", undefined, "session")).data.authenticated === true, "session survives process restart")
      check((await request("/api/v1/workspaces/workspace-a/evidence", "GET", undefined, "machine")).data.length === 1, "evidence survives process restart")
      check((await request("/api/auth/logout", "POST", undefined, "session")).response.ok, "logout success")
      check((await request("/api/v1/workspaces", "GET", undefined, "session")).response.status === 401, "old cookie revoked")
      check((await request("/api/v1/workspaces", "GET", undefined, "machine")).response.ok, "machine independent of logout")
    })
    return groups
  } catch (error) {
    const message = Object.values(FIXTURES).reduce((text, secret) => text.split(secret).join("[FIXTURE_REDACTED]"), error instanceof Error ? error.message : "smoke failure")
    throw Object.assign(new Error(`${group || "Startup"}: ${message}`), { groups })
  } finally {
    await stop(); await close(provider); await rm(temporary, { recursive: true, force: true })
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  smoke().catch(error => { console.error(`FAIL ${error instanceof Error ? error.message : "local production smoke"}`); process.exitCode = 1 })
}
