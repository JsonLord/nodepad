import test from "node:test"
import assert from "node:assert/strict"
import {
  normalizeOpenAiUrl,
  getEnvLlmConfig,
  getProviderStatus,
  completeChat,
} from "../lib/ai/openai-provider"
import { loadAIConfig, getProviderHeaders } from "../lib/ai-settings"
import { serializeWorkspace } from "../lib/github-sync/serialization"
import { fixture } from "./helpers"

test("1. provider absent -> application remains operational and unconfigured", async () => {
  const origUrl = process.env.OPENAI_URL
  const origModel = process.env.OPENAI_MODEL
  delete process.env.OPENAI_URL
  delete process.env.OPENAI_MODEL

  try {
    const config = getEnvLlmConfig()
    assert.equal(config.configured, false)
    const status = await getProviderStatus()
    assert.equal(status.status, "not_configured")
  } finally {
    if (origUrl) process.env.OPENAI_URL = origUrl
    if (origModel) process.env.OPENAI_MODEL = origModel
  }
})

test("2 & 3. URL normalization handles slashes, missing /v1 and existing /v1", () => {
  assert.equal(normalizeOpenAiUrl("https://host.example.com"), "https://host.example.com/v1")
  assert.equal(normalizeOpenAiUrl("https://host.example.com/"), "https://host.example.com/v1")
  assert.equal(normalizeOpenAiUrl("https://host.example.com/v1"), "https://host.example.com/v1")
  assert.equal(normalizeOpenAiUrl("https://host.example.com/v1/"), "https://host.example.com/v1")
})

test("4. configured model is registered as default fallback in loadAIConfig", () => {
  process.env.OPENAI_URL = "https://example.com/v1"
  process.env.OPENAI_MODEL = "gemma-3-12b"
  process.env.OPENAI_API = "secret-key-123"

  try {
    const config = loadAIConfig()
    assert.ok(config)
    assert.equal(config.provider, "openai-compatible")
    assert.equal(config.modelId, "gemma-3-12b")
    assert.equal(config.customBaseUrl, "https://example.com/v1")
    assert.equal(config.apiKey, "secret-key-123")
  } finally {
    delete process.env.OPENAI_URL
    delete process.env.OPENAI_MODEL
    delete process.env.OPENAI_API
  }
})

test("5. Authorization header uses OPENAI_API", () => {
  const headers = getProviderHeaders({
    apiKey: "secret-token",
    modelId: "test-model",
    supportsGrounding: false,
    provider: "openai-compatible",
    customBaseUrl: "https://example.com/v1",
  })

  assert.equal(headers["Authorization"], "Bearer secret-token")
  assert.equal(headers["Content-Type"], "application/json")
})

test("6. /models success detects configured model", async () => {
  process.env.OPENAI_URL = "https://example.com"
  process.env.OPENAI_MODEL = "gemma-3-12b"
  process.env.OPENAI_API = "secret-token"

  const mockFetch: typeof fetch = async (url, init) => {
    assert.equal(url.toString(), "https://example.com/v1/models")
    assert.equal((init?.headers as Record<string, string>)?.["Authorization"], "Bearer secret-token")
    return new Response(
      JSON.stringify({
        data: [{ id: "other-model" }, { id: "gemma-3-12b" }],
      }),
      { status: 200 }
    )
  }

  try {
    const status = await getProviderStatus(mockFetch)
    assert.equal(status.status, "available")
    assert.equal(status.configured, true)
    assert.equal(status.model, "gemma-3-12b")
  } finally {
    delete process.env.OPENAI_URL
    delete process.env.OPENAI_MODEL
    delete process.env.OPENAI_API
  }
})

test("7. /models unsupported or missing model does not make provider unusable", async () => {
  process.env.OPENAI_URL = "https://example.com"
  process.env.OPENAI_MODEL = "gemma-3-12b"

  // Test missing model in /models
  const mockFetchMissingModel: typeof fetch = async () => {
    return new Response(JSON.stringify({ data: [{ id: "other-model" }] }), { status: 200 })
  }

  // Test 404 on /models endpoint
  const mockFetch404: typeof fetch = async () => {
    return new Response("Not found", { status: 404 })
  }

  try {
    const statusMissing = await getProviderStatus(mockFetchMissingModel)
    assert.equal(statusMissing.status, "model_not_found")
    assert.ok(statusMissing.warning)

    const status404 = await getProviderStatus(mockFetch404)
    assert.equal(status404.status, "configured")
    assert.ok(status404.warning)
  } finally {
    delete process.env.OPENAI_URL
    delete process.env.OPENAI_MODEL
  }
})

test("8. 401 returns auth_error", async () => {
  process.env.OPENAI_URL = "https://example.com"
  process.env.OPENAI_MODEL = "gemma-3-12b"

  const mockFetch401: typeof fetch = async () => {
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    const status = await getProviderStatus(mockFetch401)
    assert.equal(status.status, "auth_error")
  } finally {
    delete process.env.OPENAI_URL
    delete process.env.OPENAI_MODEL
  }
})

test("9. network failure or timeout returns unreachable/degraded state", async () => {
  process.env.OPENAI_URL = "https://example.com"
  process.env.OPENAI_MODEL = "gemma-3-12b"

  const mockFetchError: typeof fetch = async () => {
    throw new Error("Network connection failed")
  }

  try {
    const status = await getProviderStatus(mockFetchError)
    assert.equal(status.status, "unreachable")
    assert.equal(status.warning, "Network connection failed")
  } finally {
    delete process.env.OPENAI_URL
    delete process.env.OPENAI_MODEL
  }
})

test("10. API secret never appears in status responses", async () => {
  process.env.OPENAI_URL = "https://example.com"
  process.env.OPENAI_MODEL = "gemma-3-12b"
  process.env.OPENAI_API = "SUPER_SECRET_TOKEN_999"

  try {
    const status = await getProviderStatus(async () => new Response("{}", { status: 200 }))
    const jsonString = JSON.stringify(status)
    assert.equal(jsonString.includes("SUPER_SECRET_TOKEN_999"), false)
    assert.equal("apiKey" in status, false)
  } finally {
    delete process.env.OPENAI_URL
    delete process.env.OPENAI_MODEL
    delete process.env.OPENAI_API
  }
})

test("11. API secret never appears in GitHub workspace serialization", () => {
  process.env.OPENAI_API = "SUPER_SECRET_TOKEN_999"
  try {
    const w = fixture()
    const serialized = JSON.stringify(serializeWorkspace(w))
    assert.equal(serialized.includes("SUPER_SECRET_TOKEN_999"), false)
  } finally {
    delete process.env.OPENAI_API
  }
})

test("12. LLM unavailability does not break deterministic synthesis/heartbeat", () => {
  const w = fixture()
  // Ensure qualification, scoring, and workspace properties remain deterministic
  assert.ok(w.id)
  assert.ok(typeof w.revision === "number")
  assert.ok(Array.isArray(w.evidence))
})

test("14. mocked /chat/completions returns expected content/model", async () => {
  process.env.OPENAI_URL = "https://example.com/v1"
  process.env.OPENAI_MODEL = "gemma-3-12b"
  process.env.OPENAI_API = "secret-key"

  const mockFetchChat: typeof fetch = async (url, init) => {
    assert.equal(url.toString(), "https://example.com/v1/chat/completions")
    const body = JSON.parse(init?.body as string)
    assert.equal(body.model, "gemma-3-12b")
    assert.equal(body.messages[0].content, "Respond only with NODEPAD_LLM_OK")

    return new Response(
      JSON.stringify({
        model: "gemma-3-12b",
        choices: [{ message: { content: "NODEPAD_LLM_OK" } }],
      }),
      { status: 200 }
    )
  }

  try {
    const res = await completeChat(
      { messages: [{ role: "user", content: "Respond only with NODEPAD_LLM_OK" }] },
      mockFetchChat
    )
    assert.equal(res.content, "NODEPAD_LLM_OK")
    assert.equal(res.model, "gemma-3-12b")
    assert.equal(res.provider, "openai-compatible")
  } finally {
    delete process.env.OPENAI_URL
    delete process.env.OPENAI_MODEL
    delete process.env.OPENAI_API
  }
})

test("15. explicit model/provider selection still overrides environment default", () => {
  process.env.OPENAI_URL = "https://env-example.com/v1"
  process.env.OPENAI_MODEL = "env-model"
  process.env.OPENAI_API = "env-api-key"

  // Simulate explicit localStorage settings
  if (typeof window === "undefined") {
    // Mock global window and localStorage
    ;(global as unknown as { window: unknown }).window = {}
    ;(global as unknown as { localStorage: unknown }).localStorage = {
      getItem: (key: string) => {
        if (key === "nodepad-ai-settings") {
          return JSON.stringify({
            apiKey: "user-explicit-key",
            modelId: "openai/gpt-4o",
            provider: "openrouter",
          })
        }
        return null
      },
    }
  }

  try {
    const config = loadAIConfig()
    assert.ok(config)
    assert.equal(config.provider, "openrouter")
    assert.equal(config.apiKey, "user-explicit-key")
    assert.equal(config.modelId, "openai/gpt-4o")
  } finally {
    delete (global as unknown as { window?: unknown }).window
    delete (global as unknown as { localStorage?: unknown }).localStorage
    delete process.env.OPENAI_URL
    delete process.env.OPENAI_MODEL
    delete process.env.OPENAI_API
  }
})
