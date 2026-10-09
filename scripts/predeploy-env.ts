// Unit tests must not inherit deployment credentials or activate external workers.
for (const name of Object.keys(process.env)) {
  if (/^(NODEPAD_|OPENAI_|NEXT_PUBLIC_.*(?:KEY|TOKEN|SECRET)|GH_TOKEN$|GITHUB_TOKEN$|HF_TOKEN$)/.test(name)) delete process.env[name]
}
process.env.NODEPAD_GITHUB_SYNC = "false"
process.env.NODEPAD_MAX_RESEARCH_TASKS_PER_HEARTBEAT = "0"
const originalFetch = globalThis.fetch
// Tests may replace fetch with explicit mocks. Unmocked network calls are loopback-only.
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url)
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("PREDEPLOY_EXTERNAL_NETWORK_FORBIDDEN")
  return originalFetch(input, init)
}) as typeof fetch
