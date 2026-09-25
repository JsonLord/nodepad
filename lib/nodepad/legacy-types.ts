import type { ContentType } from "../content-types"

export interface LegacySubTask {
  id: string
  text: string
  isDone: boolean
  timestamp: number
}

/** UI compatibility shape. New domain code should use Entity and Edge instead. */
export interface TextBlock {
  id: string
  text: string
  timestamp: number
  contentType: ContentType
  category?: string
  isEnriching?: boolean
  statusText?: string
  isError?: boolean
  annotation?: string
  confidence?: number | null
  sources?: { url: string; title: string; siteName: string }[]
  influencedBy?: string[]
  isUnrelated?: boolean
  isPinned?: boolean
  subTasks?: LegacySubTask[]
}
