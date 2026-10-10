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

export type AIProvider = "openai-compatible"

export const DEFAULT_MODEL_ID = ""
export const DEFAULT_PROVIDER: AIProvider = "openai-compatible"

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
  const baseUrl = customBaseUrl?.trim() || ""
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
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
    const modelId = s.modelId.trim() || discoveredBrowserModel
    return { apiKey: s.apiKey, modelId, supportsGrounding: false, provider: s.provider, customBaseUrl: s.customBaseUrl }
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
  return ""
}

export function getProviderHeaders(config: AIConfig): Record<string, string> {
  const base: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (config.apiKey) {
    base["Authorization"] = `Bearer ${config.apiKey}`
  }
  return base
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
