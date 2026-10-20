import { spawn } from "node:child_process"
import { createServer } from "node:http"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { FIXTURES, freePort, isolatedEnv } from "./predeploy-smoke"

const dockerEnv = () => {
  const env = isolatedEnv()
  for (const key of ["DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_TLS", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH"]) delete env[key]
  return env
}
async function command(args: string[], allowFailure = false) {
  const child = spawn("docker", ["--host=unix:///var/run/docker.sock", ...args], { env: dockerEnv(), stdio: ["ignore", "pipe", "pipe"] })
  let output = ""
  child.stdout.on("data", data => { output += data }); child.stderr.on("data", data => { output += data })
  const code = await new Promise<number>((resolve, reject) => { child.once("error", reject); child.once("exit", code => resolve(code ?? 1)) })
  if (code && !allowFailure) {
    const safe = Object.values(FIXTURES).reduce((text, secret) => text.split(secret).join("[FIXTURE_REDACTED]"), output)
    throw new Error(`Docker ${args[0]} failed:\n${safe.slice(-6000)}`)
  }
  return { code, output }
}
export async function dockerGate() {
  try {
    if ((await command(["info"], true)).code !== 0) { console.log("SKIPPED_ENV_DOCKER: managed local daemon unavailable"); return { result: "SKIPPED_ENV_DOCKER", passed: 0, failed: 0, skipped: 3 } }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    console.log("SKIPPED_ENV_DOCKER: docker executable absent"); return { result: "SKIPPED_ENV_DOCKER", passed: 0, failed: 0, skipped: 3 }
  }
  const args = ["build", "-t", "nodepad-predeploy"]
  // Optional CA bundle is only a BuildKit secret; never copied into the image.
  if (process.env.CODEX_PROXY_CERT) args.push("--secret", "id=proxy_ca,src=/etc/ssl/certs/ca-certificates.crt")
  args.push(".")
  await command(args)
  const server = createServer(async (req, res) => {
    if (req.headers.authorization !== `Bearer ${FIXTURES.OPENAI_API}`) { res.writeHead(401).end(); return }
    res.setHeader("Content-Type", "application/json")
    if (req.url === "/v1/models") res.end(JSON.stringify({ data: [{ id: "qwythos-9b" }] }))
    else if (req.url === "/v1/chat/completions") res.end(JSON.stringify({ choices: [{ message: { content: "NODEPAD_LLM_OK" } }] }))
    else res.writeHead(404).end()
  })
  const providerPort = await new Promise<number>((resolve, reject) => { server.once("error", reject); server.listen(0, "0.0.0.0", () => resolve((server.address() as { port: number }).port)) })
  const port = await freePort()
  const name = `nodepad-predeploy-${process.pid}`
  let passed = 1
  const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message); passed++ }
  const env = { ...FIXTURES, NODEPAD_GITHUB_SYNC: "false", NODEPAD_MAX_RESEARCH_TASKS_PER_HEARTBEAT: "0", NODEPAD_RESEARCH_ENABLED: "false", NODEPAD_DATA_DIR: "/app/data", OPENAI_URL: `http://host.docker.internal:${providerPort}/v1`, OPENAI_MODEL: "qwythos-9b" }
  try {
    // Loopback-only publication; no host networking. Docker's configured proxies stay intact.
    await command(["run", "-d", "--name", name, "--add-host", "host.docker.internal:host-gateway", "-p", `127.0.0.1:${port}:7860`, ...Object.entries(env).flatMap(([key, value]) => ["-e", `${key}=${value}`]), "nodepad-predeploy"])
    const base = `http://127.0.0.1:${port}`
    async function request(url: string, options: RequestInit = {}) {
      return fetch(base + url, { ...options, redirect: "manual", signal: AbortSignal.timeout(15_000) })
    }
    let ready = false
    for (let n = 0; n < 100; n++) {
      try { if ((await request("/health")).ok) { ready = true; break } } catch { /* startup poll */ }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    check(ready, "Docker readiness failed")
    check((await request("/login")).ok, "Docker login page")
    check((await request("/api/v1/workspaces")).status === 401, "Docker anonymous protection")
    const uid = (await command(["exec", name, "id", "-u"])).output.trim()
    check(uid === "1001", "Docker must run as non-root nextjs UID 1001")
    const login = await request("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessKey: FIXTURES.NODEPAD_LOGIN_KEY }) })
    check(login.ok, "Docker writable session store")
    const cookie = (login.headers.get("set-cookie") || "").split(";")[0]
    const headers = { Authorization: `Bearer ${FIXTURES.NODEPAD_API_KEY}`, "Content-Type": "application/json" }
    check((await request("/api/v1/workspaces/docker/evidence", { method: "POST", headers, body: JSON.stringify({ claim: "Docker persistent fixture" }) })).status === 201, "Docker non-root data write")
    check((await request("/api/v1/llm/models", { headers: { Cookie: cookie } })).ok, "Docker local mock discovery")
    const completion = await request("/api/v1/llm/test", { method: "POST", headers, body: "{}" })
    check(completion.ok && (await completion.json()).content === "NODEPAD_LLM_OK", "Docker local mock inference")
    await command(["restart", name])
    for (let n = 0; n < 100; n++) { try { if ((await request("/health")).ok) break } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
    const evidence = await request("/api/v1/workspaces/docker/evidence", { headers })
    check(evidence.ok && (await evidence.json()).length === 1, "Docker data survives restart")
    const sessionStatus = await request("/api/auth/status", { headers: { Cookie: cookie } })
    check(sessionStatus.ok && (await sessionStatus.json()).authenticated === true, "Docker session survives restart")
    const logs = (await command(["logs", name])).output
    check(Object.values(FIXTURES).every(secret => !logs.includes(secret)), "Docker logs must not contain fixture credentials")
    console.log(`PASS Docker build/runtime/non-root/persistence: ${passed} assertions`)
    return { result: "PASS", passed, failed: 0, skipped: 0 }
  } finally {
    await command(["rm", "-f", name], true)
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) dockerGate().catch(error => {
  console.error(error instanceof Error ? error.message : "Docker validation failed"); process.exitCode = 1
})
