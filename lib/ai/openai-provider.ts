import { sanitizeModels } from "../model-selection"

export interface LLMMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface LLMRequest {
  messages: LLMMessage[]
  temperature?: number
  maxTokens?: number
  model?: string
}

export interface LLMResponse {
  content: string
  model: string
  provider: "openai-compatible"
}

export type LLMStatusValue =
  | "not_configured"
  | "configured"
  | "available"
  | "degraded"
  | "unreachable"
  | "auth_error"
  | "model_not_found"

export interface LLMStatus {
  configured: boolean
  provider: "openai-compatible"
  baseUrl?: string
  model?: string
  status: LLMStatusValue
  warning?: string
}

/**
 * Normalizes an OpenAI-compatible base URL.
 * Handles URLs with or without trailing slashes, and with or without /v1.
 * Ensures the base URL ends with /v1 without producing /v1/v1.
 */
export function normalizeOpenAiUrl(url?: string): string {
  if (!url) return ""
  let trimmed = url.trim()

  // Remove trailing slashes
  while (trimmed.endsWith("/")) {
    trimmed = trimmed.slice(0, -1)
  }

  if (!trimmed) return ""

  // If already ends with /v1, return it
  if (trimmed.endsWith("/v1")) {
    return trimmed
  }

  return `${trimmed}/v1`
}

export function getEnvLlmConfig() {
  const rawUrl = process.env.OPENAI_URL
  const rawModel = process.env.OPENAI_MODEL
  const rawApi = process.env.OPENAI_API

  const baseUrl = normalizeOpenAiUrl(rawUrl)
  const model = rawModel?.trim() || ""
  const apiKey = rawApi ?? ""

  const configured = Boolean(baseUrl && model)

  return {
    configured,
    baseUrl,
    model,
    apiKey,
  }
}

export async function getProviderStatus(fetchImpl: typeof fetch = fetch): Promise<LLMStatus> {
  const config = getEnvLlmConfig()

  if (!config.configured) {
    return {
      configured: false,
      provider: "openai-compatible",
      status: "not_configured",
    }
  }

  const headers: Record<string, string> = {}
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const res = await fetchImpl(`${config.baseUrl}/models`, {
      method: "GET",
      headers,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId))

    if (res.status === 401 || res.status === 403) {
      return {
        configured: true,
        provider: "openai-compatible",
        baseUrl: config.baseUrl,
        model: config.model,
        status: "auth_error",
      }
    }

    const textBody = await res.text().catch(() => "")

    // Check if the response body indicates invalid API key (some servers return HTTP 200 with text warning)
    if (textBody.includes("You must provide a valid API key")) {
      return {
        configured: true,
        provider: "openai-compatible",
        baseUrl: config.baseUrl,
        model: config.model,
        status: "auth_error",
        warning: "Server rejected API key: 'You must provide a valid API key'",
      }
    }

    if (!res.ok) {
      // /models endpoint returned non-200 (e.g. 404 or 500).
      // Since /models is OPTIONAL for OpenAI-compatible backends,
      // return configured status (or degraded if server error).
      return {
        configured: true,
        provider: "openai-compatible",
        baseUrl: config.baseUrl,
        model: config.model,
        status: res.status >= 500 ? "degraded" : "configured",
        warning: `GET /models returned status ${res.status}`,
      }
    }

    let data: { data?: Array<{ id: string }> } = {}
    try {
      data = JSON.parse(textBody)
    } catch {
      // Non-JSON response on /models (e.g. text/plain message)
    }

    const models = data?.data ?? []
    const modelFound = models.some((m) => m.id === config.model)

    if (models.length > 0 && !modelFound) {
      return {
        configured: true,
        provider: "openai-compatible",
        baseUrl: config.baseUrl,
        model: config.model,
        status: "model_not_found",
        warning: `Model '${config.model}' was not found in /models response list.`,
      }
    }

    return {
      configured: true,
      provider: "openai-compatible",
      baseUrl: config.baseUrl,
      model: config.model,
      status: "available",
    }
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === "AbortError"
    return {
      configured: true,
      provider: "openai-compatible",
      baseUrl: config.baseUrl,
      model: config.model,
      status: isAbort ? "degraded" : "unreachable",
      warning: config.apiKey ? (err instanceof Error ? err.message : String(err)).split(config.apiKey).join("[REDACTED]") : (err instanceof Error ? err.message : String(err)),
    }
  }
}

export async function completeChat(
  request: LLMRequest,
  fetchImpl: typeof fetch = fetch
): Promise<LLMResponse> {
  const config = getEnvLlmConfig()

  if (!config.configured) {
    throw new Error("OpenAI-compatible LLM provider is not configured.")
  }

  const modelToUse = request.model || config.model
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`
  }

  const payload = {
    model: modelToUse,
    messages: request.messages,
    temperature: request.temperature ?? 0.2,
    ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId))

    const errBody = await res.text().catch(() => "")

    if (errBody.includes("You must provide a valid API key")) {
      throw new Error("LLM provider authentication failed: invalid API key.")
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error(`LLM provider authentication failed (${res.status}).`)
      }
      if (res.status === 404) {
        throw new Error(`Model '${modelToUse}' or endpoint not found (${res.status}).`)
      }
      if (res.status === 429) {
        throw new Error(`LLM provider rate limit exceeded (${res.status}).`)
      }
      // Mask any potential key in raw error body if present
      const safeErrBody = config.apiKey ? errBody.split(config.apiKey).join("[REDACTED]") : errBody
      throw new Error(
        `LLM provider request failed (${res.status}): ${safeErrBody || res.statusText}`
      )
    }

    let data: {
      model?: string
      choices?: Array<{ message?: { content?: string } }>
    } = {}
    try {
      data = JSON.parse(errBody)
    } catch {
      throw new Error("LLM provider returned non-JSON response.")
    }

    const content = data.choices?.[0]?.message?.content
    if (typeof content !== "string") throw new Error("LLM provider returned a malformed completion response.")
    const returnedModel = data.model || modelToUse

    return {
      content,
      model: returnedModel,
      provider: "openai-compatible",
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("LLM request timed out after 30s.")
    }
    if (err instanceof Error && config.apiKey && err.message.includes(config.apiKey)) {
      throw new Error(err.message.split(config.apiKey).join("[REDACTED]"))
    }
    throw err
  }
}

/** Discover opaque model IDs without exposing credentials or upstream errors. */
export async function discoverModels(fetchImpl: typeof fetch = fetch) {
  const config = getEnvLlmConfig()
  const result = {
    provider: "openai-compatible" as const,
    configured: Boolean(config.baseUrl),
    defaultModel: config.model,
    models: sanitizeModels([], config.model),
    discoveryStatus: "not_configured",
  }
  if (!config.baseUrl) return result
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetchImpl(`${config.baseUrl}/models`, {
      headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
      signal: controller.signal,
      cache: "no-store",
    })
    if (response.status === 401 || response.status === 403) return { ...result, discoveryStatus: "auth_error" }
    if (!response.ok) return { ...result, discoveryStatus: "fallback" }
    const data = await response.json()
    const discovered = sanitizeModels(data?.data)
    return { ...result, models: sanitizeModels(discovered, config.model), discoveryStatus: discovered.length ? "available" : "fallback" }
  } catch {
    return { ...result, discoveryStatus: "unreachable" }
  } finally { clearTimeout(timer) }
}
