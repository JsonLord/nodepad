import test from "node:test"
import assert from "node:assert/strict"
import { resolveModelId, sanitizeModels } from "../lib/model-selection"
import { discoverModels } from "../lib/ai/openai-provider"

test("opaque discovered and manual model IDs override defaults without a whitelist", () => {
  const models = sanitizeModels([{ id: "qwythos-9b" }, { id: "Qwen/Qwen3.8-27B-FP8" }, { id: "qwythos-9b" }, null, { id: 1 }], "gemma-3-12b")
  assert.deepEqual(models.map(m => m.id), ["gemma-3-12b", "qwythos-9b", "Qwen/Qwen3.8-27B-FP8"])
  assert.equal(resolveModelId("manual/alias", "gemma-3-12b", models), "manual/alias")
  assert.equal(resolveModelId("", "gemma-3-12b", models), "gemma-3-12b")
  assert.equal(resolveModelId("", "", models), "gemma-3-12b")
  assert.equal(resolveModelId("", "", []), "")
})

test("discovery includes deployment default on success, empty, failure and authentication errors; never exposes credentials", async () => {
  const previous = { url: process.env.OPENAI_URL, model: process.env.OPENAI_MODEL, api: process.env.OPENAI_API }
  process.env.OPENAI_URL = "https://models.example/v1/"
  process.env.OPENAI_MODEL = "custom-default"
  process.env.OPENAI_API = "private-test-credential"
  try {
    for (const status of [200, 404, 401, 500]) {
      const result = await discoverModels(async (url, options) => {
        assert.equal(url, "https://models.example/v1/models")
        assert.equal((options?.headers as Record<string, string>).Authorization, "Bearer private-test-credential")
        return new Response(JSON.stringify({ data: [{ id: "spark-x2.5", secret: "private-test-credential" }] }), { status })
      })
      assert.ok(result.models.some(m => m.id === "custom-default"))
      assert.equal(JSON.stringify(result).includes("private-test-credential"), false)
      if (status === 200) assert.ok(result.models.some(m => m.id === "spark-x2.5"))
      if (status === 401) assert.equal(result.discoveryStatus, "auth_error")
    }
    const failed = await discoverModels(async () => { throw new Error("private-test-credential") })
    assert.equal(failed.discoveryStatus, "unreachable")
    assert.equal(resolveModelId("manual-alias", failed.defaultModel, failed.models), "manual-alias")
    const empty = await discoverModels(async () => new Response('{"data":[]}'))
    assert.equal(empty.discoveryStatus, "fallback")
  } finally {
    for (const [name, value] of Object.entries({ OPENAI_URL: previous.url, OPENAI_MODEL: previous.model, OPENAI_API: previous.api })) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value
    }
  }
})

test("models endpoint follows existing bearer protection and hides deployment credential", async () => {
  const { GET } = await import("../app/api/v1/llm/models/route")
  const { NextRequest } = await import("next/server")
  const previousKey = process.env.NODEPAD_API_KEY
  const previousUrl = process.env.OPENAI_URL
  process.env.NODEPAD_API_KEY = "nodepad-test-token"
  delete process.env.OPENAI_URL
  try {
    assert.equal((await GET(new NextRequest("http://localhost/api/v1/llm/models"))).status, 401)
    const response = await GET(new NextRequest("http://localhost/api/v1/llm/models", { headers: { Authorization: "Bearer nodepad-test-token" } }))
    assert.equal(response.status, 200)
    assert.equal((await response.json()).configured, false)
    assert.equal(response.headers.get("cache-control"), "no-store")
  } finally {
    if (previousKey === undefined) delete process.env.NODEPAD_API_KEY; else process.env.NODEPAD_API_KEY = previousKey
    if (previousUrl === undefined) delete process.env.OPENAI_URL; else process.env.OPENAI_URL = previousUrl
  }
})

test("browser custom endpoint settings keep arbitrary manual selections", async () => {
  const { loadAIConfig } = await import("../lib/ai-settings")
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
  const priorStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} })
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: () => JSON.stringify({ apiKey: "browser-test-key", provider: "openai", customBaseUrl: "https://custom.example/v1", modelId: "manual/not-enumerated", webGrounding: true }),
  } })
  try {
    const config = loadAIConfig()
    assert.equal(config?.modelId, "manual/not-enumerated")
    assert.equal(config?.customBaseUrl, "https://custom.example/v1")
    assert.equal(config?.apiKey, "browser-test-key")
    assert.equal(config?.supportsGrounding, false)
  } finally {
    if (priorWindow) Object.defineProperty(globalThis, "window", priorWindow); else Reflect.deleteProperty(globalThis, "window")
    if (priorStorage) Object.defineProperty(globalThis, "localStorage", priorStorage); else Reflect.deleteProperty(globalThis, "localStorage")
  }
})
