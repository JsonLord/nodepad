"use client"

import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TilingArea } from "@/components/tiling-area"
import { KanbanArea } from "@/components/kanban-area"
import { GraphArea } from "@/components/graph-area"
import { ProjectSidebar } from "@/components/project-sidebar"
import { StatusBar } from "@/components/status-bar"
import { GhostPanel, type GhostNote } from "@/components/ghost-panel"
import { VimInput } from "@/components/vim-input"
import { IntroModal } from "@/components/intro-modal"
import type { TextBlock } from "@/components/tile-card"
import type { ContentType } from "@/lib/content-types"
import { INITIAL_PROJECTS } from "@/lib/initial-data"
import { useAISettings } from "@/lib/ai-settings"
import { enrichBlockClient } from "@/lib/ai-enrich"
import { generateGhostClient } from "@/lib/ai-ghost"
import { exportToMarkdown, downloadMarkdown, copyToClipboard } from "@/lib/export"
import { downloadNodepadFile, parseNodepadFile, NodepadParseError } from "@/lib/nodepad-format"
import { detectContentType } from "@/lib/detect-content-type"
import { createProjectStore } from "@/lib/storage"
import { ApiStore, ApiStoreAuthenticationError } from "@/lib/storage/api-store"
import { BrowserGraphStore } from "@/lib/storage/browser-graph-store"
import type { HubConnectionStatus } from "@/lib/storage/hub-status"
import { HubStatus } from "@/components/hub-status"
import { ProjectsArea } from "@/components/projects-area"
import { AgentsArea } from "@/components/agents-area"
import { AgTxArea } from "@/components/agtx-area"
import { getStorageMode } from "@/lib/storage"
import { STORAGE_SCHEMA_VERSION } from "@/lib/storage/types"
import type { ProjectStore } from "@/lib/storage/types"
import type { Workspace } from "@/lib/domain/workspace"
import { replaceAIInfluencedEdges, replaceWorkspaceBlocks, updateWorkspaceBlocks, workspaceBlocks } from "@/lib/domain/workspace-operations"

function generateId() {
  return Math.random().toString(36).substring(2, 10)
}

export type Project = Workspace

import { TileIndex } from "@/components/tile-index"

export default function Page() {
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string>("")
  const [highlightedBlockId, setHighlightedBlockId] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isIndexOpen, setIsIndexOpen] = useState(false)
  const [isGhostPanelOpen, setIsGhostPanelOpen] = useState(false)
  const [viewMode, setViewMode] = useState<"tiling" | "kanban" | "graph">("tiling")
  const [appView, setAppView] = useState<"nodepad" | "projects" | "agents" | "agtx">("nodepad")
  const [isCommandKOpen, setIsCommandKOpen] = useState(false)
  const [jumpToSettings, setJumpToSettings] = useState(false)
  const [isIntroOpen, setIsIntroOpen] = useState(false)
  const [showHelpTooltip, setShowHelpTooltip] = useState(false)
  const helpTooltipTimer = useRef<NodeJS.Timeout | null>(null)
  const { settings, updateSettings, resolvedModelId, currentModel, isHydrated } = useAISettings()
  const debounceTimers = useRef<Record<string, Record<string, NodeJS.Timeout>>>({})
  const projectStoreRef = useRef<ProjectStore & { loadOrMigrate?: () => Promise<import("@/lib/storage/types").CanonicalProjectState | null> } | null>(null)
  const [hubStatus, setHubStatus] = useState<HubConnectionStatus>("browser")
  const [authToken, setAuthToken] = useState("")
  const [authError, setAuthError] = useState("")
  const [pendingMigration, setPendingMigration] = useState<import("@/lib/storage/types").CanonicalProjectState | null>(null)

  // ── Undo history ring (max 20 canonical snapshots per workspace) ────────
  const blockHistoryRef = useRef<Record<string, Workspace[]>>({})
  const [undoToast, setUndoToast] = useState<string | null>(null)
  const undoToastTimer = useRef<NodeJS.Timeout | null>(null)

  const pushHistory = useCallback((projectId: string, currentWorkspace: Workspace) => {
    if (!blockHistoryRef.current[projectId]) blockHistoryRef.current[projectId] = []
    const stack = blockHistoryRef.current[projectId]
    stack.push(currentWorkspace)
    if (stack.length > 20) stack.shift()
  }, [])

  const showUndoToast = useCallback((msg: string) => {
    if (undoToastTimer.current) clearTimeout(undoToastTimer.current)
    setUndoToast(msg)
    undoToastTimer.current = setTimeout(() => setUndoToast(null), 2200)
  }, [])

  // Clean up undo toast timer on unmount
  useEffect(() => () => {
    if (undoToastTimer.current) clearTimeout(undoToastTimer.current)
  }, [])

  // ── Intro modal ──────────────────────────────────────────────────────────
  const handleIntroClose = useCallback(() => {
    setIsIntroOpen(false)
    localStorage.setItem("nodepad-intro-seen", "true")
    // Show the help tooltip for 6 seconds pointing to the ? button
    setShowHelpTooltip(true)
    if (helpTooltipTimer.current) clearTimeout(helpTooltipTimer.current)
    helpTooltipTimer.current = setTimeout(() => setShowHelpTooltip(false), 6000)
  }, [])

  useEffect(() => () => {
    if (helpTooltipTimer.current) clearTimeout(helpTooltipTimer.current)
  }, [])

  const undo = useCallback(() => {
    const stack = blockHistoryRef.current[activeProjectId]
    if (!stack || stack.length === 0) {
      showUndoToast("Nothing to undo")
      return
    }
    const previousWorkspace = stack.pop()!
    setProjects(prev => prev.map(p => p.id === activeProjectId
      ? previousWorkspace
      : p
    ))
    showUndoToast("↩ Undone")
  }, [activeProjectId, showUndoToast])

  const activeProject = useMemo(() =>
    projects.find(p => p.id === activeProjectId) || projects[0],
  [projects, activeProjectId])

  const blocks = useMemo(() => activeProject ? workspaceBlocks(activeProject) : [], [activeProject])
  const ghostNotes = activeProject?.ghostNotes || []

  const updateActiveProject = useCallback((updater: (p: Project) => Project) => {
    setProjects(prev => prev.map(p => p.id === activeProjectId ? updater(p) : p))
  }, [activeProjectId])

  // Clear debounce timers for the previous project when switching
  const prevActiveProjectId = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevActiveProjectId.current
    if (prev && prev !== activeProjectId && debounceTimers.current[prev]) {
      Object.values(debounceTimers.current[prev]).forEach(clearTimeout)
      delete debounceTimers.current[prev]
    }
    prevActiveProjectId.current = activeProjectId
  }, [activeProjectId])

  // 1. Persistence: Initial Load & Migration
  useEffect(() => {
    let cancelled = false
    async function loadProjects() {
      try {
        const store = createProjectStore(setHubStatus)
        projectStoreRef.current = store
        let state
        try {
          state = store.loadOrMigrate ? await store.loadOrMigrate() : await store.load()
        } catch (error) {
          if (!(store instanceof ApiStore) || !(error instanceof ApiStoreAuthenticationError)) throw error
          return
        }
        if (!state && store instanceof ApiStore) {
          const browserState = await new BrowserGraphStore(window.localStorage).load()
          if (browserState) { setPendingMigration(browserState); return }
        }
        if (cancelled) return
        if (state) {
          setProjects(state.workspaces)
          setActiveProjectId(state.activeWorkspaceId)
        } else {
          setProjects(INITIAL_PROJECTS)
          setActiveProjectId(INITIAL_PROJECTS[0].id)
        }
        setIsLoaded(true)
      } catch (e) {
        console.error("Canonical project loading failed", e)
        if (!cancelled) alert(e instanceof Error ? e.message : "Nodepad storage failed")
      }
    }
    void loadProjects()

    // Show intro modal on first visit
    if (!localStorage.getItem("nodepad-intro-seen")) {
      setIsIntroOpen(true)
    }

    return () => { cancelled = true }
  }, [])

  const authenticateHub = useCallback(async () => {
    const store = projectStoreRef.current
    if (!(store instanceof ApiStore) || !authToken) return
    setAuthError("")
    try {
      await store.authenticate(authToken)
      setAuthToken("")
      const state = await store.load()
      if (state) { setProjects(state.workspaces); setActiveProjectId(state.activeWorkspaceId); setIsLoaded(true); return }
      const browserState = await new BrowserGraphStore(window.localStorage).load()
      if (browserState) setPendingMigration(browserState)
      else { setProjects(INITIAL_PROJECTS); setActiveProjectId(INITIAL_PROJECTS[0].id); setIsLoaded(true) }
    } catch (error) { setAuthToken(""); setAuthError(error instanceof Error ? error.message : "Authentication failed") }
  }, [authToken])

  const reconnectHub = useCallback(async () => {
    const store = projectStoreRef.current
    if (!(store instanceof ApiStore)) return
    setHubStatus("connecting")
    try {
      const state = await store.load()
      if (state) { setProjects(state.workspaces); setActiveProjectId(state.activeWorkspaceId); setIsLoaded(true) }
    } catch (error) { console.error("Hub reconnect failed", error) }
  }, [])

  const finishMigration = useCallback(async (upload: boolean) => {
    const store = projectStoreRef.current
    if (!(store instanceof ApiStore) || !pendingMigration) return
    if (upload) await store.save(pendingMigration)
    const state = upload ? await store.load() : null
    setPendingMigration(null)
    setProjects(state?.workspaces ?? INITIAL_PROJECTS)
    setActiveProjectId(state?.activeWorkspaceId ?? INITIAL_PROJECTS[0].id)
    setIsLoaded(true)
  }, [pendingMigration])

  // 2. Persistence: Save on Change
  useEffect(() => {
    if (!isLoaded || projects.length === 0) return
    try {
      const store = projectStoreRef.current
      if (!store) return
      void store.save({
        version: STORAGE_SCHEMA_VERSION,
        activeWorkspaceId: activeProjectId,
        workspaces: projects,
        savedAt: Date.now(),
      }).catch(error => {
        console.error("Nodepad persistence failed", error)
        alert(error instanceof Error ? error.message : "Nodepad persistence failed")
      })
    } catch { /* quota exceeded — skip silently */ }
  }, [projects, activeProjectId, isLoaded])

  // Hidden file input for .nodepad import — triggered from sidebar or ⌘K
  const importInputRef = useRef<HTMLInputElement>(null)

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const raw = ev.target?.result as string
        const names = projectsRef.current.map(p => p.name)
        const imported = parseNodepadFile(raw, names) as Project
        setProjects(prev => [...prev, imported])
        setActiveProjectId(imported.id)
        setIsSidebarOpen(false)
      } catch (err) {
        if (err instanceof NodepadParseError) {
          alert(err.message)
        } else {
          alert("Could not import file — make sure it's a valid .nodepad file.")
        }
      }
    }
    reader.readAsText(file)
    // Reset input so the same file can be re-imported if needed
    e.target.value = ""
  }, [])

  // A ref to read current projects without causing re-renders or stale closures
  const projectsRef = useRef(projects)
  useEffect(() => { projectsRef.current = projects }, [projects])

  // Stable ref to active blocks — lets useCallbacks read current blocks without
  // listing `blocks` in their deps (which would recreate them on every state change
  // and cause all memo-ized TileCards to re-render unnecessarily).
  const blocksRef = useRef<TextBlock[]>([])
  useEffect(() => { blocksRef.current = blocks }, [blocks])

  // Tracks which project IDs currently have a ghost generation in-flight
  const generatingRef = useRef<Set<string>>(new Set())

  /**
   * Builds a recency-biased, category-diverse context window for ghost generation.
   * Strategy:
   *   1. Always include the 4 most recently added blocks (freshest thinking).
   *   2. Then add the single most-recent block from every category not yet represented.
   *   3. Fill remaining slots (up to 10 total) with the next most-recent blocks.
   * This forces the model to see cross-category material rather than a wall of the
   * dominant theme.
   */
  function buildGhostContext(enrichedBlocks: TextBlock[]) {
    if (enrichedBlocks.length <= 8) return enrichedBlocks

    const sorted = [...enrichedBlocks].sort((a, b) => b.timestamp - a.timestamp)
    const selected = new Set<string>()
    const result: TextBlock[] = []

    // Step 1 — most recent 4
    sorted.slice(0, 4).forEach(b => { selected.add(b.id); result.push(b) })

    // Step 2 — one representative per missing category
    const representedCats = new Set(result.map(b => b.category))
    const byCat = new Map<string, TextBlock>()
    sorted.forEach(b => {
      if (b.category && !byCat.has(b.category)) byCat.set(b.category, b)
    })
    for (const [cat, block] of byCat) {
      if (result.length >= 10) break
      if (!representedCats.has(cat) && !selected.has(block.id)) {
        selected.add(block.id)
        result.push(block)
        representedCats.add(cat)
      }
    }

    // Step 3 — fill to 10 with remaining recent blocks
    for (const b of sorted) {
      if (result.length >= 10) break
      if (!selected.has(b.id)) { selected.add(b.id); result.push(b) }
    }

    return result
  }

  const generateGhostNote = useCallback(async (projectId: string) => {
    const targetProject = projectsRef.current.find(p => p.id === projectId)

    if (!targetProject) return

    // Require at least 5 enriched blocks
    const enrichedBlocks = workspaceBlocks(targetProject).filter(b => !b.isEnriching && b.category)
    if (enrichedBlocks.length < 5) return

    // Cap panel at 5 ghost notes
    if ((targetProject.ghostNotes || []).length >= 5) return

    // No concurrent generation for this project
    if (generatingRef.current.has(projectId)) return

    // Require at least 5 new blocks since last generation
    const lastCount = targetProject.lastGhostBlockCount || 0
    if (enrichedBlocks.length < lastCount + 5) return

    // Require at least 5 minutes since last generation
    const lastTime = targetProject.lastGhostTimestamp || 0
    const fiveMinutes = 5 * 60 * 1000
    if (Date.now() - lastTime < fiveMinutes) return

    // Require at least 2 distinct categories (meaningful diversity)
    const categories = new Set(enrichedBlocks.map(b => b.category).filter(Boolean))
    if (categories.size < 2) return

    generatingRef.current.add(projectId)
    const ghostId = "ghost-" + generateId()

    setProjects(prev => prev.map(p => p.id === projectId ? {
      ...p,
      ghostNotes: [...(p.ghostNotes || []), { id: ghostId, text: "", category: "thesis", isGenerating: true }],
      lastGhostBlockCount: enrichedBlocks.length,
      lastGhostTimestamp: Date.now()
    } : p))

    try {
      const curated = buildGhostContext(enrichedBlocks)
      const context = curated.map(b => ({
        text: b.text,
        category: b.category,
        contentType: b.contentType,
      }))

      // Pass the last 5 generated ghost texts so the model can avoid near-duplicates
      const previousSyntheses = (targetProject.lastGhostTexts || []).slice(-5)

      const data = await generateGhostClient(context, previousSyntheses)
      setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p
        return {
          ...p,
          ghostNotes: (p.ghostNotes || []).map(n =>
            n.id === ghostId ? { ...n, text: data.text, category: data.category, isGenerating: false } : n
          ),
          // Accumulate ghost texts for dedup (keep last 10)
          lastGhostTexts: [...(p.lastGhostTexts || []), data.text].slice(-10),
        }
      }))
    } catch (e) {
      console.error("Ghost note generation failed", e)
      setProjects(prev => prev.map(p => p.id === projectId
        ? { ...p, ghostNotes: (p.ghostNotes || []).filter(n => n.id !== ghostId) }
        : p
      ))
    } finally {
      generatingRef.current.delete(projectId)
    }
  }, [])

  const enrichBlock = useCallback(async (projectId: string, id: string, text: string, category?: string, forcedType?: string) => {
    // Read context directly from the ref — avoids wrapping in setProjects() which
    // React StrictMode double-invokes in development, causing two concurrent
    // enrichment requests and a visible category flicker.
    const targetProject = projectsRef.current.find(p => p.id === projectId)
    if (!targetProject) return

    const context = workspaceBlocks(targetProject)
      .filter((b) => b.id !== id && !b.isEnriching)
      .map((b) => ({
        id: b.id,
        text: b.text,
        category: b.category,
        annotation: b.annotation,
      }))
      .slice(-15)

    try {
      const data = await enrichBlockClient(
        text,
        context.map(({ id, ...rest }) => ({ id, ...rest })),
        forcedType,
        category,
      )

      // Map indices back to stable block IDs — the context array carries
      // the original block IDs so we get exact, rename-proof references.
      const influencedBy = data.influencedByIndices
        ? (data.influencedByIndices as number[])
            .map((idx) => context[idx]?.id)
            .filter(Boolean) as string[]
        : []

      setProjects((current: Project[]) => {
        const mergeTargetIdx = data.mergeWithIndex
        const mergeTargetId = mergeTargetIdx !== null && context[mergeTargetIdx] ? context[mergeTargetIdx].id : null

        return current.map(proj => {
          if (proj.id !== projectId) return proj

          if (mergeTargetId) {
            const updated = updateWorkspaceBlocks(proj, blocks => blocks
                .filter(b => b.id !== id)
                .map(b => b.id === mergeTargetId ? {
                  ...b,
                  text: b.text + "\n\n" + text,
                  contentType: data.contentType,
                  category: data.category,
                  annotation: data.annotation,
                  confidence: data.confidence,
                  isUnrelated: data.isUnrelated,
                  sources: data.sources ?? undefined,
                  isEnriching: false,
                  statusText: undefined,
                  isError: false,
                } : b))
            return replaceAIInfluencedEdges(updated, mergeTargetId, influencedBy, data.confidence ?? undefined)
          }
          const updated = updateWorkspaceBlocks(proj, blocks => blocks.map(b => b.id === id ? {
              ...b,
              contentType: data.contentType,
              category: data.category,
              annotation: data.annotation,
              confidence: data.confidence,
              isUnrelated: data.isUnrelated,
              sources: data.sources ?? undefined,
              isEnriching: false,
              statusText: undefined,
              isError: false,
            } : b))
          return replaceAIInfluencedEdges(updated, id, influencedBy, data.confidence ?? undefined)
        })
      })

      setTimeout(() => generateGhostNote(projectId), 2500)
    } catch (e: any) {
      console.warn(e)
      const isNoKey = e?.message?.includes("No API key") || e?.message?.includes("Invalid or missing API key") || false
      const errorStatus = isNoKey ? "no-api-key" : (e instanceof Error ? e.message : undefined)
      setProjects((current: Project[]) => current.map(proj => proj.id === projectId
        ? updateWorkspaceBlocks(proj, blocks => blocks.map(b => b.id === id ? { ...b, isEnriching: false, isError: true, statusText: errorStatus } : b))
        : proj))
    }
  }, [generateGhostNote])

  const claimGhostNote = useCallback((id: string) => {
    const note = (activeProject?.ghostNotes || []).find(n => n.id === id)
    if (!note || note.isGenerating) return
    const newId = generateId()
    const { text, category } = note

    updateActiveProject(p => {
      const updatedProject = replaceWorkspaceBlocks(p, [...workspaceBlocks(p), {
          id: newId,
          text,
          timestamp: Date.now(),
          contentType: "thesis" as ContentType,
          category,
          isEnriching: true
        }])
      const withGhostRemoved = {
        ...updatedProject,
        ghostNotes: (p.ghostNotes || []).filter(n => n.id !== id),
      }
      enrichBlock(p.id, newId, text, category, "thesis")
      return withGhostRemoved
    })
  }, [activeProject, updateActiveProject, enrichBlock])

  const dismissGhostNote = useCallback((id: string) => {
    updateActiveProject(p => ({
      ...p,
      ghostNotes: (p.ghostNotes || []).filter(n => n.id !== id),
    }))
  }, [updateActiveProject])

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsCommandKOpen(prev => !prev)
      }
      if (e.key === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        // Don't intercept while typing in an input/textarea
        const tag = (e.target as HTMLElement).tagName
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          e.preventDefault()
          undo()
        }
      }
      if (e.key === "Escape") {
        if (isCommandKOpen) {
          setIsCommandKOpen(false)
        } else if (isGhostPanelOpen) {
          setIsGhostPanelOpen(false)
        }
      }
    }
    window.addEventListener("keydown", handleKeys)
    return () => window.removeEventListener("keydown", handleKeys)
  }, [isCommandKOpen, isGhostPanelOpen, undo])

  const addBlock = useCallback(
    (text: string, forcedType?: ContentType) => {
      // Parse inline #type tag  e.g. "#claim The earth is 4.5 billion years old"
      let resolvedText = text
      let resolvedType = forcedType

      if (!resolvedType) {
        const tagMatch = text.match(/^#([a-z]+)\s+(.+)/i)
        if (tagMatch) {
          const tag = tagMatch[1].toLowerCase() as ContentType
          const ALL_TYPES: ContentType[] = [
            "entity", "claim", "question", "task", "idea", "reference",
            "quote", "definition", "opinion", "reflection", "narrative",
            "comparison", "thesis", "general"
          ]
          if (ALL_TYPES.includes(tag)) {
            resolvedType = tag
            resolvedText = tagMatch[2].trim()
          }
        }
      }

      const newId = generateId()

      // Types where the heuristic is syntactically unambiguous — the AI is also
      // sent forcedType so it won't reclassify them.  We can show these types
      // immediately because they will never change after enrichment.
      const heuristicType = resolvedType ?? detectContentType(resolvedText)
      const HIGH_CONFIDENCE_TYPES = new Set<ContentType>(["question", "reference", "quote", "task"])
      const enrichForcedType = resolvedType
        ?? (HIGH_CONFIDENCE_TYPES.has(heuristicType) ? heuristicType : undefined)

      // For ambiguous types (claim, idea, reflection, …) the AI may return a
      // different classification, so start as "general" during enrichment to
      // avoid a jarring double-classification jump in the UI.
      const initialDisplayType: ContentType = resolvedType
        ?? (HIGH_CONFIDENCE_TYPES.has(heuristicType) ? heuristicType : "general")

      const currentWorkspace = projectsRef.current.find(p => p.id === activeProjectId)
      if (currentWorkspace) pushHistory(activeProjectId, currentWorkspace)
      updateActiveProject(p => replaceWorkspaceBlocks(p, [...workspaceBlocks(p), {
          id: newId,
          text: resolvedText,
          timestamp: Date.now(),
          contentType: initialDisplayType,
          isEnriching: true,
        }]))

      setIsCommandKOpen(false)
      enrichBlock(activeProjectId, newId, resolvedText, undefined, enrichForcedType).catch(console.error)
    },
    [activeProjectId, pushHistory, updateActiveProject, enrichBlock]
  )

  const deleteBlock = useCallback((id: string) => {
    const currentWorkspace = projectsRef.current.find(p => p.id === activeProjectId)
    if (currentWorkspace) pushHistory(activeProjectId, currentWorkspace)
    updateActiveProject(p => updateWorkspaceBlocks(p, blocks => blocks.filter(b => b.id !== id)))
  }, [activeProjectId, pushHistory, updateActiveProject])

  const editBlock = useCallback((id: string, newText: string) => {
    // Snapshot before the edit so Cmd+Z restores the original text
    const currentProj = projectsRef.current.find(p => p.id === activeProjectId)
    if (currentProj) {
      const currentBlock = workspaceBlocks(currentProj).find(b => b.id === id)
      if (currentBlock && currentBlock.text !== newText) {
        pushHistory(activeProjectId, currentProj)
      }
    }

    setProjects(prev => {
      const proj = prev.find(p => p.id === activeProjectId)
      if (!proj) return prev
      const block = workspaceBlocks(proj).find(b => b.id === id)
      if (!block || block.text === newText) return prev

      if (!debounceTimers.current[activeProjectId]) {
        debounceTimers.current[activeProjectId] = {}
      }

      if (debounceTimers.current[activeProjectId][id]) {
        clearTimeout(debounceTimers.current[activeProjectId][id])
      }

      debounceTimers.current[activeProjectId][id] = setTimeout(() => {
        enrichBlock(activeProjectId, id, newText, block.category).catch(console.error)
        delete debounceTimers.current[activeProjectId][id]
      }, 800)

      return prev.map(p => p.id === activeProjectId
        ? updateWorkspaceBlocks(p, blocks => blocks.map(b => b.id === id ? { ...b, text: newText, isEnriching: true, isError: false } : b))
        : p)
    })
  }, [activeProjectId, enrichBlock, pushHistory])

  const reEnrichBlock = useCallback((id: string, newCategory?: string) => {
    const block = blocksRef.current.find(b => b.id === id)
    if (!block) return

    updateActiveProject(p => updateWorkspaceBlocks(p, blocks => blocks.map(b => b.id === id ? { ...b, category: newCategory, isEnriching: true } : b)))

    enrichBlock(activeProjectId, id, block.text, newCategory || block.category, block.contentType).catch(console.error)
  }, [activeProjectId, updateActiveProject, enrichBlock])

  const editAnnotation = useCallback((id: string, newAnnotation: string) => {
    updateActiveProject(p => updateWorkspaceBlocks(p, blocks => blocks.map(b => b.id === id ? { ...b, annotation: newAnnotation } : b)))
  }, [updateActiveProject])

  const toggleCollapse = useCallback((id: string) => {
    updateActiveProject(p => {
      const next = new Set(p.collapsedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...p, collapsedIds: [...next] }
    })
  }, [updateActiveProject])

  const handleTogglePin = useCallback((id: string) => {
    setProjects((current) => current.map(p => p.id === activeProjectId
      ? updateWorkspaceBlocks(p, blocks => blocks.map(b => b.id === id ? { ...b, isPinned: !b.isPinned } : b))
      : p))
  }, [activeProjectId])

  const handleToggleSubTask = useCallback((blockId: string, subTaskId: string) => {
    setProjects((current) => current.map(p => p.id === activeProjectId
      ? updateWorkspaceBlocks(p, blocks => blocks.map(b => b.id === blockId ? {
        ...b,
        subTasks: b.subTasks?.map(st => st.id === subTaskId ? { ...st, isDone: !st.isDone } : st)
      } : b)) : p))
  }, [activeProjectId])

  const handleDeleteSubTask = useCallback((blockId: string, subTaskId: string) => {
    setProjects((current) => current.map(p => p.id === activeProjectId
      ? updateWorkspaceBlocks(p, blocks => blocks.map(b => b.id === blockId ? {
        ...b,
        subTasks: b.subTasks?.filter(st => st.id !== subTaskId)
      } : b)) : p))
  }, [activeProjectId])

  const handleChangeType = useCallback((id: string, newType: ContentType) => {
    const block = blocksRef.current.find(b => b.id === id)
    if (!block) return
    const currentWorkspace = projectsRef.current.find(p => p.id === activeProjectId)
    if (currentWorkspace) pushHistory(activeProjectId, currentWorkspace)
    updateActiveProject(p => updateWorkspaceBlocks(p, blocks => blocks.map(b => b.id === id ? { ...b, contentType: newType, isEnriching: true } : b)))
    enrichBlock(activeProjectId, id, block.text, block.category, newType).catch(console.error)
  }, [activeProjectId, pushHistory, updateActiveProject, enrichBlock])

  const clearBlocks = useCallback(() => {
    const currentWorkspace = projectsRef.current.find(p => p.id === activeProjectId)
    if (currentWorkspace) pushHistory(activeProjectId, currentWorkspace)
    updateActiveProject(p => ({ ...replaceWorkspaceBlocks(p, []), collapsedIds: [] }))
  }, [activeProjectId, pushHistory, updateActiveProject])

  const createProject = useCallback(() => {
    const newProject: Project = {
      id: generateId(),
      name: "New Space",
      entities: [],
      edges: [],
      collapsedIds: [],
      ghostNotes: [],
    }
    setProjects(prev => [...prev, newProject])
    setActiveProjectId(newProject.id)
  }, [])

  const renameProject = useCallback((id: string, newName: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p))
  }, [])

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => {
      if (prev.length <= 1) return prev
      const nextProjects = prev.filter(p => p.id !== id)
      if (activeProjectId === id) {
        setActiveProjectId(nextProjects[0].id)
      }
      return nextProjects
    })
  }, [activeProjectId])

  // Move a block from the active workspace to another workspace.
  // influencedBy references IDs in the source workspace and would be dangling
  // in the target, so we drop them — the block can be re-enriched in context.
  const moveBlockToWorkspace = useCallback((blockId: string, targetWorkspaceId: string) => {
    if (targetWorkspaceId === activeProjectId) return
    const currentWorkspace = projectsRef.current.find(p => p.id === activeProjectId)
    if (currentWorkspace) pushHistory(activeProjectId, currentWorkspace)
    setProjects(prev => {
      const source = prev.find(p => p.id === activeProjectId)
      const block = source ? workspaceBlocks(source).find(b => b.id === blockId) : undefined
      if (!block) return prev
      return prev.map(p => {
        if (p.id === activeProjectId) {
          return {
            ...updateWorkspaceBlocks(p, blocks => blocks.filter(b => b.id !== blockId)),
            collapsedIds: p.collapsedIds.filter(id => id !== blockId),
          }
        }
        if (p.id === targetWorkspaceId) {
          const idCollision = workspaceBlocks(p).some(b => b.id === blockId)
          const moved: TextBlock = {
            ...block,
            id: idCollision ? generateId() : block.id,
            influencedBy: undefined,
          }
          return replaceWorkspaceBlocks(p, [...workspaceBlocks(p), moved])
        }
        return p
      })
    })
    showUndoToast(`→ Moved to ${projectsRef.current.find(p => p.id === targetWorkspaceId)?.name ?? "space"}`)
  }, [activeProjectId, pushHistory, showUndoToast])

  // Copy keeps the original in place and inserts a fresh node (new id, new
  // timestamp, no inherited connections) in the target workspace.
  const copyBlockToWorkspace = useCallback((blockId: string, targetWorkspaceId: string) => {
    if (targetWorkspaceId === activeProjectId) return
    setProjects(prev => {
      const source = prev.find(p => p.id === activeProjectId)
      const block = source ? workspaceBlocks(source).find(b => b.id === blockId) : undefined
      if (!block) return prev
      return prev.map(p => {
        if (p.id !== targetWorkspaceId) return p
        const copy: TextBlock = {
          ...block,
          id: generateId(),
          timestamp: Date.now(),
          influencedBy: undefined,
        }
        return replaceWorkspaceBlocks(p, [...workspaceBlocks(p), copy])
      })
    })
    showUndoToast(`⎘ Copied to ${projectsRef.current.find(p => p.id === targetWorkspaceId)?.name ?? "space"}`)
  }, [activeProjectId, showUndoToast])

  const workspaceOptions = useMemo(
    () => projects.map(p => ({ id: p.id, name: p.name })),
    [projects]
  )

  const handleCommand = useCallback((cmd: string, text?: string) => {
    setIsCommandKOpen(false)
    
    // Handle view switches
    if (cmd === "kanban") {
      setViewMode("kanban")
    } else if (cmd === "tiling") {
      setViewMode("tiling")
    } else if (cmd === "graph") {
      setViewMode("graph")
    } else if (cmd === "open-projects") {
      setIsGhostPanelOpen(false)
      setIsIndexOpen(false)
      setIsSidebarOpen(prev => !prev)
    } else if (cmd === "new-project") {
      setIsGhostPanelOpen(false)
      setIsIndexOpen(false)
      setIsSidebarOpen(true)
      createProject()
    } else if (cmd === "open-index") {
      setIsSidebarOpen(false)
      setIsGhostPanelOpen(false)
      setIsIndexOpen(prev => !prev)
    } else if (cmd === "open-synthesis") {
      setIsSidebarOpen(false)
      setIsIndexOpen(false)
      setIsGhostPanelOpen(prev => !prev)
    } else if (cmd === "clear") clearBlocks()
    else if (cmd === "help") window.open("https://github.com/albingroen/react-cmdk", "_blank")
    
    // .nodepad export / import
    else if (cmd === "export-nodepad") {
      setProjects(prev => {
        const proj = prev.find(p => p.id === activeProjectId)
        if (proj) downloadNodepadFile(proj)
        return prev
      })
    } else if (cmd === "import-nodepad") {
      importInputRef.current?.click()
    }

    // Export commands — read project from state snapshot via ref to avoid stale closure
    else if (cmd === "export-md") {
      setProjects(prev => {
        const proj = prev.find(p => p.id === activeProjectId)
        if (proj) {
          const md = exportToMarkdown(proj.name, workspaceBlocks(proj))
          const slug = proj.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
          downloadMarkdown(`${slug}.md`, md)
        }
        return prev
      })
    } else if (cmd === "copy-md") {
      setProjects(prev => {
        const proj = prev.find(p => p.id === activeProjectId)
        if (proj) {
          const md = exportToMarkdown(proj.name, workspaceBlocks(proj))
          copyToClipboard(md)
        }
        return prev
      })
    }
    
    // Handle type overrides
    else if (cmd === "task" && text) addBlock(text, "task")
    else if (cmd === "thesis" && text) addBlock(text, "thesis")
    
    setIsCommandKOpen(false)
  }, [clearBlocks, addBlock, activeProjectId])

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {hubStatus === "authentication-required" && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm"><form onSubmit={e => { e.preventDefault(); void authenticateHub() }} className="w-96 rounded border border-border bg-card p-6 shadow-2xl"><h2 className="mb-2 font-mono text-sm font-bold">Connect to Nodepad Hub</h2><p className="mb-4 text-xs text-muted-foreground">Enter the single-user Hub token. It is exchanged for an HttpOnly session and is not stored.</p><input autoFocus type="password" value={authToken} onChange={e => setAuthToken(e.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" autoComplete="current-password" />{authError && <p className="mt-2 text-xs text-red-400">{authError}</p>}<button type="submit" className="mt-4 rounded bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Authenticate</button></form></div>}
      {pendingMigration && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm"><div className="w-[430px] rounded border border-border bg-card p-6"><h2 className="font-mono text-sm font-bold">Browser data found</h2><p className="mt-2 text-xs text-muted-foreground">The Hub is empty. Upload {pendingMigration.workspaces.length} workspaces, {pendingMigration.workspaces.reduce((n,w)=>n+w.entities.length,0)} entities, and {pendingMigration.workspaces.reduce((n,w)=>n+w.edges.length,0)} edges?</p><div className="mt-4 flex gap-2"><button onClick={() => void finishMigration(true)} className="rounded bg-primary px-3 py-2 text-xs text-primary-foreground">Upload to Hub</button><button onClick={() => void finishMigration(false)} className="rounded border border-border px-3 py-2 text-xs">Start empty Hub</button></div></div></div>}
      {/* Hidden file input for .nodepad import */}
      <input
        ref={importInputRef}
        type="file"
        accept=".nodepad,.json"
        className="hidden"
        onChange={handleImportFile}
      />

      <ProjectSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={setActiveProjectId}
        onCreateProject={createProject}
        onRenameProject={renameProject}
        onDeleteProject={deleteProject}
        onImportProject={() => importInputRef.current?.click()}
        aiSettings={settings}
        onUpdateAISettings={updateSettings}
        openToSettings={jumpToSettings}
        onSettingsOpened={() => setJumpToSettings(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <StatusBar
          blockCount={blocks.length}
          blocks={blocks}
          isSidebarOpen={isSidebarOpen}
          isIndexOpen={isIndexOpen}
          isGhostPanelOpen={isGhostPanelOpen}
          ghostNoteCount={ghostNotes.filter(n => !n.isGenerating).length}
          activeProjectName={activeProject?.name || ""}
          onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
          onIndexToggle={() => setIsIndexOpen(!isIndexOpen)}
          onGhostPanelToggle={() => setIsGhostPanelOpen(prev => !prev)}
          modelLabel={isHydrated && settings.apiKey ? currentModel.shortLabel : undefined}
          showHelpTooltip={showHelpTooltip}
          onHelpTooltipDismiss={() => {
            setShowHelpTooltip(false)
            if (helpTooltipTimer.current) clearTimeout(helpTooltipTimer.current)
          }}
        />
        <HubStatus status={hubStatus} onReconnect={reconnectHub} />
        <nav className="flex h-8 shrink-0 items-center gap-1 border-b border-border bg-card/40 px-3 font-mono text-[9px] font-bold uppercase tracking-wider">
          <button onClick={()=>setAppView("nodepad")} className={`rounded px-3 py-1 ${appView==="nodepad"?"bg-primary/15 text-primary":"text-muted-foreground hover:bg-secondary"}`}>Nodepad</button>
          <button onClick={()=>setAppView("projects")} className={`rounded px-3 py-1 ${appView==="projects"?"bg-primary/15 text-primary":"text-muted-foreground hover:bg-secondary"}`}>Projects</button>
          <button onClick={()=>setAppView("agents")} className={`rounded px-3 py-1 ${appView==="agents"?"bg-primary/15 text-primary":"text-muted-foreground hover:bg-secondary"}`}>Agents</button>
          <button onClick={()=>setAppView("agtx")} className={`rounded px-3 py-1 ${appView==="agtx"?"bg-primary/15 text-primary":"text-muted-foreground hover:bg-secondary"}`}>AGTX</button>
        </nav>

        {isHydrated && !settings.apiKey && (
          <div className="flex items-center justify-center gap-3 px-4 py-2 bg-amber-950/80 border-b border-amber-800/60 text-amber-200 text-xs shrink-0">
            <span className="opacity-80">⚡ AI enrichment requires an <strong className="text-amber-200">OpenRouter API key</strong> — use a free model (no credits needed) or add credits for GPT-4o, Claude, and more. Configure in the <strong className="text-amber-200">☰ left panel</strong>.</span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => { setIsSidebarOpen(true); setJumpToSettings(true) }}
                className="px-2.5 py-1 rounded bg-amber-700/60 hover:bg-amber-600/70 text-amber-100 font-medium transition-colors cursor-pointer border border-amber-600/50"
              >
                Add API key →
              </button>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-60 hover:opacity-90 transition-opacity underline underline-offset-2"
              >
                Get a free key ↗
              </a>
            </div>
          </div>
        )}

        {appView === "projects" && activeProject ? <div className="flex-1 overflow-hidden"><ProjectsArea workspace={activeProject} onChange={next=>setProjects(prev=>prev.map(p=>p.id===next.id?next:p))} readOnly={hubStatus==="offline-cache"||hubStatus==="conflict"||hubStatus==="error"||hubStatus==="connecting"} onOpenInNodepad={id=>{setHighlightedBlockId(id);setViewMode("graph");setAppView("nodepad")}}/></div> : appView === "agents" && activeProject ? <div className="flex-1 overflow-hidden"><AgentsArea workspace={activeProject} available={getStorageMode()==="server"&&hubStatus==="online"}/></div> : appView === "agtx" && activeProject ? <div className="flex-1 overflow-hidden"><AgTxArea workspace={activeProject} available={getStorageMode()==="server"&&hubStatus==="online"}/></div> : <div className="flex flex-1 overflow-hidden relative" onClickCapture={e=>{if(hubStatus==="offline-cache"||hubStatus==="conflict"||hubStatus==="error"||hubStatus==="connecting"){e.preventDefault();e.stopPropagation()}}} onKeyDownCapture={e=>{if(hubStatus==="offline-cache"||hubStatus==="conflict"||hubStatus==="error"||hubStatus==="connecting"){e.preventDefault();e.stopPropagation()}}}>
          <main className="relative flex-1 overflow-hidden">
            {isLoaded ? (
              viewMode === "tiling" ? (
                <TilingArea
                  key={`tiling-${activeProjectId}`}
                  blocks={blocks}
                  collapsedIds={new Set(activeProject.collapsedIds)}
                  onDelete={deleteBlock}
                  onEdit={editBlock}
                  onEditAnnotation={editAnnotation}
                  onReEnrich={reEnrichBlock}
                  onChangeType={handleChangeType}
                  onToggleCollapse={toggleCollapse}
                  onTogglePin={handleTogglePin}
                  onToggleSubTask={handleToggleSubTask}
                  onDeleteSubTask={handleDeleteSubTask}
                  highlightedBlockId={highlightedBlockId}
                  onHighlight={setHighlightedBlockId}
                  workspaces={workspaceOptions}
                  activeWorkspaceId={activeProjectId}
                  onMoveToWorkspace={moveBlockToWorkspace}
                  onCopyToWorkspace={copyBlockToWorkspace}
                />
              ) : viewMode === "kanban" ? (
                <KanbanArea
                  key={`kanban-${activeProjectId}`}
                  blocks={blocks}
                  onDelete={deleteBlock}
                  onEdit={editBlock}
                  onEditAnnotation={editAnnotation}
                  onReEnrich={reEnrichBlock}
                  onChangeType={handleChangeType}
                  onToggleCollapse={toggleCollapse}
                  onTogglePin={handleTogglePin}
                  onToggleSubTask={handleToggleSubTask}
                  onDeleteSubTask={handleDeleteSubTask}
                  collapsedIds={new Set(activeProject.collapsedIds)}
                />
              ) : (
                <GraphArea
                  key={`graph-${activeProjectId}`}
                  blocks={blocks}
                  ghostNote={ghostNotes[ghostNotes.length - 1]}
                  projectName={activeProject.name}
                  onReEnrich={reEnrichBlock}
                  onChangeType={handleChangeType}
                  onTogglePin={handleTogglePin}
                  onEdit={editBlock}
                  onEditAnnotation={editAnnotation}
                  highlightedBlockId={highlightedBlockId}
                  onHighlight={setHighlightedBlockId}
                />
              )
            ) : (
              <div className="h-full w-full" />
            )}
          </main>

          <GhostPanel
            ghostNotes={ghostNotes}
            isOpen={isGhostPanelOpen}
            onClose={() => setIsGhostPanelOpen(false)}
            onClaim={claimGhostNote}
            onDismiss={dismissGhostNote}
          />
        </div>}

        {/* Undo toast */}
        <AnimatePresence>
          {undoToast && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute bottom-[72px] left-1/2 -translate-x-1/2 z-[130] pointer-events-none"
            >
              <div className="px-3 py-1.5 rounded-sm bg-foreground/90 border border-border backdrop-blur-md shadow-xl">
                <span className="font-mono text-[10px] text-background/70 tracking-tight whitespace-nowrap">{undoToast}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <VimInput
          onSubmit={addBlock}
          onCommand={handleCommand}
          isCommandKOpen={isCommandKOpen}
          setIsCommandKOpen={setIsCommandKOpen}
        />
      </div>

      <TileIndex 
        blocks={blocks} 
        onHighlight={setHighlightedBlockId} 
        highlightedId={highlightedBlockId}
        onClose={() => setIsIndexOpen(false)}
        isOpen={isIndexOpen}
        viewMode={viewMode}
      />

      {/* First-visit intro video modal */}
      <IntroModal open={isIntroOpen} onClose={handleIntroClose} />
    </div>
  )
}
