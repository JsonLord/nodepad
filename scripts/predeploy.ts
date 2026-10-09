import { spawn } from "node:child_process"
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { FIXTURES, isolatedEnv, smoke } from "./predeploy-smoke"
import { dockerGate } from "./predeploy-docker"

async function main() {
  const logs = await mkdtemp(path.join(tmpdir(), "nodepad-predeploy-logs-"))
  const results: Record<string, unknown> = {}
  const env = isolatedEnv()
  let failed = false
  const safe = (text: string) => Object.values(FIXTURES).reduce((value, secret) => value.split(secret).join("[FIXTURE_REDACTED]"), text)
  async function run(group: string, command: string, args: string[]) {
    const child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] })
    let output = ""
    child.stdout.on("data", value => { output += value }); child.stderr.on("data", value => { output += value })
    const code = await new Promise<number>((resolve, reject) => { child.once("error", reject); child.once("exit", code => resolve(code ?? 1)) })
    const file = path.join(logs, `${group}.log`)
    await writeFile(file, safe(output))
    const count = (name: string) => Number(output.match(new RegExp(`(?:ℹ |# )${name} (\\d+)`))?.[1] || 0)
    results[group] = { result: code ? "FAIL" : "PASS", passed: count("pass") || (code ? 0 : 1), failed: count("fail") || (code ? 1 : 0), skipped: count("skipped"), log: file }
    console.log(`${code ? "FAIL" : "PASS"} ${group}${count("tests") ? `: ${count("tests")} tests` : ""}`)
    if (code) { failed = true; console.error(safe(output).slice(-6000)) }
    return code === 0
  }
  try {
    await Promise.all([run("Lint", "npm", ["run", "lint"]), run("Types", "node", ["node_modules/typescript/bin/tsc", "--noEmit", "--incremental", "false"])])
    await Promise.all([run("Unit", "npm", ["run", "test:predeploy:unit"]), run("Registry", "npm", ["run", "test:registry"]), run("Fixture", "npm", ["run", "validate:fixture"])])
    if (failed) throw new Error("Code quality or unit gate failed")
    if (!await run("Build", "npm", ["run", "build"])) throw new Error("Production build failed")
    for (const file of [".next/standalone/server.js", ".next/static", "public"]) await stat(file)
    results.Artifacts = { result: "PASS", passed: 3, failed: 0, skipped: 0 }
    Object.assign(results, await smoke())
    results.Docker = await dockerGate()
  } catch (error) {
    failed = true
    console.error(safe(error instanceof Error ? error.message : "Unknown predeploy failure"))
    if (error && typeof error === "object" && "groups" in error) Object.assign(results, error.groups)
    results.GateFailure = { result: "FAIL", failed: 1 }
  }
  const verdict = failed ? "RED — DO NOT REDEPLOY" : (results.Docker as { result: string })?.result === "SKIPPED_ENV_DOCKER" ? "YELLOW — INTERNAL TESTS PASS EXCEPT EXPLICIT ENVIRONMENT-ONLY CHECKS" : "GREEN — READY TO REDEPLOY"
  const report = { generatedAt: new Date().toISOString(), verdict, results }
  await writeFile("/tmp/nodepad-predeploy-report.json", JSON.stringify(report, null, 2))
  console.log(verdict)
  console.log("Report: /tmp/nodepad-predeploy-report.json")
  if (failed) process.exitCode = 1
}
main().catch(() => { console.error("RED — DO NOT REDEPLOY: runner failed"); process.exitCode = 1 })
