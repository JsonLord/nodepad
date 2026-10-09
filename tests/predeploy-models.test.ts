import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { completeChat, discoverModels, getEnvLlmConfig, getProviderStatus, normalizeOpenAiUrl } from "../lib/ai/openai-provider"
import { resolveModelId } from "../lib/model-selection"

const secret = "SUPER_SECRET_OPENAI_928374"
async function configured(run: () => Promise<void>) {
  const names = ["OPENAI_URL", "OPENAI_API", "OPENAI_MODEL"]
  const before = names.map(name => process.env[name])
  Object.assign(process.env, { OPENAI_URL: "https://llm.example.test", OPENAI_API: secret, OPENAI_MODEL: "qwythos-9b" })
  try { await run() } finally { names.forEach((name, i) => { if (before[i] === undefined) delete process.env[name]; else process.env[name] = before[i] }) }
}

test("MODEL-01 environment URL variants normalize exactly once", async () => configured(async () => {
  for (const suffix of ["", "/", "/v1", "/v1/"]) assert.equal(normalizeOpenAiUrl(`https://llm.example.test${suffix}`), "https://llm.example.test/v1")
  assert.equal(getEnvLlmConfig().model, "qwythos-9b")
}))
test("MODEL-02/03 arbitrary IDs and missing configured default remain available", async () => configured(async () => {
  const ids = ["Spark-X2.5", "Qwen/Qwen3.8-27B-FP8", "strange/custom:model@v2"]
  const result = await discoverModels(async () => new Response(JSON.stringify({ data: ids.map(id => ({ id })) })))
  assert.deepEqual(result.models.map(m => m.id), ["qwythos-9b", ...ids])
}))
test("MODEL-04 discovery failures all retain default; no commercial fallback", async () => configured(async () => {
  const mocks: typeof fetch[] = [async () => new Response("", { status: 404 }), async () => new Response("", { status: 500 }),
    async () => { throw new DOMException("timed out", "AbortError") }, async () => { throw new Error("offline") },
    async () => new Response("not JSON"), async () => new Response('{"data":[]}')]
  for (const mock of mocks) {
    const result = await discoverModels(mock)
    assert.deepEqual(result.models, [{ id: "qwythos-9b", label: "qwythos-9b" }])
    assert.equal(resolveModelId("", result.defaultModel, result.models), "qwythos-9b")
  }
}))
test("MODEL-05/06/07 opaque persisted/manual selection wins over defaults", () => {
  const selected = JSON.parse(JSON.stringify({ modelId: "Spark-X2.5" }))
  assert.equal(resolveModelId(selected.modelId, "qwythos-9b", []), "Spark-X2.5")
  assert.equal(resolveModelId("my-private-model-v37", "qwythos-9b", []), "my-private-model-v37")
  assert.equal(resolveModelId("", "", []), "")
})
test("MODEL-08/09 settings and main UI share refreshable registry without selection mutation", () => {
  const settings = readFileSync("lib/ai-settings.ts", "utf8")
  const sidebar = readFileSync("components/project-sidebar.tsx", "utf8")
  const hook = readFileSync("lib/use-available-models.ts", "utf8")
  assert.match(settings, /useAvailableModels\(settings\)/)
  assert.match(sidebar, /useAvailableModels\(draft\)/)
  assert.match(sidebar, /onClick=\{refresh\}/)
  assert.match(hook, /setRevision\(n => n \+ 1\)/)
  assert.doesNotMatch(hook, /updateSettings|localStorage\.setItem/)
  assert.match(sidebar, /Use custom model ID/)
})
test("MODEL-10/11 completion uses default or explicit arbitrary model", async () => configured(async () => {
  for (const selected of [undefined, "Spark-X2.5"]) {
    const result = await completeChat({ messages: [{ role: "user", content: "test" }], model: selected }, async (url, options) => {
      assert.equal(url, "https://llm.example.test/v1/chat/completions")
      assert.equal(JSON.parse(String(options?.body)).model, selected || "qwythos-9b")
      assert.ok((options?.headers as Record<string, string>).Authorization === `Bearer ${secret}`, "provider bearer sent server-side")
      return new Response(JSON.stringify({ choices: [{ message: { content: "NODEPAD_LLM_OK" } }] }))
    })
    assert.equal(result.model, selected || "qwythos-9b")
  }
}))
test("MODEL-12 provider errors classified and secret safe, including repeated echoes", async () => configured(async () => {
  for (const status of [401, 403, 404, 429, 500]) {
    await assert.rejects(() => completeChat({ messages: [] }, async () => new Response(`${secret} ${secret}`, { status })), error => {
      assert.equal(String(error).includes(secret), false)
      assert.match(String(error), status === 401 || status === 403 ? /authentication/ : status === 404 ? /not found/ : status === 429 ? /rate limit/ : /request failed/)
      return true
    })
  }
  await assert.rejects(() => completeChat({ messages: [] }, async () => { throw new DOMException("timeout", "AbortError") }), /timed out/)
  for (const body of ["bad JSON", "{}", '{"choices":[]}']) await assert.rejects(() => completeChat({ messages: [] }, async () => new Response(body)))
}))
test("SEC-01/03 provider status exception cannot reveal credential", async () => configured(async () => {
  const result = await getProviderStatus(async () => { throw new Error(`failed ${secret} ${secret}`) })
  assert.equal(JSON.stringify(result).includes(secret), false)
}))


test("MODEL-07 actual settings reload preserves selection without deployment credential", async () => {
  const { loadAIConfig, setDeploymentModel } = await import("../lib/ai-settings")
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
  const persisted = JSON.stringify({ modelId: "Spark-X2.5" })
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} })
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => persisted } })
  setDeploymentModel("qwythos-9b")
  try {
    const loaded = loadAIConfig()
    assert.equal(loaded?.modelId, "Spark-X2.5")
    assert.equal(loaded?.apiKey, "")
    assert.equal(loaded?.customBaseUrl, "/api/v1/llm")
    assert.equal(persisted.includes(secret), false)
  } finally {
    setDeploymentModel("")
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow); else Reflect.deleteProperty(globalThis, "window")
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage); else Reflect.deleteProperty(globalThis, "localStorage")
  }
})
