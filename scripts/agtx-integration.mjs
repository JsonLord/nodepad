#!/usr/bin/env node
import { spawn } from "node:child_process"

const REQUIRED_TOOLS = ["list_projects", "list_tasks", "create_task", "get_task", "move_task", "wait_for_board_change"]
const binary = process.env.AGTX_BINARY
const testRepo = process.env.AGTX_TEST_REPO
const timeoutMs = Number(process.env.AGTX_REQUEST_TIMEOUT_MS ?? 15_000)

if (!binary || !testRepo) {
  console.error(JSON.stringify({ event: "agtx_test_configuration_error", requiredEnvironment: ["AGTX_BINARY", "AGTX_TEST_REPO"] }))
  process.exit(2)
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: ["ignore", "pipe", "pipe"] })
    let stdout = "", stderr = ""
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8")
    child.stdout.on("data", chunk => { stdout += chunk }); child.stderr.on("data", chunk => { stderr += chunk })
    child.once("error", reject)
    child.once("exit", code => code === 0 ? resolve(stdout.trim()) : reject(new Error(`command exited ${code}: ${stderr.trim().slice(0, 300)}`)))
  })
}

function shape(value, depth = 0) {
  if (depth > 3) return typeof value
  if (Array.isArray(value)) return value.length === 0 ? [] : [shape(value[0], depth + 1)]
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).slice(0, 30).map(([key, item]) => [key, shape(item, depth + 1)]))
  return typeof value
}
function collection(value, ...keys) { for (const key of keys) if (Array.isArray(value?.[key])) return value[key]; return Array.isArray(value) ? value : [] }
function identifier(value) { return value?.id ?? value?.task_id ?? value?.taskId ?? value?.task?.id }

const version = await runCommand(binary, ["--version"])
const child = spawn(binary, ["mcp-serve", testRepo], { shell: false, stdio: ["pipe", "pipe", "pipe"] })
const pending = new Map()
let nextId = 1, buffer = "", stderr = ""
const request = (method, params = {}, requestTimeout = timeoutMs) => new Promise((resolve, reject) => {
  const id = nextId++
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)) }, requestTimeout)
  pending.set(id, { resolve, reject, timer })
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`)
})
child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8")
child.stderr.on("data", chunk => { stderr = `${stderr}${chunk}`.slice(-2_000) })
child.stdout.on("data", chunk => {
  buffer += chunk
  for (;;) {
    const newline = buffer.indexOf("\n"); if (newline < 0) break
    const line = buffer.slice(0, newline).trim(); buffer = buffer.slice(newline + 1); if (!line) continue
    let message; try { message = JSON.parse(line) } catch { continue }
    const entry = pending.get(message.id); if (!entry) continue
    clearTimeout(entry.timer); pending.delete(message.id)
    message.error ? entry.reject(new Error(message.error.message ?? "MCP error")) : entry.resolve(message.result)
  }
})
child.once("exit", code => {
  for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error(`AGTX MCP exited ${code}`)) }
  pending.clear()
})

try {
  const initialized = await request("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "nodepad-agtx-contract-test", version: "1" } })
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`)
  const listed = await request("tools/list")
  const tools = listed.tools ?? [], toolMap = new Map(tools.map(tool => [tool.name, tool]))
  const missingTools = REQUIRED_TOOLS.filter(name => !toolMap.has(name))
  if (missingTools.length) throw new Error(`AGTX_INCOMPATIBLE_VERSION missing tools: ${missingTools.join(", ")}`)
  const call = async (name, args = {}) => {
    const result = await request("tools/call", { name, arguments: args })
    if (result.isError) throw new Error(`${name} failed`)
    if (result.structuredContent !== undefined) return result.structuredContent
    const text = result.content?.find(item => item.type === "text")?.text
    if (!text) return {}
    try { return JSON.parse(text) } catch { throw new Error(`${name} returned non-JSON text`) }
  }
  const projectResult = await call("list_projects")
  const projects = collection(projectResult, "projects", "items")
  const project = projects.find(item => item?.path === testRepo || item?.repositoryPath === testRepo) ?? projects[0]
  const projectId = project?.id ?? project?.project_id ?? project?.projectId
  const projectArgs = projectId ? { project_id: projectId } : {}
  await call("list_tasks", projectArgs)
  const correlation = `nodepad-agtx-contract-${Date.now()}-${process.pid}`
  const created = await call("create_task", { ...projectArgs, title: `Nodepad contract probe ${correlation}`, description: `Harmless Backlog-only protocol verification. Correlation: ${correlation}. Do not start execution.` })
  const taskId = identifier(created); if (!taskId) throw new Error("create_task returned no task ID")
  const taskResult = await call("get_task", { ...projectArgs, task_id: taskId })
  const task = taskResult.task ?? taskResult
  if (String(identifier(task)) !== String(taskId)) throw new Error("get_task returned a different task ID")
  const providerStatus = task.status ?? task.phase ?? task.column
  if (typeof providerStatus !== "string" || !providerStatus) throw new Error("get_task returned no phase/status")
  if (!JSON.stringify(task).includes(correlation)) throw new Error("get_task did not preserve the correlation marker")
  const after = collection(await call("list_tasks", projectArgs), "tasks", "items")
  const matches = after.filter(item => JSON.stringify(item).includes(correlation))
  if (matches.length !== 1) throw new Error(`expected one correlated task, observed ${matches.length}`)
  const allowedActions = task.allowed_actions ?? task.allowedActions ?? []
  if (!Array.isArray(allowedActions)) throw new Error("allowed_actions is not an array")
  console.log(JSON.stringify({ event: "agtx_mcp_contract_validated", agtxVersion: version, mcpMode: "project-scoped", mcpServer: initialized.serverInfo ?? null, toolsObserved: tools.map(tool => tool.name).sort(), requiredToolsPresent: true, toolInputSchemas: Object.fromEntries(REQUIRED_TOOLS.map(name => [name, toolMap.get(name)?.inputSchema ?? null])), projectIdPresent: Boolean(projectId), projectResponseShape: shape(projectResult), taskId: String(taskId), providerStatus, taskResponseShape: shape(taskResult), allowedActions, moveTaskInputShape: toolMap.get("move_task")?.inputSchema ?? null, boardChangeInputShape: toolMap.get("wait_for_board_change")?.inputSchema ?? null, exactlyOneCorrelatedTask: true, executionStarted: false }, null, 2))
} catch (error) {
  console.error(JSON.stringify({ event: "agtx_mcp_contract_failed", agtxVersion: version, message: error instanceof Error ? error.message : "unknown error", stderrTail: stderr }))
  process.exitCode = 1
} finally { child.kill("SIGTERM") }
