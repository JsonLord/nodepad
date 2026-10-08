with open("lib/ai-settings.ts", "r") as f:
    content = f.read()

content = content.replace('  const [isHydrated, setIsHydrated] = useState(false)', '  const [isHydrated, setIsHydrated] = useState(false)\n  const [envConfig, setEnvConfig] = useState<{hasEnvKey: boolean, envModel: string | null} | null>(null)')
content = content.replace('    setSettings(loadSettings())\n    setIsHydrated(true)', '    setSettings(loadSettings())\n    fetch(\'/api/v1/config\')\n      .then(res => res.json())\n      .then(data => {\n        setEnvConfig({ hasEnvKey: data.hasEnvKey, envModel: data.envModel })\n      })\n      .catch(() => { setEnvConfig({ hasEnvKey: false, envModel: null }) })\n      .finally(() => setIsHydrated(true))')
content = content.replace('    label: settings.modelId,\n    shortLabel: settings.modelId.split("/").pop() || settings.modelId,', '    label: envConfig?.envModel || settings.modelId,\n    shortLabel: (envConfig?.envModel || settings.modelId).split("/").pop() || (envConfig?.envModel || settings.modelId),')
content = content.replace('  return { settings, updateSettings, resolvedModelId, currentModel, models, isHydrated }', '  const hasKey = !!(settings.apiKey || envConfig?.hasEnvKey)\n  const fullyHydrated = isHydrated && envConfig !== null\n  return { settings, updateSettings, resolvedModelId, currentModel, models, isHydrated: fullyHydrated, hasKey }')

with open("lib/ai-settings.ts", "w") as f:
    f.write(content)
