import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useState, useEffect } from 'react'
import type { TextBlock } from '@/components/tile-card'
import { legacyInfluencedByToEdges } from '@/lib/nodepad/legacy-adapter'
import { getConnectedEntityIds } from '@/lib/graph/relationships'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns the platform modifier key symbol: '⌘' on macOS/iOS, 'Ctrl' elsewhere.
 * Starts as '⌘' on the server (SSR) and corrects on the client after mount.
 */
export function useModKey(): string {
  const [mod, setMod] = useState('⌘')
  useEffect(() => {
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform)
    if (!isMac) setMod('Ctrl')
  }, [])
  return mod
}

/**
 * Returns the set of block IDs that are "connected" to the hovered block,
 * based on shared category or influencedBy relationships.
 * Used by tiling-area and kanban-area for the connection-hover dimming effect.
 */
export function getRelatedIds(hoveredId: string, blocks: TextBlock[]): Set<string> {
  if (!blocks.some(block => block.id === hoveredId)) return new Set()
  return getConnectedEntityIds(hoveredId, legacyInfluencedByToEdges(blocks))
}
