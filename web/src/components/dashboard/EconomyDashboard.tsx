/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useDebounce } from "@/hooks/useDebounce"
import { usePersistedColumnOrder } from "@/hooks/usePersistedColumnOrder"
import { usePersistedColumnSizing } from "@/hooks/usePersistedColumnSizing"
import { usePersistedColumnSorting } from "@/hooks/usePersistedColumnSorting"
import { usePersistedColumnVisibility } from "@/hooks/usePersistedColumnVisibility"
import { usePersistedDeleteFiles } from "@/hooks/usePersistedDeleteFiles"
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core"
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers"
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy
} from "@dnd-kit/sortable"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip"
import { useInstanceMetadata } from "@/hooks/useInstanceMetadata"
import { api } from "@/lib/api"
import {
  getLinuxIsoName,
  useIncognitoMode
} from "@/lib/incognito"
import { formatBytes } from "@/lib/utils"

import type { EconomyScore, TorrentGroup } from "@/types"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useSearch } from "@tanstack/react-router"
import { CheckCircle, Columns3, Copy, Eye, EyeOff, Filter, Calculator, Folder, Loader2, Pause, Play, Radio, Tag, Trash2 } from "lucide-react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import { Pagination } from "@/components/ui/pagination"
import { AddTagsDialog, RemoveTagsDialog, SetCategoryDialog, SetTagsDialog } from "../torrents/TorrentDialogs"
import { AddTorrentDialog } from "../torrents/AddTorrentDialog"
import { DraggableTableHeader } from "../torrents/DraggableTableHeader"
import { QueueSubmenu } from "../torrents/QueueSubmenu"
import { TorrentActions } from "../torrents/TorrentActions"
import { ShareLimitSubmenu, SpeedLimitsSubmenu } from "../torrents/TorrentLimitSubmenus"
import { createEconomyColumns } from "./EconomyTableColumns"

// Default values for persisted state hooks (module scope for stable references)
const DEFAULT_COLUMN_VISIBILITY = {
  name: true,
  size: true,
  seeds: true,
  age: true,
  economyScore: true,
  ratio: true,
  state: true,
  category: true,
  tracker: false,
  deduplicationFactor: true,
  group: true,
}
const DEFAULT_COLUMN_SIZING = {}

// Helper function to get default column order (module scope for stable reference)
function getDefaultColumnOrder(): string[] {
  const cols = createEconomyColumns(false)
  return cols.map(col => {
    if ("id" in col && col.id) return col.id
    if ("accessorKey" in col && typeof col.accessorKey === "string") return col.accessorKey
    return null
  }).filter((v): v is string => typeof v === "string")
}

interface EconomyDashboardProps {
  analysis: {
    stats: {
      totalTorrents: number
      totalStorage: number
      deduplicatedStorage: number
      storageSavings: number
      averageEconomyScore: number
      highValueTorrents: number
      rareContentCount: number
      wellSeededOldContent: number
    }
    reviewTorrents: {
      torrents: EconomyScore[]
      torrentGroups: TorrentGroup[]
      pagination: {
        page: number
        pageSize: number
        totalItems: number
        totalPages: number
      }
      groupingEnabled: boolean
    }
  }
  instanceId: number
  onPageChange?: (page: number, pageSize: number) => void
}

export const EconomyDashboard = memo(function EconomyDashboard({ analysis, instanceId, onPageChange }: EconomyDashboardProps) {
  // State management
  const [sorting, setSorting] = usePersistedColumnSorting([{ id: "economyScore", desc: true }])
  const [globalFilter, setGlobalFilter] = useState("")
  const [immediateSearch] = useState("")
  const [rowSelection, setRowSelection] = useState({})
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteFiles, setDeleteFiles] = usePersistedDeleteFiles()
  const [contextMenuHashes, setContextMenuHashes] = useState<string[]>([])
  const [contextMenuTorrents, setContextMenuTorrents] = useState<EconomyScore[]>([])
  const [showAddTagsDialog, setShowAddTagsDialog] = useState(false)
  const [showTagsDialog, setShowTagsDialog] = useState(false)
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [showRemoveTagsDialog, setShowRemoveTagsDialog] = useState(false)
  const [showRecheckDialog, setShowRecheckDialog] = useState(false)
  const [showReannounceDialog, setShowReannounceDialog] = useState(false)
  const [showRefetchIndicator, setShowRefetchIndicator] = useState(false)

  // Preview and filtering state
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [filterScoreMin, setFilterScoreMin] = useState<number | "">("")
  const [filterScoreMax, setFilterScoreMax] = useState<number | "">("")
  const [filterDeduplicationMin, setFilterDeduplicationMin] = useState<number | "">("")
  const [filterDeduplicationMax, setFilterDeduplicationMax] = useState<number | "">("")

  // Custom "select all" state for handling large datasets
  const [isAllSelected, setIsAllSelected] = useState(false)
  const [excludedFromSelectAll, setExcludedFromSelectAll] = useState<Set<string>>(new Set())

  const [incognitoMode, setIncognitoMode] = useIncognitoMode()

  // Track user-initiated actions to differentiate from automatic data updates
  const [lastUserAction, setLastUserAction] = useState<{ type: string; timestamp: number } | null>(null)
  const previousInstanceIdRef = useRef(instanceId)
  const previousSearchRef = useRef("")

  // State for range select capabilities for checkboxes
  const shiftPressedRef = useRef<boolean>(false)
  const lastSelectedIndexRef = useRef<number | null>(null)

  // Column visibility with persistence
  const [columnVisibility, setColumnVisibility] = usePersistedColumnVisibility(DEFAULT_COLUMN_VISIBILITY)
  // Column order with persistence (get default order at runtime to avoid initialization order issues)
  const [columnOrder, setColumnOrder] = usePersistedColumnOrder(getDefaultColumnOrder())
  // Column sizing with persistence
  const [columnSizing, setColumnSizing] = usePersistedColumnSizing(DEFAULT_COLUMN_SIZING)

  // Progressive loading state with async management
  const [loadedRows, setLoadedRows] = useState(100)
  const [isLoadingMoreRows, setIsLoadingMoreRows] = useState(false)

  // Query client for invalidating queries
  const queryClient = useQueryClient()

  // Fetch metadata using shared hook
  const { data: metadata } = useInstanceMetadata(instanceId)
  const availableTags = metadata?.tags || []
  const availableCategories = metadata?.categories || {}

  // Debounce search to prevent excessive filtering (200ms delay for faster response)
  const debouncedSearch = useDebounce(globalFilter, 200)
  const routeSearch = useSearch({ strict: false }) as { q?: string }
  const searchFromRoute = routeSearch?.q || ""

  // Use route search if present, otherwise fall back to local immediate/debounced search
  const effectiveSearch = searchFromRoute || immediateSearch || debouncedSearch

  // Keep local input state in sync with route query so internal effects remain consistent
  useEffect(() => {
    if (searchFromRoute !== globalFilter) {
      setGlobalFilter(searchFromRoute)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFromRoute])

  // Detect user-initiated changes
  useEffect(() => {
    const instanceChanged = previousInstanceIdRef.current !== instanceId
    const searchChanged = previousSearchRef.current !== effectiveSearch

    if (instanceChanged || searchChanged) {
      setLastUserAction({
        type: instanceChanged ? "instance" : "search",
        timestamp: Date.now(),
      })

      // Update refs
      previousInstanceIdRef.current = instanceId
      previousSearchRef.current = effectiveSearch
    }
  }, [instanceId, effectiveSearch])

  // Map TanStack Table column IDs to backend field names

  // Use analysis data directly
  const { reviewTorrents } = analysis
  const { torrents: currentTorrents, pagination } = reviewTorrents
  const { page, pageSize, totalItems, totalPages } = pagination

  const hasLoadedAll = page >= totalPages

  // Show refetch indicator only if fetching takes more than 2 seconds
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>

    if (false) { // We don't have isFetching in this component
      timeoutId = setTimeout(() => {
        setShowRefetchIndicator(true)
      }, 2000)
    } else {
      setShowRefetchIndicator(false)
    }

    return () => clearTimeout(timeoutId)
  }, [])

  // Use torrents directly from analysis
  const sortedTorrents = currentTorrents

  // Custom filtering logic
  const filteredTorrents = useMemo(() => {
    let filtered = sortedTorrents

    // Filter by economy score
    if (filterScoreMin !== "" || filterScoreMax !== "") {
      filtered = filtered.filter(torrent => {
        const score = torrent.economyScore
        const minCheck = filterScoreMin === "" || score >= filterScoreMin
        const maxCheck = filterScoreMax === "" || score <= filterScoreMax
        return minCheck && maxCheck
      })
    }

    // Filter by deduplication factor
    if (filterDeduplicationMin !== "" || filterDeduplicationMax !== "") {
      filtered = filtered.filter(torrent => {
        const factor = torrent.deduplicationFactor
        const minCheck = filterDeduplicationMin === "" || factor >= filterDeduplicationMin
        const maxCheck = filterDeduplicationMax === "" || factor <= filterDeduplicationMax
        return minCheck && maxCheck
      })
    }

    return filtered
  }, [sortedTorrents, filterScoreMin, filterScoreMax, filterDeduplicationMin, filterDeduplicationMax])

  // Safe loaded rows to prevent virtualizer issues
  const safeLoadedRows = useMemo(() => Math.min(loadedRows, filteredTorrents.length), [loadedRows, filteredTorrents.length])

  // Custom selection handlers for "select all" functionality
  const handleSelectAll = useCallback(() => {
    // Gmail-style behavior: if any rows are selected, always deselect all
    const hasAnySelection = isAllSelected || Object.values(rowSelection).some(selected => selected)

    if (hasAnySelection) {
      // Deselect all mode - regardless of checked state
      setIsAllSelected(false)
      setExcludedFromSelectAll(new Set())
      setRowSelection({})
    } else {
      // Select all mode - only when nothing is selected
      setIsAllSelected(true)
      setExcludedFromSelectAll(new Set())
      setRowSelection({})
    }
  }, [setRowSelection, isAllSelected, rowSelection])

  const handleRowSelection = useCallback((hash: string, checked: boolean, rowId?: string) => {
    if (isAllSelected) {
      if (!checked) {
        // When deselecting a row in "select all" mode, add to exclusions
        setExcludedFromSelectAll(prev => new Set(prev).add(hash))
      } else {
        // When selecting a row that was excluded, remove from exclusions
        setExcludedFromSelectAll(prev => {
          const newSet = new Set(prev)
          newSet.delete(hash)
          return newSet
        })
      }
    } else {
      // Regular selection mode - use table's built-in selection with correct row ID
      const keyToUse = rowId || hash // Use rowId if provided, fallback to hash for backward compatibility
      setRowSelection(prev => ({
        ...prev,
        [keyToUse]: checked,
      }))
    }
  }, [isAllSelected, setRowSelection])

  // Calculate these after we have selectedHashes
  const isSelectAllChecked = useMemo(() => {
    if (isAllSelected) {
      // When in "select all" mode, only show checked if no exclusions exist
      return excludedFromSelectAll.size === 0
    }
    const regularSelectionCount = Object.keys(rowSelection)
      .filter((key: string) => (rowSelection as Record<string, boolean>)[key]).length
    return regularSelectionCount === filteredTorrents.length && filteredTorrents.length > 0
  }, [isAllSelected, excludedFromSelectAll.size, rowSelection, filteredTorrents.length])

  const isSelectAllIndeterminate = useMemo(() => {
    // Show indeterminate (dash) when SOME but not ALL items are selected
    if (isAllSelected) {
      // In "select all" mode, show indeterminate if some are excluded
      return excludedFromSelectAll.size > 0
    }

    const regularSelectionCount = Object.keys(rowSelection)
      .filter((key: string) => (rowSelection as Record<string, boolean>)[key]).length

    // Indeterminate when some (but not all) are selected
    return regularSelectionCount > 0 && regularSelectionCount < filteredTorrents.length
  }, [isAllSelected, excludedFromSelectAll.size, rowSelection, filteredTorrents.length])

  // Memoize columns to avoid unnecessary recalculations
  const columns = useMemo(
    () => createEconomyColumns(incognitoMode, {
      shiftPressedRef,
      lastSelectedIndexRef,
      // Pass custom selection handlers
      customSelectAll: {
        onSelectAll: handleSelectAll,
        isAllSelected: isSelectAllChecked,
        isIndeterminate: isSelectAllIndeterminate,
      },
      onRowSelection: handleRowSelection,
      isAllSelected,
      excludedFromSelectAll,
    }),
    [incognitoMode, handleSelectAll, isSelectAllChecked, isSelectAllIndeterminate, handleRowSelection, isAllSelected, excludedFromSelectAll]
  )

  const table = useReactTable({
    data: filteredTorrents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // Use torrent hash with index as unique row ID to handle duplicates
    getRowId: (row: EconomyScore, index: number) => `${row.hash}-${index}`,
    // State management
    state: {
      sorting,
      globalFilter,
      rowSelection,
      columnSizing,
      columnVisibility,
      columnOrder,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    // Enable row selection
    enableRowSelection: true,
    // Enable column resizing
    enableColumnResizing: true,
    columnResizeMode: "onChange" as const,
    // Prevent automatic state resets during data updates
    autoResetPageIndex: false,
    autoResetExpanded: false,
  })

  // Get selected torrent hashes - handle both regular selection and "select all" mode
  const selectedHashes = useMemo((): string[] => {
    if (isAllSelected) {
      // When all are selected, return all currently loaded hashes minus exclusions
      // This is needed for actions to work properly
      return sortedTorrents
        .map((t: EconomyScore) => t.hash)
        .filter((hash: string) => !excludedFromSelectAll.has(hash))
    } else {
      // Regular selection mode - get hashes from selected torrents directly
      const tableRows = table.getRowModel().rows
      return tableRows
        .filter(row => (rowSelection as Record<string, boolean>)[row.id])
        .map(row => row.original.hash)
    }
  }, [rowSelection, isAllSelected, excludedFromSelectAll, filteredTorrents, table])

  // Calculate the effective selection count for display
  const effectiveSelectionCount = useMemo(() => {
    if (isAllSelected) {
      // When all selected, count is total minus exclusions
      return Math.max(0, totalItems - excludedFromSelectAll.size)
    } else {
      // Regular selection mode - use the computed selectedHashes length
      return Object.keys(rowSelection)
        .filter((key: string) => (rowSelection as Record<string, boolean>)[key]).length
    }
  }, [isAllSelected, totalItems, excludedFromSelectAll.size, rowSelection])

  // Get selected torrents
  const selectedTorrents = useMemo((): EconomyScore[] => {
    if (isAllSelected) {
      // When all are selected, return all torrents minus exclusions
      return sortedTorrents.filter((t: EconomyScore) => !excludedFromSelectAll.has(t.hash))
    } else {
      // Regular selection mode
      return selectedHashes
        .map((hash: string) => sortedTorrents.find((t: EconomyScore) => t.hash === hash))
        .filter(Boolean) as EconomyScore[]
    }
  }, [selectedHashes, sortedTorrents, isAllSelected, excludedFromSelectAll])

  // Virtualization setup with progressive loading
  const { rows } = table.getRowModel()
  const parentRef = useRef<HTMLDivElement>(null)

  // Load more rows as user scrolls (only for progressive loading, not when using pagination)
  const loadMore = useCallback((): void => {
    // If we have pagination, don't do progressive loading
    if (totalPages > 1) {
      return
    }

    // First, try to load more from virtual scrolling if we have more local data
    if (loadedRows < filteredTorrents.length) {
      // Prevent concurrent loads
      if (isLoadingMoreRows) {
        return
      }

      setIsLoadingMoreRows(true)

      setLoadedRows(prev => {
        const newLoadedRows = Math.min(prev + 100, filteredTorrents.length)
        return newLoadedRows
      })

      // Reset loading flag after a short delay
      setTimeout(() => setIsLoadingMoreRows(false), 100)
    } else if (page < totalPages && onPageChange) {
      // If we've displayed all local data but there's more on backend, load next page
      onPageChange(page + 1, pageSize)
    }
  }, [filteredTorrents.length, isLoadingMoreRows, loadedRows, page, totalPages, pageSize, onPageChange])

  // Update loadedRows based on pagination mode
  useEffect(() => {
    if (totalPages > 1) {
      // When using pagination, load all current page data
      setLoadedRows(filteredTorrents.length)
    } else {
      // When using progressive loading, start with 100
      setLoadedRows(prev => Math.min(prev, filteredTorrents.length) || 100)
    }
  }, [totalPages, filteredTorrents.length])

  // useVirtualizer must be called at the top level, not inside useMemo
  const virtualizer = useVirtualizer({
    count: safeLoadedRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    // Optimized overscan based on dataset size and pagination mode
    overscan: totalPages > 1 ? 5 : filteredTorrents.length > 50000 ? 3 : filteredTorrents.length > 10000 ? 5 : filteredTorrents.length > 1000 ? 10 : 15,
    // Provide a key to help with item tracking - use hash with index for uniqueness
    getItemKey: useCallback((index: number) => {
      const row = rows[index]
      return row?.original?.hash ? `${row.original.hash}-${index}` : `loading-${index}`
    }, [rows]),
    // Optimized onChange handler following TanStack Virtual best practices
    onChange: (instance, sync) => {
      const vRows = instance.getVirtualItems();
      const lastItem = vRows.at(-1);

      // Only trigger loadMore when scrolling has paused (sync === false) or we're not actively scrolling
      // This prevents excessive loadMore calls during rapid scrolling
      const shouldCheckLoadMore = !sync || !instance.isScrolling

      if (shouldCheckLoadMore && lastItem && lastItem.index >= safeLoadedRows - 50) {
        // Load more if we're near the end of virtual rows OR if we might need more data from backend
        if (safeLoadedRows < rows.length || (page < totalPages && onPageChange)) {
          loadMore();
        }
      }
    },
  })

  // Force virtualizer to recalculate when count changes
  useEffect(() => {
    virtualizer.measure()
  }, [safeLoadedRows, virtualizer])

  const virtualRows = virtualizer.getVirtualItems()

  // Memoize minTableWidth to avoid recalculation on every row render
  const minTableWidth = useMemo(() => {
    return table.getVisibleLeafColumns().reduce((width, col) => {
      return width + col.getSize()
    }, 0)
  }, [table])

  // Derive hidden columns state from table API for accuracy
  const hasHiddenColumns = useMemo(() => {
    return table.getAllLeafColumns().filter(c => c.getCanHide()).some(c => !c.getIsVisible())
  }, [table])

  // Reset loaded rows when data changes significantly
  useEffect(() => {
    // Always ensure loadedRows is at least 100 (or total length if less)
    const targetRows = Math.min(100, filteredTorrents.length)

    setLoadedRows(prev => {
      if (filteredTorrents.length === 0) {
        // No data, reset to 0
        return 0
      } else if (prev === 0) {
        // Initial load
        return targetRows
      } else if (prev < targetRows) {
        // Not enough rows loaded, load at least 100
        return targetRows
      }
      // Don't reset loadedRows backward due to temporary server data fluctuations
      // Progressive loading should be independent of server data variations
      return prev
    })

    // Force virtualizer to recalculate
    virtualizer.measure()
  }, [filteredTorrents.length, virtualizer])

  // Reset when filters or search changes
  useEffect(() => {
    // Only reset loadedRows for user-initiated changes, not data updates
    const isRecentUserAction = lastUserAction && (Date.now() - lastUserAction.timestamp < 1000)

    if (isRecentUserAction) {
      const targetRows = Math.min(100, filteredTorrents.length || 0)
      setLoadedRows(targetRows)
      setIsLoadingMoreRows(false)

      // Clear selection state when data changes
      setIsAllSelected(false)
      setExcludedFromSelectAll(new Set())
      setRowSelection({})

      // User-initiated change: scroll to top
      if (parentRef.current) {
        parentRef.current.scrollTop = 0
        setTimeout(() => {
          virtualizer.scrollToOffset(0)
          virtualizer.measure()
        }, 0)
      }
    } else {
      // Data update only: just remeasure without resetting loadedRows
      setTimeout(() => {
        virtualizer.measure()
      }, 0)
    }
  }, [effectiveSearch, instanceId, virtualizer, filteredTorrents.length, setRowSelection, lastUserAction])

  // Mutation for bulk actions
  const mutation = useMutation({
    mutationFn: (data: {
      action: "pause" | "resume" | "delete" | "recheck" | "reannounce" | "increasePriority" | "decreasePriority" | "topPriority" | "bottomPriority" | "addTags" | "removeTags" | "setTags" | "setCategory" | "toggleAutoTMM" | "setShareLimit" | "setUploadLimit" | "setDownloadLimit"
      hashes: string[]
      deleteFiles?: boolean
      tags?: string
      category?: string
      enable?: boolean
      ratioLimit?: number
      seedingTimeLimit?: number
      inactiveSeedingTimeLimit?: number
      uploadLimit?: number
      downloadLimit?: number
      selectAll?: boolean
      filters?: {
        status: string[]
        categories: string[]
        tags: string[]
        trackers: string[]
      }
      search?: string
      excludeHashes?: string[]
    }) => {
      return api.bulkAction(instanceId, {
        hashes: data.hashes,
        action: data.action,
        deleteFiles: data.deleteFiles,
        tags: data.tags,
        category: data.category,
        enable: data.enable,
        ratioLimit: data.ratioLimit,
        seedingTimeLimit: data.seedingTimeLimit,
        inactiveSeedingTimeLimit: data.inactiveSeedingTimeLimit,
        uploadLimit: data.uploadLimit,
        downloadLimit: data.downloadLimit,
        selectAll: data.selectAll,
        filters: data.filters,
        search: data.search,
        excludeHashes: data.excludeHashes,
      })
    },
    onSuccess: async (_, variables) => {
      // For delete operations, optimistically remove from UI immediately
      if (variables.action === "delete") {
        // Clear selection and context menu immediately
        setRowSelection({})
        setContextMenuHashes([])

        // Optimistically remove torrents from ALL cached queries for this instance
        // This includes all pages, filters, and search variations
        const cache = queryClient.getQueryCache()
        const queries = cache.findAll({
          queryKey: ["torrents-list", instanceId],
          exact: false,
        })

        queries.forEach((query) => {
          queryClient.setQueryData(query.queryKey, (oldData: {
            torrents?: EconomyScore[]
            total?: number
            totalCount?: number
          }) => {
            if (!oldData) return oldData
            return {
              ...oldData,
              torrents: oldData.torrents?.filter((t: EconomyScore) =>
                !variables.hashes.includes(t.hash)
              ) || [],
              total: Math.max(0, (oldData.total || 0) - variables.hashes.length),
              totalCount: Math.max(0, (oldData.totalCount || oldData.total || 0) - variables.hashes.length),
            }
          })
        })

        // Refetch later to sync with actual server state (don't invalidate!)
        // Longer delay when deleting files from disk
        const refetchDelay = variables.deleteFiles ? 5000 : 2000

        setTimeout(() => {
          // Use refetch instead of invalidate to keep showing data
          queryClient.refetchQueries({
            queryKey: ["torrents-list", instanceId],
            exact: false,
            type: "active", // Only refetch if component is mounted
          })
          // Also refetch the counts query
          queryClient.refetchQueries({
            queryKey: ["torrent-counts", instanceId],
            exact: false,
            type: "active",
          })
        }, refetchDelay)
      } else {
        // For other operations, add delay to allow qBittorrent to process
        // Resume operations need more time for state transition
        const refetchDelay = variables.action === "resume" ? 2000 : 1000

        setTimeout(() => {
          // Use refetch instead of invalidate to avoid loading state
          queryClient.refetchQueries({
            queryKey: ["torrents-list", instanceId],
            exact: false,
            type: "active",
          })
          queryClient.refetchQueries({
            queryKey: ["torrent-counts", instanceId],
            exact: false,
            type: "active",
          })
        }, refetchDelay)
        setContextMenuHashes([])
      }
    },
  })

  const handleDelete = async () => {
    await mutation.mutateAsync({
      action: "delete",
      deleteFiles,
      hashes: isAllSelected ? [] : contextMenuHashes,  // Empty hashes when selectAll is true
      selectAll: isAllSelected,
      search: isAllSelected ? effectiveSearch : undefined,
      excludeHashes: isAllSelected ? Array.from(excludedFromSelectAll) : undefined,
    })
    setShowDeleteDialog(false)
    setDeleteFiles(false)
    setContextMenuHashes([])
  }

  const handleAddTags = async (tags: string[]) => {
    await mutation.mutateAsync({
      hashes: isAllSelected ? [] : contextMenuHashes,  // Empty hashes when selectAll is true
      action: "addTags",
      tags: tags.join(","),
      selectAll: isAllSelected,
      search: isAllSelected ? effectiveSearch : undefined,
      excludeHashes: isAllSelected ? Array.from(excludedFromSelectAll) : undefined,
    })
    setShowAddTagsDialog(false)
    setContextMenuHashes([])
  }

  const handleSetTags = async (tags: string[]) => {
    // Use setTags action (with fallback to addTags for older versions)
    // The backend will handle the version check
    try {
      await mutation.mutateAsync({
        hashes: isAllSelected ? [] : contextMenuHashes,  // Empty hashes when selectAll is true
        action: "setTags",
        tags: tags.join(","),
        selectAll: isAllSelected,
        search: isAllSelected ? effectiveSearch : undefined,
        excludeHashes: isAllSelected ? Array.from(excludedFromSelectAll) : undefined,
      })
    } catch (error) {
      // If setTags fails due to version requirement, fall back to addTags
      if ((error as Error).message?.includes("requires qBittorrent")) {
        await mutation.mutateAsync({
          hashes: isAllSelected ? [] : contextMenuHashes,  // Empty hashes when selectAll is true
          action: "addTags",
          tags: tags.join(","),
          selectAll: isAllSelected,
          search: isAllSelected ? effectiveSearch : undefined,
          excludeHashes: isAllSelected ? Array.from(excludedFromSelectAll) : undefined,
        })
      } else {
        throw error
      }
    }

    setShowTagsDialog(false)
    setContextMenuHashes([])
  }

  const handleSetCategory = async (category: string) => {
    await mutation.mutateAsync({
      action: "setCategory",
      category,
      hashes: isAllSelected ? [] : contextMenuHashes,  // Empty hashes when selectAll is true
      selectAll: isAllSelected,
      search: isAllSelected ? effectiveSearch : undefined,
      excludeHashes: isAllSelected ? Array.from(excludedFromSelectAll) : undefined,
    })
    setShowCategoryDialog(false)
    setContextMenuHashes([])
  }

  const handleRemoveTags = async (tags: string[]) => {
    await mutation.mutateAsync({
      action: "removeTags",
      tags: tags.join(","),
      hashes: isAllSelected ? [] : contextMenuHashes,  // Empty hashes when selectAll is true
      selectAll: isAllSelected,
      search: isAllSelected ? effectiveSearch : undefined,
      excludeHashes: isAllSelected ? Array.from(excludedFromSelectAll) : undefined,
    })
    setShowRemoveTagsDialog(false)
    setContextMenuHashes([])
  }

  const handleSetShareLimit = async (ratioLimit: number, seedingTimeLimit: number, inactiveSeedingTimeLimit: number, hashes?: string[]) => {
    const targetHashes = hashes || contextMenuHashes
    await mutation.mutateAsync({
      action: "setShareLimit",
      hashes: targetHashes,
      ratioLimit,
      seedingTimeLimit,
      inactiveSeedingTimeLimit,
    })
    setContextMenuHashes([])
  }

  const handleSetSpeedLimits = async (uploadLimit: number, downloadLimit: number, hashes?: string[]) => {
    const targetHashes = hashes || contextMenuHashes
    // Set upload and download limits separately since they are different actions
    const promises = []
    if (uploadLimit >= 0) {
      promises.push(mutation.mutateAsync({ action: "setUploadLimit", hashes: targetHashes, uploadLimit }))
    }
    if (downloadLimit >= 0) {
      promises.push(mutation.mutateAsync({ action: "setDownloadLimit", hashes: targetHashes, downloadLimit }))
    }

    if (promises.length > 0) {
      await Promise.all(promises)
    }

    setContextMenuHashes([])
  }

  const handleContextMenuAction = useCallback((action: "pause" | "resume" | "recheck" | "reannounce" | "increasePriority" | "decreasePriority" | "topPriority" | "bottomPriority" | "toggleAutoTMM", hashes: string[], enable?: boolean) => {
    setContextMenuHashes(hashes)
    mutation.mutate({ action, hashes, enable })
  }, [mutation])

  const handleRecheck = useCallback(async () => {
    await mutation.mutateAsync({
      action: "recheck",
      hashes: isAllSelected ? [] : contextMenuHashes,
      selectAll: isAllSelected,
      search: isAllSelected ? effectiveSearch : undefined,
      excludeHashes: isAllSelected ? Array.from(excludedFromSelectAll) : undefined,
    })
    setShowRecheckDialog(false)
    setContextMenuHashes([])
  }, [mutation, isAllSelected, contextMenuHashes, effectiveSearch, excludedFromSelectAll])

  const handleReannounce = useCallback(async () => {
    await mutation.mutateAsync({
      action: "reannounce",
      hashes: isAllSelected ? [] : contextMenuHashes,
      selectAll: isAllSelected,
      search: isAllSelected ? effectiveSearch : undefined,
      excludeHashes: isAllSelected ? Array.from(excludedFromSelectAll) : undefined,
    })
    setShowReannounceDialog(false)
    setContextMenuHashes([])
  }, [mutation, isAllSelected, contextMenuHashes, effectiveSearch, excludedFromSelectAll])

  const handleRecheckClick = useCallback((hashes: string[]) => {
    const count = isAllSelected ? effectiveSelectionCount : hashes.length
    if (count > 1) {
      setContextMenuHashes(hashes)
      setShowRecheckDialog(true)
    } else {
      handleContextMenuAction("recheck", hashes)
    }
  }, [isAllSelected, effectiveSelectionCount, handleContextMenuAction])

  const handleReannounceClick = useCallback((hashes: string[]) => {
    const count = isAllSelected ? effectiveSelectionCount : hashes.length
    if (count > 1) {
      setContextMenuHashes(hashes)
      setShowReannounceDialog(true)
    } else {
      handleContextMenuAction("reannounce", hashes)
    }
  }, [isAllSelected, effectiveSelectionCount, handleContextMenuAction])

  const copyToClipboard = useCallback(async (text: string, type: "name" | "hash") => {
    try {
      await navigator.clipboard.writeText(text)
      const message = type === "name" ? "Torrent name copied!" : "Torrent hash copied!"
      toast.success(message)
    } catch {
      toast.error("Failed to copy to clipboard")
    }
  }, [])

  // Synchronous version for immediate use (backwards compatibility)
  const getCommonTagsSync = (torrents: EconomyScore[]): string[] => {
    if (torrents.length === 0) return []

    // Fast path for single torrent
    if (torrents.length === 1) {
      return [] // EconomyScore doesn't have tags field
    }

    // For economy scores, we don't have tags, so return empty
    return []
  }

  // Optimized version of getCommonCategory with early returns
  const getCommonCategory = (torrents: EconomyScore[]): string => {
    // Early returns for common cases
    if (torrents.length === 0) return ""
    if (torrents.length === 1) return torrents[0].category || ""

    const firstCategory = torrents[0].category || ""

    // Use direct loop instead of every() for early return optimization
    for (let i = 1; i < torrents.length; i++) {
      if ((torrents[i].category || "") !== firstCategory) {
        return "" // Different category found, no need to check the rest
      }
    }

    return firstCategory
  }

  // Drag and drop setup
  // Sensors must be called at the top level, not inside useMemo
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setColumnOrder((currentOrder: string[]) => {
        const oldIndex = currentOrder.indexOf(active.id as string)
        const newIndex = currentOrder.indexOf(over.id as string)
        return arrayMove(currentOrder, oldIndex, newIndex)
      })
    }
  }, [setColumnOrder])

  return (
    <div className="h-full flex flex-col">
      {/* Search and Actions */}
      <div className="flex flex-col gap-2 flex-shrink-0">
        {/* Search bar row */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Filter button */}
          <div className="hidden xl:block">
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className={`relative ${filterScoreMin !== "" || filterScoreMax !== "" || filterDeduplicationMin !== "" || filterDeduplicationMax !== "" ? "border-primary" : ""}`}
                    >
                      <Filter className="h-4 w-4" />
                      {(filterScoreMin !== "" || filterScoreMax !== "" || filterDeduplicationMin !== "" || filterDeduplicationMax !== "") && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full" />
                      )}
                      <span className="sr-only">Filter torrents</span>
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Filter torrents</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Filter Torrents</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="p-4 space-y-4">
                  <div>
                    <Label htmlFor="score-min" className="text-sm font-medium">Economy Score Range</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="score-min"
                        type="number"
                        placeholder="Min"
                        value={filterScoreMin}
                        onChange={(e) => setFilterScoreMin(e.target.value === "" ? "" : parseFloat(e.target.value) || "")}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground self-center">to</span>
                      <Input
                        id="score-max"
                        type="number"
                        placeholder="Max"
                        value={filterScoreMax}
                        onChange={(e) => setFilterScoreMax(e.target.value === "" ? "" : parseFloat(e.target.value) || "")}
                        className="w-20"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="dedup-min" className="text-sm font-medium">Deduplication Factor Range</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="dedup-min"
                        type="number"
                        placeholder="Min"
                        min="0"
                        max="1"
                        step="0.1"
                        value={filterDeduplicationMin}
                        onChange={(e) => setFilterDeduplicationMin(e.target.value === "" ? "" : parseFloat(e.target.value) || "")}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground self-center">to</span>
                      <Input
                        id="dedup-max"
                        type="number"
                        placeholder="Max"
                        min="0"
                        max="1"
                        step="0.1"
                        value={filterDeduplicationMax}
                        onChange={(e) => setFilterDeduplicationMax(e.target.value === "" ? "" : parseFloat(e.target.value) || "")}
                        className="w-20"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFilterScoreMin("")
                        setFilterScoreMax("")
                        setFilterDeduplicationMin("")
                        setFilterDeduplicationMax("")
                      }}
                      className="flex-1"
                    >
                      Clear Filters
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFilterScoreMin(0)
                        setFilterScoreMax(2)
                      }}
                      className="flex-1"
                    >
                      Low Value (Score &lt; 2.0)
                    </Button>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {/* Action buttons */}
          <div className="flex gap-1 sm:gap-2 flex-shrink-0">
            {(() => {
              const actions = effectiveSelectionCount > 0 ? (
                <TorrentActions
                  instanceId={instanceId}
                  selectedHashes={selectedHashes}
                  onComplete={() => {
                    setRowSelection({})
                    setIsAllSelected(false)
                    setExcludedFromSelectAll(new Set())
                  }}
                  isAllSelected={isAllSelected}
                  totalSelectionCount={effectiveSelectionCount}
                  search={effectiveSearch}
                  excludeHashes={Array.from(excludedFromSelectAll)}
                />
              ) : null
              const headerLeft = typeof document !== "undefined" ? document.getElementById("header-left-of-filter") : null
              return (
                <>
                  {/* Mobile/tablet inline (hidden on xl and up) */}
                  <div className="xl:hidden">
                    {actions}
                  </div>
                  {/* Desktop portal: render directly left of the filter button in header */}
                  {headerLeft && actions ? createPortal(actions, headerLeft) : null}
                </>
              )
            })()}

            {/* Column visibility dropdown moved next to search via portal, with inline fallback */}
            {(() => {
              const container = typeof document !== "undefined" ? document.getElementById("header-search-actions") : null
              const dropdown = (
                <DropdownMenu>
                  <Tooltip disableHoverableContent={true}>
                    <TooltipTrigger
                      asChild
                      onFocus={(e) => {
                        // Prevent tooltip from showing on focus - only show on hover
                        e.preventDefault()
                      }}
                    >
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="relative"
                        >
                          <Columns3 className="h-4 w-4" />
                          {hasHiddenColumns && (
                            <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full" />
                          )}
                          <span className="sr-only">Toggle columns</span>
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Toggle columns</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {table
                      .getAllColumns()
                      .filter(
                        (column) =>
                          column.id !== "select" && // Never show select in visibility options
                          column.getCanHide()
                      )
                      .map((column) => {
                        return (
                          <DropdownMenuCheckboxItem
                            key={column.id}
                            className="capitalize"
                            checked={column.getIsVisible()}
                            onCheckedChange={(value) =>
                              column.toggleVisibility(!!value)
                            }
                            onSelect={(e) => e.preventDefault()}
                          >
                            <span className="truncate">
                              {(column.columnDef.meta as { headerString?: string })?.headerString ||
                               (typeof column.columnDef.header === "string" ? column.columnDef.header : column.id)}
                            </span>
                          </DropdownMenuCheckboxItem>
                        )
                      })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )
              return container ? createPortal(dropdown, container) : dropdown
            })()}

            <AddTorrentDialog
              instanceId={instanceId}
              open={false} // Economy dashboard doesn't have add torrent for now
              onOpenChange={() => {}}
            />
          </div>
        </div>
      </div>

      {/* Table container */}
      <div className={`flex flex-col flex-1 min-h-0 mt-2 sm:mt-0 overflow-hidden ${effectiveSelectionCount > 0 ? 'pb-20' : ''}`}>
        <div className="relative flex-1 overflow-auto scrollbar-thin" ref={parentRef}>
          <div style={{ position: "relative", minWidth: "min-content" }}>
            {/* Header */}
            <div className="sticky top-0 bg-background border-b" style={{ zIndex: 50 }}>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToHorizontalAxis]}
              >
                {table.getHeaderGroups().map(headerGroup => {
                  const headers = headerGroup.headers
                  const headerIds = headers.map(h => h.column.id)

                  return (
                    <SortableContext
                      key={headerGroup.id}
                      items={headerIds}
                      strategy={horizontalListSortingStrategy}
                    >
                      <div className="flex" style={{ minWidth: `${minTableWidth}px` }}>
                        {headers.map(header => (
                          <DraggableTableHeader
                            key={header.id}
                            header={header}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  )
                })}
              </DndContext>
            </div>

            {/* Body */}
            {filteredTorrents.length === 0 ? (
              // Show empty state
              <div className="p-8 text-center text-muted-foreground">
                <p>No torrents found matching the current filters</p>
                {(filterScoreMin !== "" || filterScoreMax !== "" || filterDeduplicationMin !== "" || filterDeduplicationMax !== "") && (
                  <p className="text-sm mt-2">
                    Try adjusting your filters to see more results
                  </p>
                )}
              </div>
            ) : (
              // Show virtual table
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualRows.map(virtualRow => {
                  const row = rows[virtualRow.index]
                  if (!row || !row.original) return null
                  const torrent = row.original

                  // Use memoized minTableWidth
                  return (
                    <ContextMenu key={`${torrent.hash}-${virtualRow.index}`}>
                      <ContextMenuTrigger asChild>
                        <div
                          className={`flex border-b cursor-pointer hover:bg-muted/50 ${row.getIsSelected() ? "bg-muted/50" : ""}`}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            minWidth: `${minTableWidth}px`,
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                          onClick={(e) => {
                            // Don't select when clicking checkbox or its wrapper
                            const target = e.target as HTMLElement
                            const isCheckbox = target.closest("[data-slot=\"checkbox\"]") || target.closest("[role=\"checkbox\"]") || target.closest(".p-1.-m-1")
                            if (!isCheckbox) {
                              // Economy dashboard doesn't have torrent details view for now
                            }
                          }}
                          onContextMenu={() => {
                            // Only select this row if not already selected and not part of a multi-selection
                            if (!row.getIsSelected() && selectedHashes.length <= 1) {
                              setRowSelection({ [row.id]: true })
                            }
                          }}
                        >
                          {row.getVisibleCells().map(cell => (
                            <div
                              key={cell.id}
                              style={{
                                width: cell.column.getSize(),
                                flexShrink: 0,
                              }}
                              className="px-3 py-2 flex items-center overflow-hidden min-w-0"
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </div>
                          ))}
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => {}}>
                          View Details
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onClick={() => {
                            // Use selected torrents if this row is part of selection, or just this torrent
                            const useSelection = row.getIsSelected() || isAllSelected
                            const hashes = useSelection ? selectedHashes : [torrent.hash]
                            handleContextMenuAction("resume", hashes)
                          }}
                          disabled={mutation.isPending}
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Resume {(row.getIsSelected() || isAllSelected) && effectiveSelectionCount > 1 ? `(${effectiveSelectionCount})` : ""}
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => {
                            // Use selected torrents if this row is part of selection, or just this torrent
                            const useSelection = row.getIsSelected() || isAllSelected
                            const hashes = useSelection ? selectedHashes : [torrent.hash]
                            handleContextMenuAction("pause", hashes)
                          }}
                          disabled={mutation.isPending}
                        >
                          <Pause className="mr-2 h-4 w-4" />
                          Pause {(row.getIsSelected() || isAllSelected) && effectiveSelectionCount > 1 ? `(${effectiveSelectionCount})` : ""}
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => {
                            // Use selected torrents if this row is part of selection, or just this torrent
                            const useSelection = row.getIsSelected() || isAllSelected
                            const hashes = useSelection ? selectedHashes : [torrent.hash]
                            handleRecheckClick(hashes)
                          }}
                          disabled={mutation.isPending}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Force Recheck {(row.getIsSelected() || isAllSelected) && effectiveSelectionCount > 1 ? `(${effectiveSelectionCount})` : ""}
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => {
                            // Use selected torrents if this row is part of selection, or just this torrent
                            const useSelection = row.getIsSelected() || isAllSelected
                            const hashes = useSelection ? selectedHashes : [torrent.hash]
                            handleReannounceClick(hashes)
                          }}
                          disabled={mutation.isPending}
                        >
                          <Radio className="mr-2 h-4 w-4" />
                          Reannounce {(row.getIsSelected() || isAllSelected) && effectiveSelectionCount > 1 ? `(${effectiveSelectionCount})` : ""}
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        {(() => {
                          // Use selected torrents if this row is part of selection, or just this torrent
                          const useSelection = row.getIsSelected() || isAllSelected
                          const hashes = useSelection ? selectedHashes : [torrent.hash]
                          const hashCount = isAllSelected ? effectiveSelectionCount : hashes.length

                          const handleQueueAction = (action: "topPriority" | "increasePriority" | "decreasePriority" | "bottomPriority") => {
                            handleContextMenuAction(action, hashes)
                          }

                          return (
                            <QueueSubmenu
                              type="context"
                              hashCount={hashCount}
                              onQueueAction={handleQueueAction}
                              isPending={mutation.isPending}
                            />
                          )
                        })()}
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onClick={() => {
                            // Use selected torrents if this row is part of selection, or just this torrent
                            const useSelection = row.getIsSelected() || isAllSelected
                            const hashes = useSelection ? selectedHashes : [torrent.hash]
                            const torrents = useSelection ? selectedTorrents : [torrent]

                            setContextMenuHashes(hashes)
                            setContextMenuTorrents(torrents)
                            setShowAddTagsDialog(true)
                          }}
                          disabled={mutation.isPending}
                        >
                          <Tag className="mr-2 h-4 w-4" />
                          Add Tags {(row.getIsSelected() || isAllSelected) && effectiveSelectionCount > 1 ? `(${effectiveSelectionCount})` : ""}
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => {
                            // Use selected torrents if this row is part of selection, or just this torrent
                            const useSelection = row.getIsSelected() || isAllSelected
                            const hashes = useSelection ? selectedHashes : [torrent.hash]
                            const torrents = useSelection ? selectedTorrents : [torrent]

                            setContextMenuHashes(hashes)
                            setContextMenuTorrents(torrents)
                            setShowTagsDialog(true)
                          }}
                          disabled={mutation.isPending}
                        >
                          <Tag className="mr-2 h-4 w-4" />
                          Replace Tags {(row.getIsSelected() || isAllSelected) && effectiveSelectionCount > 1 ? `(${effectiveSelectionCount})` : ""}
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => {
                            // Use selected torrents if this row is part of selection, or just this torrent
                            const useSelection = row.getIsSelected() || isAllSelected
                            const hashes = useSelection ? selectedHashes : [torrent.hash]
                            const torrents = useSelection ? selectedTorrents : [torrent]

                            setContextMenuHashes(hashes)
                            setContextMenuTorrents(torrents)
                            setShowCategoryDialog(true)
                          }}
                          disabled={mutation.isPending}
                        >
                          <Folder className="mr-2 h-4 w-4" />
                          Set Category {(row.getIsSelected() || isAllSelected) && effectiveSelectionCount > 1 ? `(${effectiveSelectionCount})` : ""}
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        {(() => {
                          // Use selected torrents if this row is part of selection, or just this torrent
                          const useSelection = row.getIsSelected() || isAllSelected
                          const hashes = useSelection ? selectedHashes : [torrent.hash]
                          const hashCount = isAllSelected ? effectiveSelectionCount : hashes.length

                          // Create wrapped handlers that pass hashes directly
                          const handleSetShareLimitWrapper = (ratioLimit: number, seedingTimeLimit: number, inactiveSeedingTimeLimit: number) => {
                            handleSetShareLimit(ratioLimit, seedingTimeLimit, inactiveSeedingTimeLimit, hashes)
                          }

                          const handleSetSpeedLimitsWrapper = (uploadLimit: number, downloadLimit: number) => {
                            handleSetSpeedLimits(uploadLimit, downloadLimit, hashes)
                          }

                          return (
                            <>
                              <ShareLimitSubmenu
                                type="context"
                                hashCount={hashCount}
                                onConfirm={handleSetShareLimitWrapper}
                                isPending={mutation.isPending}
                              />
                              <SpeedLimitsSubmenu
                                type="context"
                                hashCount={hashCount}
                                onConfirm={handleSetSpeedLimitsWrapper}
                                isPending={mutation.isPending}
                              />
                            </>
                          )
                        })()}
                        <ContextMenuSeparator />
                        {(() => {
                          // EconomyScore doesn't have auto_tmm field, so skip this section
                          return null
                        })()}
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => copyToClipboard(incognitoMode ? getLinuxIsoName(torrent.hash) : torrent.name, "name")}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Name
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => copyToClipboard(torrent.hash, "hash")}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Hash
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onClick={() => {
                            // Use selected torrents if this row is part of selection, or just this torrent
                            const useSelection = row.getIsSelected() || isAllSelected
                            const hashes = useSelection ? selectedHashes : [torrent.hash]

                            setContextMenuHashes(hashes)
                            setShowDeleteDialog(true)
                          }}
                          disabled={mutation.isPending}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete {(row.getIsSelected() || isAllSelected) && effectiveSelectionCount > 1 ? `(${effectiveSelectionCount})` : ""}
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between p-2 border-t flex-shrink-0">
          <div className="text-sm text-muted-foreground">
            {/* Show special loading message when fetching without cache (cold load) */}
            {false ? ( // We don't have isLoading in this component
              <>
                <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
                Loading torrents from instance... (no cache available)
              </>
            ) : totalItems === 0 ? (
              "No torrents found"
            ) : totalPages > 1 ? (
              <>
                Showing page {page} of {totalPages} ({filteredTorrents.length} torrents)
              </>
            ) : (
              <>
                {filteredTorrents.length} torrent{filteredTorrents.length !== 1 ? "s" : ""} needing review
                {hasLoadedAll ? (
                  ""
                ) : isLoadingMoreRows ? (
                  " (loading more...)"
                ) : (
                  ` (${filteredTorrents.length} of ${totalItems} loaded • Scroll to load more)`
                )}
              </>
            )}
            {effectiveSelectionCount > 0 && (
              <>
                <span className="ml-2">
                  ({isAllSelected && excludedFromSelectAll.size === 0 ? `All ${effectiveSelectionCount}` : effectiveSelectionCount} selected)
                </span>
              </>
            )}
            {showRefetchIndicator && (
              <span className="ml-2">
                <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
                Updating...
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Incognito mode toggle - barely visible */}
            <button
              onClick={() => setIncognitoMode(!incognitoMode)}
              className="p-1 rounded-sm transition-all hover:bg-muted/50"
              title={incognitoMode ? "Exit incognito mode" : "Enable incognito mode"}
            >
              {incognitoMode ? (
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t p-4">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={onPageChange || (() => {})}
            showPageSizeSelector={false}
            showPageJump={true}
          />
        </div>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {isAllSelected ? effectiveSelectionCount : contextMenuHashes.length} torrent(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The torrents will be removed from qBittorrent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center space-x-2 py-4">
            <input
              type="checkbox"
              id="deleteFiles"
              checked={deleteFiles}
              onChange={(e) => setDeleteFiles(e.target.checked)}
              className="rounded border-input"
            />
            <label htmlFor="deleteFiles" className="text-sm font-medium">
              Also delete files from disk
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Tags Dialog */}
      <AddTagsDialog
        open={showAddTagsDialog}
        onOpenChange={setShowAddTagsDialog}
        availableTags={availableTags || []}
        hashCount={isAllSelected ? effectiveSelectionCount : contextMenuHashes.length}
        onConfirm={handleAddTags}
        isPending={mutation.isPending}
      />

      {/* Set Tags Dialog */}
      <SetTagsDialog
        open={showTagsDialog}
        onOpenChange={setShowTagsDialog}
        availableTags={availableTags || []}
        hashCount={isAllSelected ? effectiveSelectionCount : contextMenuHashes.length}
        onConfirm={handleSetTags}
        isPending={mutation.isPending}
        initialTags={getCommonTagsSync(contextMenuTorrents)}
      />

      {/* Set Category Dialog */}
      <SetCategoryDialog
        open={showCategoryDialog}
        onOpenChange={setShowCategoryDialog}
        availableCategories={availableCategories || {}}
        hashCount={isAllSelected ? effectiveSelectionCount : contextMenuHashes.length}
        onConfirm={handleSetCategory}
        isPending={mutation.isPending}
        initialCategory={getCommonCategory(contextMenuTorrents)}
      />

      {/* Remove Tags Dialog */}
      <RemoveTagsDialog
        open={showRemoveTagsDialog}
        onOpenChange={setShowRemoveTagsDialog}
        availableTags={availableTags || []}
        hashCount={isAllSelected ? effectiveSelectionCount : contextMenuHashes.length}
        onConfirm={handleRemoveTags}
        isPending={mutation.isPending}
        currentTags={getCommonTagsSync(contextMenuTorrents)}
      />

      {/* Force Recheck Confirmation Dialog */}
      <Dialog open={showRecheckDialog} onOpenChange={setShowRecheckDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force Recheck {isAllSelected ? effectiveSelectionCount : contextMenuHashes.length} torrent(s)?</DialogTitle>
            <DialogDescription>
              This will force qBittorrent to recheck all pieces of the selected torrents. This process may take some time and will temporarily pause the torrents.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecheckDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecheck} disabled={mutation.isPending}>
              Force Recheck
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reannounce Confirmation Dialog */}
      <Dialog open={showReannounceDialog} onOpenChange={setShowReannounceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reannounce {isAllSelected ? effectiveSelectionCount : contextMenuHashes.length} torrent(s)?</DialogTitle>
            <DialogDescription>
              This will force the selected torrents to reannounce to all their trackers. This is useful when trackers are not responding or you want to refresh your connection.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReannounceDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleReannounce} disabled={mutation.isPending}>
              Reannounce
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Impact Analysis Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Impact Analysis</DialogTitle>
            <DialogDescription>
              Comprehensive analysis of removing duplicate torrents from your selection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {(() => {
              const selectedTorrents = selectedHashes.map(hash =>
                filteredTorrents.find(t => t.hash === hash)
              ).filter(Boolean) as EconomyScore[]

              const totalSize = selectedTorrents.reduce((sum, t) => sum + t.size, 0)
              const duplicates = selectedTorrents.filter(t => t.deduplicationFactor === 0)
              const uniqueTorrents = selectedTorrents.filter(t => t.deduplicationFactor > 0)

              // Age analysis
              const avgAgeAll = selectedTorrents.reduce((sum, t) => sum + t.age, 0) / selectedTorrents.length
              const avgAgeDuplicates = duplicates.length > 0 ? duplicates.reduce((sum, t) => sum + t.age, 0) / duplicates.length : 0
              const avgAgeUnique = uniqueTorrents.length > 0 ? uniqueTorrents.reduce((sum, t) => sum + t.age, 0) / uniqueTorrents.length : 0

              // State analysis
              const stateBreakdown = selectedTorrents.reduce((acc, t) => {
                acc[t.state] = (acc[t.state] || 0) + 1
                return acc
              }, {} as Record<string, number>)

              // Category analysis
              const categoryBreakdown = selectedTorrents.reduce((acc, t) => {
                acc[t.category] = (acc[t.category] || 0) + 1
                return acc
              }, {} as Record<string, number>)

              // Tracker analysis
              const trackerBreakdown = selectedTorrents.reduce((acc, t) => {
                acc[t.tracker] = (acc[t.tracker] || 0) + 1
                return acc
              }, {} as Record<string, number>)

              // Size analysis
              const totalDuplicateSize = duplicates.reduce((sum, t) => sum + t.size, 0)
              const avgDuplicateSize = duplicates.length > 0 ? totalDuplicateSize / duplicates.length : 0

              // Ratio analysis
              const totalRatioBefore = selectedTorrents.reduce((sum, t) => sum + t.ratio, 0) / selectedTorrents.length
              const totalRatioAfter = uniqueTorrents.length > 0
                ? uniqueTorrents.reduce((sum, t) => sum + t.ratio, 0) / uniqueTorrents.length
                : 0
              const ratioImpact = totalRatioBefore - totalRatioAfter

              // Seeds analysis
              const avgSeedsAll = selectedTorrents.reduce((sum, t) => sum + t.seeds, 0) / selectedTorrents.length
              const avgSeedsDuplicates = duplicates.length > 0 ? duplicates.reduce((sum, t) => sum + t.seeds, 0) / duplicates.length : 0
              const avgSeedsUnique = uniqueTorrents.length > 0 ? uniqueTorrents.reduce((sum, t) => sum + t.seeds, 0) / uniqueTorrents.length : 0

              return (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold">{selectedTorrents.length}</div>
                      <div className="text-sm text-muted-foreground">Total Selected</div>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{duplicates.length}</div>
                      <div className="text-sm text-muted-foreground">Duplicates</div>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{uniqueTorrents.length}</div>
                      <div className="text-sm text-muted-foreground">Unique</div>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{formatBytes(totalDuplicateSize)}</div>
                      <div className="text-sm text-muted-foreground">Space to Free</div>
                    </div>
                  </div>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-semibold">Storage Impact</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Total size:</span>
                          <span className="font-medium">{formatBytes(totalSize)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Duplicate size:</span>
                          <span className="font-medium text-red-600">{formatBytes(totalDuplicateSize)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Space saved:</span>
                          <span className="font-medium text-green-600">{formatBytes(totalDuplicateSize)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Avg duplicate size:</span>
                          <span className="font-medium">{formatBytes(avgDuplicateSize)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold">Ratio Impact</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Current avg ratio:</span>
                          <span className="font-medium">{totalRatioBefore.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>After removal:</span>
                          <span className="font-medium">{totalRatioAfter.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Ratio change:</span>
                          <span className={`font-medium ${ratioImpact > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {ratioImpact > 0 ? '-' : '+'}{Math.abs(ratioImpact).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Age Analysis */}
                  <div className="space-y-4">
                    <h4 className="font-semibold">Age Analysis</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="p-3 bg-muted/30 rounded">
                        <div className="font-medium">{avgAgeAll.toFixed(1)}d</div>
                        <div className="text-muted-foreground">Avg age (all)</div>
                      </div>
                      <div className="p-3 bg-red-50 rounded">
                        <div className="font-medium text-red-600">{avgAgeDuplicates.toFixed(1)}d</div>
                        <div className="text-muted-foreground">Avg age (duplicates)</div>
                      </div>
                      <div className="p-3 bg-green-50 rounded">
                        <div className="font-medium text-green-600">{avgAgeUnique.toFixed(1)}d</div>
                        <div className="text-muted-foreground">Avg age (unique)</div>
                      </div>
                    </div>
                  </div>

                  {/* Seeding Status */}
                  <div className="space-y-4">
                    <h4 className="font-semibold">Seeding Status</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="p-3 bg-muted/30 rounded">
                        <div className="font-medium">{avgSeedsAll.toFixed(1)}</div>
                        <div className="text-muted-foreground">Avg seeds (all)</div>
                      </div>
                      <div className="p-3 bg-red-50 rounded">
                        <div className="font-medium text-red-600">{avgSeedsDuplicates.toFixed(1)}</div>
                        <div className="text-muted-foreground">Avg seeds (duplicates)</div>
                      </div>
                      <div className="p-3 bg-green-50 rounded">
                        <div className="font-medium text-green-600">{avgSeedsUnique.toFixed(1)}</div>
                        <div className="text-muted-foreground">Avg seeds (unique)</div>
                      </div>
                    </div>
                  </div>

                  {/* Breakdowns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-semibold">State Breakdown</h4>
                      <div className="space-y-1 text-sm">
                        {Object.entries(stateBreakdown).map(([state, count]) => (
                          <div key={state} className="flex justify-between">
                            <span>{state}:</span>
                            <span className="font-medium">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold">Category Breakdown</h4>
                      <div className="space-y-1 text-sm">
                        {Object.entries(categoryBreakdown).map(([category, count]) => (
                          <div key={category} className="flex justify-between">
                            <span>{category || 'No Category'}:</span>
                            <span className="font-medium">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Tracker Impact */}
                  <div className="space-y-4">
                    <h4 className="font-semibold">Tracker Impact</h4>
                    <div className="space-y-1 text-sm">
                      {Object.entries(trackerBreakdown).map(([tracker, count]) => (
                        <div key={tracker} className="flex justify-between">
                          <span>{tracker}:</span>
                          <span className="font-medium">{count} torrent{count !== 1 ? 's' : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <h4 className="font-semibold text-amber-800 mb-2">Recommendations</h4>
                    <ul className="text-sm text-amber-700 space-y-1">
                      {ratioImpact > 0.5 && (
                        <li>• High ratio impact detected - consider keeping some duplicates for ratio health</li>
                      )}
                      {avgAgeDuplicates > avgAgeUnique + 30 && (
                        <li>• Duplicates are significantly older - good candidates for removal</li>
                      )}
                      {avgSeedsDuplicates < 2 && (
                        <li>• Duplicates have low seed counts - safe to remove</li>
                      )}
                      {totalDuplicateSize > 1024 * 1024 * 1024 * 10 && (
                        <li>• Large storage savings available - consider removal if space is critical</li>
                      )}
                      <li>• Review tracker distribution - removing duplicates may affect multiple trackers</li>
                    </ul>
                  </div>
                </>
              )
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Close
            </Button>
            <Button onClick={() => {
              // TODO: Implement actual duplicate removal action
              setShowPreviewDialog(false)
              toast.success("Duplicate removal action would be performed here")
            }}>
              <Trash2 className="mr-2 h-4 w-4" />
              Proceed with Removal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fancy Bottom Calculator Bar */}
      {effectiveSelectionCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 text-white shadow-2xl border-t border-white/20 z-50 animate-in slide-in-from-bottom-2 duration-300">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm border border-white/30 shadow-lg">
                    <Calculator className="h-5 w-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Impact Analysis</div>
                    <div className="text-xs text-white/80">
                      {effectiveSelectionCount} torrent{effectiveSelectionCount !== 1 ? 's' : ''} selected
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="hidden md:flex items-center gap-6 text-sm">
                  {(() => {
                    const selectedTorrents = selectedHashes.map(hash =>
                      filteredTorrents.find(t => t.hash === hash)
                    ).filter(Boolean) as EconomyScore[]

                    const duplicates = selectedTorrents.filter(t => t.deduplicationFactor === 0)
                    const totalSize = selectedTorrents.reduce((sum, t) => sum + t.size, 0)
                    const totalDuplicateSize = duplicates.reduce((sum, t) => sum + t.size, 0)

                    return (
                      <>
                        <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-md">
                          <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                          <span className="font-medium">{duplicates.length} duplicates</span>
                        </div>
                        <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-md">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                          <span className="font-medium">{formatBytes(totalDuplicateSize)} to save</span>
                        </div>
                        <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-md">
                          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                          <span className="font-medium">{formatBytes(totalSize)} total</span>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowPreviewDialog(true)}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30 hover:border-white/50 transition-all duration-200 hover:scale-105 shadow-lg"
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  View Analysis
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    // TODO: Implement actual duplicate removal action
                    toast.success("Duplicate removal action would be performed here")
                  }}
                  className="bg-red-500 hover:bg-red-600 transition-all duration-200 hover:scale-105 shadow-lg border border-red-400/50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Duplicates
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
