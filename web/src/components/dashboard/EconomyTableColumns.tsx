/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, X } from "lucide-react"
import { formatBytes } from "@/lib/utils"
import { getLinuxIsoName } from "@/lib/incognito"
import type { EconomyScore } from "@/types"

interface CustomSelectAllProps {
  onSelectAll: () => void
  isAllSelected: boolean
  isIndeterminate: boolean
}

interface FilterState {
  scoreMin: number | ""
  scoreMax: number | ""
  deduplicationMin: number | ""
  deduplicationMax: number | ""
}

interface FilterHandlers {
  setScoreMin: (value: number | "") => void
  setScoreMax: (value: number | "") => void
  setDeduplicationMin: (value: number | "") => void
  setDeduplicationMax: (value: number | "") => void
}

interface ColumnOptions {
  shiftPressedRef: React.MutableRefObject<boolean>
  lastSelectedIndexRef: React.MutableRefObject<number | null>
  customSelectAll?: CustomSelectAllProps
  onRowSelection?: (hash: string, checked: boolean, rowId?: string) => void
  isAllSelected?: boolean
  excludedFromSelectAll?: Set<string>
  filters?: FilterState
  filterHandlers?: FilterHandlers
  sorting?: { id: string; desc: boolean }[]
  onSortingChange?: (sorting: { id: string; desc: boolean }[]) => void
}

export function createEconomyColumns(
  incognitoMode: boolean,
  options: ColumnOptions = {
    shiftPressedRef: { current: false },
    lastSelectedIndexRef: { current: null },
  }
): ColumnDef<EconomyScore>[] {
  const {
    customSelectAll,
    onRowSelection,
    isAllSelected,
    excludedFromSelectAll,
    filters,
    filterHandlers,
    sorting,
    onSortingChange,
  } = options

  // Helper function for sortable headers
  const createSortableHeader = (title: string, accessorKey: string) => {
    const currentSort = sorting?.find(s => s.id === accessorKey)
    const isSorted = !!currentSort
    const isDesc = currentSort?.desc ?? false

    return (
      <Button
        variant="ghost"
        className="h-auto p-0 font-medium hover:bg-transparent"
        onClick={() => {
          if (onSortingChange) {
            const newSorting = [{ id: accessorKey, desc: isSorted && !isDesc }]
            onSortingChange(newSorting)
          }
        }}
      >
        {title}
        {isSorted && (
          <span className="ml-1">
            {isDesc ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </span>
        )}
      </Button>
    )
  }

  return [
    {
      id: "select",
      header: ({ table }: any) => {
        if (customSelectAll) {
          return (
            <Checkbox
              checked={customSelectAll.isAllSelected}
              onCheckedChange={customSelectAll.onSelectAll}
              aria-label="Select all"
              ref={(el: any) => {
                if (el) {
                  el.indeterminate = customSelectAll.isIndeterminate
                }
              }}
            />
          )
        }

        return (
          <Checkbox
            checked={table.getIsAllRowsSelected()}
            onCheckedChange={(value: any) => table.toggleAllRowsSelected(!!value)}
            aria-label="Select all"
            ref={(el: any) => {
              if (el) {
                el.indeterminate = table.getIsSomeRowsSelected()
              }
            }}
          />
        )
      },
      cell: ({ row }: any) => {
        const isExcluded = isAllSelected && excludedFromSelectAll?.has(row.original.hash)

        if (customSelectAll && isAllSelected) {
          // In "select all" mode, show the exclusion state
          return (
            <Checkbox
              checked={!isExcluded}
              onCheckedChange={(checked: any) => {
                onRowSelection?.(row.original.hash, !!checked, row.id)
              }}
              aria-label="Select row"
            />
          )
        }

        return (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value: any) => {
              if (onRowSelection) {
                onRowSelection(row.original.hash, !!value, row.id)
              } else {
                row.toggleSelected(!!value)
              }
            }}
            aria-label="Select row"
          />
        )
      },
      size: 40,
      enableResizing: false,
      enableSorting: false,
      meta: {
        headerString: "Select",
      },
    },
    {
      accessorKey: "name",
      header: () => createSortableHeader("Name", "name"),
      cell: ({ row }: any) => {
        const torrent = row.original

        return (
          <div className="flex items-center gap-2 max-w-xs">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate" title={incognitoMode ? getLinuxIsoName(torrent.hash) : torrent.name}>
                {incognitoMode ? getLinuxIsoName(torrent.hash) : torrent.name}
              </div>
            </div>
          </div>
        )
      },
      size: 300,
      meta: {
        headerString: "Name",
      },
    },
    {
      accessorKey: "size",
      header: () => createSortableHeader("Size", "size"),
      cell: ({ row }: any) => formatBytes(row.original.size),
      size: 100,
      meta: {
        headerString: "Size",
      },
    },
    {
      accessorKey: "seeds",
      header: () => createSortableHeader("Seeds", "seeds"),
      cell: ({ row }: any) => {
        const seeds = row.original.seeds
        return (
          <Badge variant={seeds < 5 ? "destructive" : seeds < 10 ? "secondary" : "default"}>
            {seeds}
          </Badge>
        )
      },
      size: 80,
      meta: {
        headerString: "Seeds",
      },
    },
    {
      accessorKey: "age",
      header: () => createSortableHeader("Age", "age"),
      cell: ({ row }: any) => `${row.original.age}d`,
      size: 80,
      meta: {
        headerString: "Age (days)",
      },
    },
    {
      accessorKey: "economyScore",
      header: () => {
        const [showFilter, setShowFilter] = React.useState(false)

        return (
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              {createSortableHeader("Economy Score", "economyScore")}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0"
                onClick={() => setShowFilter(!showFilter)}
              >
                {showFilter ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </div>
            {showFilter && filters && filterHandlers && (
              <div className="mt-2 space-y-2 p-2 bg-muted/50 rounded border">
                <div className="flex gap-1">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.scoreMin}
                    onChange={(e) => filterHandlers.setScoreMin(e.target.value === "" ? "" : parseFloat(e.target.value) || "")}
                    className="h-6 text-xs w-16"
                  />
                  <span className="text-xs text-muted-foreground self-center">to</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.scoreMax}
                    onChange={(e) => filterHandlers.setScoreMax(e.target.value === "" ? "" : parseFloat(e.target.value) || "")}
                    className="h-6 text-xs w-16"
                  />
                  {(filters.scoreMin || filters.scoreMax) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        filterHandlers.setScoreMin("")
                        filterHandlers.setScoreMax("")
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      },
      cell: ({ row }: any) => {
        const score = row.original.economyScore

        return (
          <div className={`font-semibold ${score < 20 ? "text-red-600" : score < 50 ? "text-yellow-600" : "text-green-600"}`}>
            {score.toFixed(2)}
          </div>
        )
      },
      size: 120,
      meta: {
        headerString: "Economy Score",
      },
    },
    {
      accessorKey: "ratio",
      header: () => createSortableHeader("Ratio", "ratio"),
      cell: ({ row }: any) => {
        const ratio = row.original.ratio
        return (
          <span className={ratio < 0.5 ? "text-red-500" : ratio < 1.0 ? "text-yellow-500" : "text-green-500"}>
            {ratio.toFixed(2)}
          </span>
        )
      },
      size: 80,
      meta: {
        headerString: "Ratio",
      },
    },
    {
      accessorKey: "state",
      header: "State",
      cell: ({ row }: any) => (
        <Badge variant="outline" className="text-xs">
          {row.original.state}
        </Badge>
      ),
      size: 100,
      meta: {
        headerString: "State",
      },
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }: any) => (
        <Badge variant="outline" className="text-xs">
          {row.original.category || "No Category"}
        </Badge>
      ),
      size: 120,
      meta: {
        headerString: "Category",
      },
    },
    {
      accessorKey: "deduplicationFactor",
      header: () => {
        const [showFilter, setShowFilter] = React.useState(false)

        return (
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              {createSortableHeader("Deduplication", "deduplicationFactor")}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0"
                onClick={() => setShowFilter(!showFilter)}
              >
                {showFilter ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </div>
            {showFilter && filters && filterHandlers && (
              <div className="mt-2 space-y-2 p-2 bg-muted/50 rounded border">
                <div className="flex gap-1">
                  <Input
                    type="number"
                    placeholder="Min"
                    min="0"
                    max="1"
                    step="0.1"
                    value={filters.deduplicationMin}
                    onChange={(e) => filterHandlers.setDeduplicationMin(e.target.value === "" ? "" : parseFloat(e.target.value) || "")}
                    className="h-6 text-xs w-16"
                  />
                  <span className="text-xs text-muted-foreground self-center">to</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    min="0"
                    max="1"
                    step="0.1"
                    value={filters.deduplicationMax}
                    onChange={(e) => filterHandlers.setDeduplicationMax(e.target.value === "" ? "" : parseFloat(e.target.value) || "")}
                    className="h-6 text-xs w-16"
                  />
                  {(filters.deduplicationMin || filters.deduplicationMax) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        filterHandlers.setDeduplicationMin("")
                        filterHandlers.setDeduplicationMax("")
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      },
      cell: ({ row }: any) => {
        const factor = row.original.deduplicationFactor

        return (
          <div className="text-center">
            <div className={`font-medium ${factor > 0.8 ? "text-green-600" : factor > 0.5 ? "text-yellow-600" : "text-red-600"}`}>
              {(factor * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-muted-foreground">
              {formatBytes(row.original.storageValue * (1 - factor))} saved
            </div>
          </div>
        )
      },
      size: 120,
      meta: {
        headerString: "Deduplication",
      },
    },
    {
      accessorKey: "group",
      header: "Group",
      cell: ({ row }: any) => {
        const torrent = row.original

        // For now, show if it has duplicates
        if (torrent.duplicates && torrent.duplicates.length > 0) {
          return (
            <Badge variant="secondary" className="text-xs">
              {torrent.duplicates.length + 1} items
            </Badge>
          )
        }

        return (
          <Badge variant="outline" className="text-xs">
            Individual
          </Badge>
        )
      },
      size: 100,
      meta: {
        headerString: "Group",
      },
    },
  ]
}
