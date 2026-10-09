with open("lib/ai-settings.ts", "r") as f:
    content = f.read()

content = content.replace("  const [envConfig, setEnvConfig] = useState<{hasEnvKey: boolean, envModel: string | null} | null>(null)\n  const [envConfig, setEnvConfig] = useState<{hasEnvKey: boolean, envModel: string | null} | null>(null)", "  const [envConfig, setEnvConfig] = useState<{hasEnvKey: boolean, envModel: string | null} | null>(null)")

with open("lib/ai-settings.ts", "w") as f:
    f.write(content)
