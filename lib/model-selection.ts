export interface AvailableModel { id: string; label: string }

export function resolveModelId(selected: string, defaultModel: string, models: AvailableModel[]): string {
  return selected.trim() || defaultModel.trim() || models[0]?.id || ""
}

export function sanitizeModels(data: unknown, defaultModel = ""): AvailableModel[] {
  const ids = new Set<string>()
  if (defaultModel.trim()) ids.add(defaultModel.trim())
  if (Array.isArray(data)) for (const item of data) {
    if (item && typeof item.id === "string" && item.id.trim()) ids.add(item.id.trim())
  }
  return [...ids].map(id => ({ id, label: id }))
}
