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

// New types for extended TQM API
export interface TQMFilterTemplate {
  id: string
  name: string
  description: string
  expression: string
  category: string
  mode: TQMTagMode
  uploadKb?: number
}

export interface TQMFilterRequest {
  name: string
  mode: TQMTagMode
  expression: string
  uploadKb?: number
  enabled: boolean
}

export interface TQMExpressionValidationRequest {
  expression: string
}

export interface TQMExpressionValidationResult {
  valid: boolean
  error?: string
  fields?: string[]
}

export interface TQMExpressionTestRequest {
  expression: string
  limit?: number
}

export interface TQMExpressionTestResult {
  torrentHash: string
  torrentName: string
  matched: boolean
  error?: string
  evaluatedTo?: unknown
}

export interface TQMExpressionTestResponse {
  results: TQMExpressionTestResult[]
  totalTested: number
  matchedCount: number
  errorCount: number
}

// Filter template categories for UI organization
export const TQM_FILTER_CATEGORIES = {
  tracker: "Tracker Issues",
  seeding: "Seeding Management",
  ratio: "Ratio-based",
  age: "Age-based",
  size: "Size-based",
  bandwidth: "Bandwidth Control",
  state: "Torrent State",
  recent: "Recent Activity",
} as const

export type TQMFilterCategory = keyof typeof TQM_FILTER_CATEGORIES