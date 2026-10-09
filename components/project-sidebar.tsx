"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "next-themes"
import {
  Plus,
  Settings,
  Trash2,
  Check,
  X,
  Edit3,
  LayoutGrid,
  ArrowLeft,
  Key,
  ChevronDown,
  Eye,
  EyeOff,
  Save,
  FolderInput,
  Sun,
  Moon,
} from "lucide-react"
import {
  AI_PROVIDER_PRESETS,
  getPreset,
  type AISettings,
  type AIProvider,
} from "@/lib/ai-settings"

import { LogoutButton } from "@/components/logout-button"
import { useAvailableModels } from "@/lib/use-available-models"

interface Project {
  id: string
  name: string
  blocks: any[]
  collapsedIds: string[]
}

interface ProjectSidebarProps {
  isOpen: boolean
  onClose: () => void
  projects: Project[]
  activeProjectId: string
  onSelectProject: (id: string) => void
  onCreateProject: () => void
  onImportProject: () => void
  onRenameProject: (id: string, newName: string) => void
  onDeleteProject: (id: string) => void
  openToSettings?: boolean
  onSettingsOpened?: () => void
  // AI Settings
  aiSettings: AISettings
  onUpdateAISettings: (patch: Partial<AISettings>) => void
}

export function ProjectSidebar({
  isOpen,
  onClose,
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onImportProject,
  onRenameProject,
  onDeleteProject,
  aiSettings,
  onUpdateAISettings,
  openToSettings,
  onSettingsOpened,
}: ProjectSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [providerOpen, setProviderOpen] = useState(false)
  // local draft for settings (only save on "Save")
  const [draft, setDraft] = useState<AISettings>(aiSettings)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { theme, setTheme } = useTheme()

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  // Sync draft when panel opens
  useEffect(() => {
    if (showSettings) setDraft(aiSettings)
  }, [showSettings])

  // Jump straight to settings when requested externally
  useEffect(() => {
    if (openToSettings) {
      setShowSettings(true)
      onSettingsOpened?.()
    }
  }, [openToSettings])

  const handleRename = (id: string) => {
    if (editName.trim()) onRenameProject(id, editName.trim())
    setEditingId(null)
  }

  const handleDelete = (id: string) => {
    onDeleteProject(id)
    setDeletingId(null)
  }

  const persistSettings = () => {
    // Trim key to strip accidental whitespace/newlines from paste
    const trimmedKey = draft.apiKey.trim()
    const providerKeys: Partial<Record<AIProvider, string>> = {
      ...(draft.providerKeys ?? {}),
      [draft.provider]: trimmedKey,
    }
    onUpdateAISettings({ ...draft, modelId: draft.modelId.trim(), apiKey: trimmedKey, providerKeys })
  }

  const handleSaveSettings = () => {
    persistSettings()
    setShowSettings(false)
  }

  // Auto-save settings when the sidebar closes or when navigating back,
  // so key edits are never silently dropped.
  const handleClose = () => {
    if (showSettings) persistSettings()
    onClose()
  }

  const currentPreset = getPreset(draft.provider)
  const { models, defaultModel, loading, error, refresh } = useAvailableModels(draft)

  return (
    <div
      style={{
        width: isOpen ? (showSettings ? 320 : 240) : 0,
        opacity: isOpen ? 1 : 0,
        visibility: isOpen ? "visible" : "hidden"
      }}
      className="relative z-50 transition-all duration-200 ease-in-out overflow-hidden border-r border-border bg-muted/20 backdrop-blur-3xl flex flex-col h-full"
    >
      <div style={{ width: showSettings ? 320 : 240 }} className="flex flex-col h-full">
        {/* Header */}
        <div className="flex h-10 items-center justify-between border-b border-border bg-card/5 backdrop-blur-md px-3 py-1.5 shrink-0">
          <div className="flex items-center gap-2.5">
            {showSettings ? (
              <button
                onClick={handleSaveSettings}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="font-mono text-xs font-bold uppercase tracking-tight">Settings</span>
              </button>
            ) : (
              <>
                <div className="flex items-center justify-center h-5 w-5 bg-primary/10 rounded-sm">
                  <LayoutGrid className="h-3.5 w-3.5 text-primary" />
                </div>
                <h2 className="font-mono text-xs font-bold uppercase tracking-tight text-foreground/80 select-none">
                  Spaces
                </h2>
              </>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-1 px-1.5 hover:bg-muted/50 rounded-sm transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Content — animated slide between projects/settings */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait" initial={false}>
            {!showSettings ? (
              <motion.div
                key="projects"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 overflow-y-auto px-2 py-2 space-y-0.5 custom-scrollbar"
              >
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className={`group relative rounded-sm transition-all duration-150 ${
                      activeProjectId === project.id
                        ? "bg-primary/10 shadow-[inset_0_1px_0px_rgba(255,255,255,0.05)]"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center p-2 px-2.5">
                      <button
                        onClick={() => onSelectProject(project.id)}
                        className="flex-1 text-left flex flex-col gap-0 overflow-hidden"
                      >
                        {editingId === project.id ? (
                          <input
                            ref={inputRef}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRename(project.id)
                              if (e.key === "Escape") setEditingId(null)
                            }}
                            onBlur={() => handleRename(project.id)}
                            className="bg-transparent font-mono text-xs font-bold text-foreground focus:outline-none w-full border-b border-primary/50 py-0"
                          />
                        ) : (
                          <span className={`font-mono text-[12px] font-bold truncate ${
                            activeProjectId === project.id ? "text-primary" : "text-foreground/80 group-hover:text-foreground"
                          }`}>
                            {project.name}
                          </span>
                        )}
                        <span className="font-mono text-[8px] text-muted-foreground uppercase tracking-tighter font-bold">
                          {project.blocks.length} {project.blocks.length === 1 ? 'node' : 'nodes'}
                        </span>
                      </button>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {editingId !== project.id && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditName(project.name)
                                setEditingId(project.id)
                              }}
                              className="p-1 hover:bg-muted/50 rounded-sm text-muted-foreground hover:text-primary transition-colors"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                            {projects.length > 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeletingId(project.id)
                                }}
                                className="p-1 hover:bg-destructive/20 rounded-sm text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Delete Confirmation Overlay */}
                    <AnimatePresence>
                      {deletingId === project.id && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0 }}
                          className="absolute inset-0 z-10 bg-destructive/95 backdrop-blur-md rounded-sm flex items-center justify-between px-3"
                        >
                          <span className="font-mono text-[8px] font-bold text-white uppercase tracking-tighter">
                            Delete Space?
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(project.id)}
                              className="p-1 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="p-1 bg-black/30 hover:bg-black/40 rounded-full text-white transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="settings"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 20, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 overflow-y-auto px-3 py-4 flex flex-col gap-5 custom-scrollbar"
              >
                {/* Provider Selector */}
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Provider
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setProviderOpen(v => !v)}
                      className="flex w-full items-center justify-between rounded-md border border-border bg-muted/20 px-2.5 py-2 text-left hover:bg-muted/30 focus:outline-none transition-colors"
                    >
                      <span className="font-mono text-[11px] font-bold text-foreground">{currentPreset.label}</span>
                      <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${providerOpen ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>
                      {providerOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.1 }}
                          className="absolute top-full left-0 right-0 z-20 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-xl"
                        >
                          {AI_PROVIDER_PRESETS.map(preset => (
                            <button
                              key={preset.id}
                              onClick={() => {
                                setDraft(d => ({
                                  ...d,
                                  provider: preset.id,
                                  webGrounding: d.webGrounding,
                                  customBaseUrl: "",
                                  // Restore the saved key for this provider if one exists,
                                  // otherwise clear so the user knows to enter a new one.
                                  apiKey: d.providerKeys?.[preset.id] ?? "",
                                }))
                                setProviderOpen(false)
                              }}
                              className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left hover:bg-muted/50 transition-colors"
                            >
                              <div className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                                draft.provider === preset.id ? "border-primary bg-primary/20" : "border-border"
                              }`}>
                                {draft.provider === preset.id && <Check className="h-2.5 w-2.5 text-primary" />}
                              </div>
                              <span className="font-mono text-[10px] font-bold text-foreground">{preset.label}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* API Key */}
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    API Key
                  </label>
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-2 focus-within:border-primary/50 transition-colors">
                    <Key className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <input
                      type="text"
                      value={draft.apiKey}
                      onChange={e => setDraft(d => ({ ...d, apiKey: e.target.value }))}
                      placeholder={currentPreset.keyPlaceholder || "Your API key"}
                      className="flex-1 bg-transparent font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground/40"
                      style={showKey ? undefined : { WebkitTextSecurity: "disc" } as never}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button onClick={() => setShowKey(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors">
                      {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                  </div>
                  <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">
                    Stored locally. Never sent to a server.{" "}
                    {currentPreset.keyUrl && (
                      <a href={currentPreset.keyUrl} target="_blank" rel="noopener noreferrer"
                        className="text-primary underline hover:brightness-125 transition-all">
                        Get a key →
                      </a>
                    )}
                  </p>
                </div>

                {/* Custom Base URL */}
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Custom Base URL
                  </label>
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-2 focus-within:border-primary/50 transition-colors">
                    <input
                      type="text"
                      value={draft.customBaseUrl ?? ""}
                      onChange={e => setDraft(d => ({ ...d, customBaseUrl: e.target.value }))}
                      placeholder="Optional — for local/self-hosted endpoints"
                      className="flex-1 bg-transparent font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground/40"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">
                    Override the provider URL. Useful for Ollama, LM Studio, vLLM, or other OpenAI-compatible endpoints.
                  </p>
                </div>

                {/* Model Selector */}
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Model
                  </label>
                  <select
                    aria-label="Available models"
                    value={draft.modelId || defaultModel || models[0]?.id || ""}
                    onChange={e => setDraft(d => ({ ...d, modelId: e.target.value, webGrounding: false }))}
                    className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs"
                  >
                    {!models.length && !draft.modelId && <option value="">No models available</option>}
                    {draft.modelId && !models.some(m => m.id === draft.modelId) && <option value={draft.modelId}>{draft.modelId}</option>}
                    {models.map(model => <option key={model.id} value={model.id}>{model.id}{model.id === defaultModel ? " · Default" : ""}</option>)}
                  </select>
                  <label className="text-xs text-muted-foreground" htmlFor="custom-model-id">Use custom model ID</label>
                  <input
                    id="custom-model-id"
                    value={draft.modelId}
                    onChange={e => setDraft(d => ({ ...d, modelId: e.target.value, webGrounding: false }))}
                    placeholder={defaultModel || "Enter any model ID"}
                    className="rounded-md border border-border bg-transparent px-2 py-2 text-xs"
                    spellCheck={false}
                  />
                  <button type="button" onClick={refresh} disabled={loading} className="text-left text-xs text-primary">
                    {loading ? "Loading models…" : "Refresh models"}
                  </button>
                  {error && <p role="status" className="text-xs text-muted-foreground">{error}</p>}
                </div>



                {/* API Status */}
                <div className={`flex items-center gap-2 rounded-md px-2.5 py-2 font-mono text-[9px] ${
                  draft.apiKey
                    ? "bg-primary/10 border border-primary/20 text-primary"
                    : "bg-muted/20 border border-border text-muted-foreground"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${draft.apiKey ? "bg-primary animate-pulse" : "bg-muted-foreground/40"}`} />
                  {draft.apiKey ? `${currentPreset.label} — API key configured` : "No API key — AI disabled"}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-3 pb-2"><LogoutButton /></div>
        <div className="p-3 border-t border-border bg-muted/10 shrink-0">
          {showSettings ? (
            <div className="flex flex-col gap-1.5">
              <button
                onClick={handleSaveSettings}
                className="flex items-center justify-between w-full h-8 px-2.5 rounded-sm bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] shadow-sm"
              >
                <span>Save Settings</span>
                <Save className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="flex items-center justify-center w-full h-8 px-2.5 rounded-sm bg-muted/30 hover:bg-muted/50 text-muted-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] border border-border"
              >
                Cancel
              </button>
              {/* Theme toggle */}
              {mounted && (
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="flex items-center justify-between w-full h-8 px-2.5 rounded-sm bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] border border-border"
                >
                  <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                  {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <button
                onClick={onCreateProject}
                className="flex items-center justify-between w-full h-8 px-2.5 rounded-sm bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] shadow-sm"
              >
                <span>New Space</span>
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onImportProject}
                className="flex items-center justify-between w-full h-8 px-2.5 rounded-sm bg-muted/20 hover:bg-muted/40 text-muted-foreground hover:text-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] border border-border"
                title="Import a .nodepad file"
              >
                <span>Import .nodepad</span>
                <FolderInput className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center justify-between w-full h-8 px-2.5 rounded-sm bg-muted/20 hover:bg-muted/40 text-muted-foreground hover:text-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] border border-border"
              >
                <span>Settings</span>
                <Settings className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
