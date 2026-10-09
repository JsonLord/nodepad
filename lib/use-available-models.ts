"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchModelsFromProvider, setDeploymentModel, setDiscoveredBrowserModel, type AISettings } from "@/lib/ai-settings"
import { sanitizeModels, type AvailableModel } from "@/lib/model-selection"

/** Shared registry for settings and the main UI. Discovery never changes selection. */
export function useAvailableModels(settings: AISettings) {
  const [models, setModels] = useState<AvailableModel[]>([])
  const [defaultModel, setDefaultModel] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(n => n + 1), [])

  useEffect(() => {
    setModels([])
    setDefaultModel("")
    setDiscoveredBrowserModel("")
  }, [settings.apiKey, settings.provider, settings.customBaseUrl])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const timer = setTimeout(async () => {
      try {
        if (settings.apiKey.trim()) {
          const items = await fetchModelsFromProvider(settings.provider, settings.apiKey.trim(), settings.customBaseUrl)
          if (!cancelled) {
            const available = sanitizeModels(items)
            setModels(available)
            setDiscoveredBrowserModel(available[0]?.id || "")
          }
        } else {
          const response = await fetch("/api/v1/llm/models", { cache: "no-store" })
          if (!response.ok) throw new Error(response.status === 401 ? "Sign in to retrieve models." : "Could not retrieve the provider model list.")
          const data = await response.json()
          if (!cancelled) {
            setDeploymentModel(data.defaultModel || data.models?.[0]?.id || "")
            setDefaultModel(data.defaultModel || "")
            setModels(sanitizeModels(data.models, data.defaultModel))
            setError(data.discoveryStatus === "available" ? null :
              data.discoveryStatus === "auth_error" ? "Model provider authentication failed. Check OPENAI_API in deployment secrets." :
              !data.configured ? "No model provider configured. Set OPENAI_URL, OPENAI_MODEL and OPENAI_API in the deployment environment." :
              `Could not retrieve the provider model list. Using configured default model: ${data.defaultModel || "none"}`)
          }
        }
      } catch {
        if (!cancelled) setError("Could not retrieve the provider model list. Your selected model is unchanged.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [settings.apiKey, settings.provider, settings.customBaseUrl, revision])
  return { models, defaultModel, loading, error, refresh }
}
