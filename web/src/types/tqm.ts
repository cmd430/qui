// TQM (Torrent Queue Manager) types

export interface TQMConfig {
  id: number
  instanceId: number
  name: string
  enabled: boolean
  filters: TQMTagRule[]
  createdAt: string
  updatedAt: string
}

export interface TQMTagRule {
  id?: number
  configId?: number
  name: string
  mode: "add" | "remove" | "full"
  expression: string
  uploadKb?: number
  enabled: boolean
  createdAt?: string
  updatedAt?: string
}

export interface TQMOperation {
  id: number
  instanceId: number
  operationType: string
  status: "running" | "completed" | "failed"
  torrentsProcessed: number
  tagsApplied: number
  errorMessage?: string
  startedAt: string
  completedAt?: string
}

export interface TQMRetagRequest {
  instanceId: number
  configId?: number
}

export interface TQMRetagResponse {
  operationId: number
  status: string
  torrentsProcessed: number
  tagsApplied: number
  message: string
}

export interface TQMConfigRequest {
  name: string
  enabled: boolean
  filters: TQMTagRule[]
}

export interface TQMConfigResponse {
  config: TQMConfig
  tagRules: TQMTagRule[]
  lastRun?: TQMOperation
}

export interface TQMTorrentTag {
  name: string
  appliedBy: string // "tqm" for TQM-applied tags
}

export interface TQMFilterResult {
  torrentHash: string
  torrentName: string
  tagsToAdd: string[]
  tagsToRemove: string[]
  uploadLimit?: number
  reason: string
}

export interface TQMStatusResponse {
  instanceId: number
  lastRun?: TQMOperation
  enabled: boolean
}

// Common TQM expressions for UI dropdowns
export const COMMON_TQM_EXPRESSIONS = {
  IsUnregistered: "IsUnregistered()",
  IsTrackerDown: "IsTrackerDown()",
  LowSeeds: "Seeds <= 3",
  HighRatio: "Ratio >= 2.0",
  OldTorrent: "SeedingDays >= 30",
  SmallTorrent: "Size <= 100*1024*1024", // 100MB
  LargeTorrent: "Size >= 10*1024*1024*1024", // 10GB
} as const

// Tag modes for UI
export const TQM_TAG_MODES = {
  add: "Add Only",
  remove: "Remove Only",
  full: "Add/Remove",
} as const

// Operation statuses
export const TQM_OPERATION_STATUS = {
  running: "Running",
  completed: "Completed",
  failed: "Failed",
} as const

export type TQMTagMode = keyof typeof TQM_TAG_MODES
export type TQMOperationStatus = keyof typeof TQM_OPERATION_STATUS