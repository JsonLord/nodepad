import { z } from "zod"
import { cacheSuccessfulMode, completeChat, getEnvLlmConfig, type LLMRequest } from "./openai-provider"

export type ReasoningRole = "adjudication" | "synthesis" | "escalation"
export type ChatCompletion = typeof completeChat
export const roleModel = (role: ReasoningRole) => process.env[`NODEPAD_LLM_${role.toUpperCase()}_MODEL`]?.trim() || (role === "escalation" ? "" : getEnvLlmConfig().model)

export function percentage(name: string, fallback: number) {
  const raw = process.env[`NODEPAD_ADJUDICATION_${name}`], number = raw === undefined || !raw.trim() ? fallback : Number(raw)
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : fallback
}

export function safeReasoningText(text: string): string {
  for (const name of ["OPENAI_API", "NODEPAD_API_KEY", "NODEPAD_LOGIN_KEY"]) {
    const secret = process.env[name]
    if (secret) text = text.split(secret).join("[REDACTED]")
  }
  return text
}

export async function structuredChat<T>(request: LLMRequest, schema: Record<string, unknown>, validator: z.ZodType<T>, chat: ChatCompletion = completeChat) {
  const response = await chat({ ...request, temperature: 0.1, responseFormat: { type: "json_schema", json_schema: { name: "nodepad_reasoning", strict: true, schema } } })
  if (response.content.length > 100_000) throw new Error("Structured response too large")

  const scrub = (value: unknown): unknown => typeof value === "string" ? safeReasoningText(value) : Array.isArray(value) ? value.map(scrub) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key,item])=>[safeReasoningText(key),scrub(item)])) : value

  let parsedContent;
  try {
    parsedContent = JSON.parse(response.content)
  } catch (e) {
    if (response.content.includes("```")) {
       throw new Error("Invalid JSON returned by LLM: Response contained markdown blocks which are not accepted by strict parsing")
    }
    throw new Error("Invalid JSON returned by LLM")
  }

  const scrubbed = scrub(parsedContent)
  const validated = validator.parse(scrubbed)

  if (response.requestedMode === "auto" && response.effectiveMode) {
      const config = getEnvLlmConfig()
      cacheSuccessfulMode(config.baseUrl, request.model || config.model, response.effectiveMode)
  }

  return { response: { ...response, model: safeReasoningText(response.model) }, value: validated }
}
