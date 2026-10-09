"use client"

import { useState, useEffect, useCallback } from "react"
import { useAvailableModels } from "@/lib/use-available-models"
import { resolveModelId } from "@/lib/model-selection"

export interface AIModel {
  id: string
  label: string
  shortLabel: string
  description: string
  supportsGrounding: boolean
  /** For OpenAI models: the search-preview variant to use when grounding is enabled */
  groundingModelId?: string
}

export type AIProvider = "openrouter" | "openai" | "zai" | "openai-compatible"

export interface AIProviderPreset {
  id: AIProvider
  label: string
  baseUrl: string
  keyUrl: string
  keyPlaceholder: string
}

export const AI_PROVIDER_PRESETS: AIProviderPreset[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    keyUrl: "https://openrouter.ai/settings/keys",
    keyPlaceholder: "sk-or-v1-...",
  },
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    keyUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-...",
  },
  {
    id: "zai",
    label: "Z.ai",
    baseUrl: "https://api.z.ai/api/paas/v4",
    keyUrl: "https://z.ai/manage-apikey/apikey-list",
    keyPlaceholder: "Your Z.ai API key",
  },
]

export function getPreset(provider: AIProvider): AIProviderPreset {
  return AI_PROVIDER_PRESETS.find(p => p.id === provider) || AI_PROVIDER_PRESETS[0]
}

export const AI_MODELS: AIModel[] = [
  {
    id: "anthropic/claude-sonnet-4-5",
    label: "Claude Sonnet 4.5",
    shortLabel: "Claude",
    description: "Best reasoning & annotation quality",
    supportsGrounding: false,
  },
  {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    shortLabel: "GPT-4o",
    description: "Strong structured output, broad knowledge",
    supportsGrounding: true,
  },
  {
    id: "google/gemini-2.5-pro-preview-03-25",
    label: "Gemini 2.5 Pro",
    shortLabel: "Gemini",
    description: "Long-context, web grounding available",
    supportsGrounding: true,
  },
  {
    id: "deepseek/deepseek-chat",
    label: "DeepSeek V3",
    shortLabel: "DeepSeek",
    description: "Cost-efficient frontier model",
    supportsGrounding: false,
  },
  {
    id: "mistralai/mistral-small-3.2-24b-instruct",
    label: "Mistral Small 3.2",
    shortLabel: "Mistral",
    description: "Fast, excellent structured outputs",
    supportsGrounding: false,
  },
  // ── Free tier (no credits required, ~200 req/day limit) ─────────────────
  {
    id: "nvidia/nemotron-3-nano-30b-a3b:free",
    label: "Nemotron 30B · Free",
    shortLabel: "Nemotron",
    description: "Free · no credits · ~200 req/day · Nvidia-hosted",
    supportsGrounding: false,
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    label: "Nemotron 120B · Free",
    shortLabel: "Nemotron",
    description: "Free · no credits · ~200 req/day · Nvidia-hosted · MoE",
    supportsGrounding: false,
  },
]

export const OPENAI_MODELS: AIModel[] = [
  {
    id: "gpt-4o",
    label: "GPT-4o",
    shortLabel: "GPT-4o",
    description: "Strong structured output, broad knowledge",
    supportsGrounding: true,
    groundingModelId: "gpt-4o-search-preview",
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o Mini",
    shortLabel: "GPT-4o Mini",
    description: "Fast and capable, web grounding available",
    supportsGrounding: true,
    groundingModelId: "gpt-4o-mini-search-preview",
  },
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    shortLabel: "GPT-4.1",
    description: "Latest GPT-4, improved instruction following",
    supportsGrounding: false,
  },
  {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 Mini",
    shortLabel: "GPT-4.1 Mini",
    description: "Fast and capable, good balance",
    supportsGrounding: false,
  },
  {
    id: "o4-mini",
    label: "o4-mini",
    shortLabel: "o4-mini",
    description: "Fast reasoning model",
    supportsGrounding: false,
  },
]

export const ZAI_MODELS: AIModel[] = [
  {
    id: "glm-4.5",
    label: "GLM-4.5",
    shortLabel: "GLM-4.5",
    description: "Fast, cost-efficient Z.ai model",
    supportsGrounding: false,
  },
  {
    id: "glm-4.7",
    label: "GLM-4.7",
    shortLabel: "GLM-4.7",
    description: "Strong reasoning, 200K context",
    supportsGrounding: false,
  },
  {
    id: "glm-5",
    label: "GLM-5",
    shortLabel: "GLM-5",
    description: "Z.ai flagship model",
    supportsGrounding: false,
  },
  {
    id: "glm-5-turbo",
    label: "GLM-5 Turbo",
    shortLabel: "GLM-5 Turbo",
    description: "Fast, capable, community tested",
    supportsGrounding: false,
  },
]

export function getModelsForProvider(provider: AIProvider): AIModel[] {
  if (provider === "openai-compatible") return []
  if (provider === "openai") return OPENAI_MODELS
  if (provider === "zai")    return ZAI_MODELS
  return AI_MODELS // openrouter + safe fallback for any stale localStorage value
}

export const DEFAULT_MODEL_ID = ""
export const DEFAULT_PROVIDER: AIProvider = "openrouter"

// ── Dynamic model fetching ────────────────────────────────────────────────────

export interface FetchedModel {
  id: string
  name?: string
  description?: string
  owned_by?: string
  isFree?: boolean
  contextLength?: number
}

export async function fetchModelsFromProvider(
  provider: AIProvider,
  apiKey: string,
  customBaseUrl?: string,
): Promise<FetchedModel[]> {
  const baseUrl = customBaseUrl?.trim() || getPreset(provider).baseUrl
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
  }
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "https://nodepad.space"
    headers["X-Title"] = "nodepad"
  }
  const res = await fetch(`${baseUrl}/models`, { headers })
  if (!res.ok) throw new Error(`Failed to fetch models (${res.status})`)
  const data = await res.json()
  const items: Array<{
    id: string
    name?: string
    description?: string
    owned_by?: string
    pricing?: { prompt?: string; completion?: string }
    context_length?: number
  }> = data?.data ?? []
  return items.map(m => {
    const isFree = m.pricing
      ? (m.pricing.prompt === "0" || m.pricing.prompt === "0.0") &&
        (m.pricing.completion === "0" || m.pricing.completion === "0.0")
      : false
    return {
      id: m.id,
      name: m.name,
      description: m.description,
      owned_by: m.owned_by,
      isFree,
      contextLength: m.context_length,
    }
  })
}

export interface AISettings {
  apiKey: string
  modelId: string
  webGrounding: boolean
  provider: AIProvider
  customBaseUrl: string
  /** Per-provider key store so switching back to a provider restores its key */
  providerKeys?: Partial<Record<AIProvider, string>>
}

const STORAGE_KEY = "nodepad-ai-settings"
let deploymentModel = ""
let discoveredBrowserModel = ""
export function setDiscoveredBrowserModel(model: string) { discoveredBrowserModel = model }
export function setDeploymentModel(model: string) { deploymentModel = model }

function loadSettings(): AISettings {
  if (typeof window === "undefined") {
    return { apiKey: "", modelId: DEFAULT_MODEL_ID, webGrounding: false, provider: DEFAULT_PROVIDER, customBaseUrl: "" }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { apiKey: "", modelId: DEFAULT_MODEL_ID, webGrounding: false, provider: DEFAULT_PROVIDER, customBaseUrl: "" }
    return { apiKey: "", modelId: DEFAULT_MODEL_ID, webGrounding: false, provider: DEFAULT_PROVIDER, customBaseUrl: "", ...JSON.parse(raw) }
  } catch {
    return { apiKey: "", modelId: DEFAULT_MODEL_ID, webGrounding: false, provider: DEFAULT_PROVIDER, customBaseUrl: "" }
  }
}

export interface AIConfig {
  apiKey: string
  modelId: string
  supportsGrounding: boolean
  provider: AIProvider
  customBaseUrl: string
}

export function loadAIConfig(): AIConfig | null {
  const s = loadSettings()

  // Explicitly configured in browser settings takes priority
  if (s.apiKey) {
    const models = getModelsForProvider(s.provider)
    const model = models.find(m => m.id === s.modelId)
    const modelId = s.modelId.trim() || discoveredBrowserModel
    const supportsGrounding =
      (s.provider === "openrouter" || s.provider === "openai") &&
      !s.customBaseUrl && s.webGrounding &&
      (model?.supportsGrounding ?? false)
    return { apiKey: s.apiKey, modelId, supportsGrounding, provider: s.provider, customBaseUrl: s.customBaseUrl }
  }

  // Deployment credentials stay on the server; browser requests carry only model IDs.
  if (typeof window !== "undefined" && deploymentModel) {
    return { apiKey: "", modelId: s.modelId.trim() || deploymentModel,
      supportsGrounding: false, provider: "openai-compatible", customBaseUrl: "/api/v1/llm" }
  }

  // Fallback to server/runtime environment defaults if OPENAI_URL and OPENAI_MODEL are present
  if (typeof process !== "undefined" && process.env) {
    const envUrl = process.env.OPENAI_URL
    const envModel = process.env.OPENAI_MODEL
    const envApi = process.env.OPENAI_API || ""
    if (envUrl && envModel) {
      // Normalize base URL
      let normUrl = envUrl.trim()
      while (normUrl.endsWith("/")) normUrl = normUrl.slice(0, -1)
      if (!normUrl.endsWith("/v1")) normUrl = `${normUrl}/v1`

      return {
        apiKey: envApi,
        modelId: s.modelId.trim() || envModel.trim(),
        supportsGrounding: false,
        provider: "openai-compatible",
        customBaseUrl: normUrl,
      }
    }
  }

  return null
}

export function getBaseUrl(config: AIConfig): string {
  const custom = config.customBaseUrl?.trim()
  if (custom) return custom
  return getPreset(config.provider).baseUrl
}

export function getProviderHeaders(config: AIConfig): Record<string, string> {
  const base: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (config.apiKey) {
    base["Authorization"] = `Bearer ${config.apiKey}`
  }
  if (config.provider === "openrouter") {
    base["HTTP-Referer"] = "https://nodepad.space"
    base["X-Title"] = "nodepad"
  }
  return base
}

/** @deprecated Use loadAIConfig() for direct browser → provider calls.
 *  Kept for any remaining server-route usage during transition. */
export function getAIHeaders(): Record<string, string> {
  const config = loadAIConfig()
  if (!config) return {}
  const models = getModelsForProvider(config.provider)
  const model = models.find(m => m.id === config.modelId)
  return {
    "x-or-key": config.apiKey,
    "x-or-model": config.modelId,
    "x-or-supports-grounding": model?.supportsGrounding ? "true" : "false",
  }
}

export function useAISettings() {
  const [settings, setSettings] = useState<AISettings>({
    apiKey: "", modelId: DEFAULT_MODEL_ID, webGrounding: false,
    provider: DEFAULT_PROVIDER, customBaseUrl: "",
  })
  const [isHydrated, setIsHydrated] = useState(false)
  const [envConfig, setEnvConfig] = useState<{hasEnvKey: boolean, envModel: string | null} | null>(null)

  useEffect(() => {
    setSettings(loadSettings())
    fetch('/api/v1/config')
      .then(res => res.json())
      .then(data => {
        setDeploymentModel(data.envModel || "")
        setEnvConfig({ hasEnvKey: data.hasEnvKey, envModel: data.envModel })
      })
      .catch(() => { setEnvConfig({ hasEnvKey: false, envModel: null }) })
      .finally(() => setIsHydrated(true))
  }, [])

  const updateSettings = useCallback((patch: Partial<AISettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const registry = useAvailableModels(settings)
  const resolvedModelId = resolveModelId(settings.modelId, registry.defaultModel, registry.models)
  const currentModel: AIModel = {
    id: resolvedModelId, label: resolvedModelId, shortLabel: resolvedModelId,
    description: "Custom model", supportsGrounding: false,
  }
  const hasKey = !!(settings.apiKey || envConfig?.hasEnvKey)
  return { settings, updateSettings, resolvedModelId, currentModel, models: registry.models,
    isHydrated: isHydrated && envConfig !== null, hasKey }
}
