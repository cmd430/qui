/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { formatBytes } from "@/lib/utils"
import { getLinuxIsoName } from "@/lib/incognito"
import type { EconomyScore } from "@/types"

interface CustomSelectAllProps {
  onSelectAll: () => void
  isAllSelected: boolean
  isIndeterminate: boolean
}

interface ColumnOptions {
  shiftPressedRef: React.MutableRefObject<boolean>
  lastSelectedIndexRef: React.MutableRefObject<number | null>
  customSelectAll?: CustomSelectAllProps
  onRowSelection?: (hash: string, checked: boolean, rowId?: string) => void
  isAllSelected?: boolean
  excludedFromSelectAll?: Set<string>
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
  } = options

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
      header: "Name",
      cell: ({ row }: any) => {
        const torrent = row.original
        const isDuplicate = torrent.deduplicationFactor === 0

        return (
          <div className="flex items-center gap-2 max-w-xs">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate" title={incognitoMode ? getLinuxIsoName(torrent.hash) : torrent.name}>
                {incognitoMode ? getLinuxIsoName(torrent.hash) : torrent.name}
              </div>
              {isDuplicate && (
                <Badge variant="outline" className="text-xs mt-1">
                  Duplicate
                </Badge>
              )}
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
      header: "Size",
      cell: ({ row }: any) => formatBytes(row.original.size),
      size: 100,
      meta: {
        headerString: "Size",
      },
    },
    {
      accessorKey: "seeds",
      header: "Seeds",
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
      header: "Age",
      cell: ({ row }: any) => `${row.original.age}d`,
      size: 80,
      meta: {
        headerString: "Age (days)",
      },
    },
    {
      accessorKey: "economyScore",
      header: "Economy Score",
      cell: ({ row }: any) => {
        const score = row.original.economyScore
        const isDuplicate = row.original.deduplicationFactor === 0

        return (
          <div className={`font-semibold ${score < 20 ? "text-red-600" : score < 50 ? "text-yellow-600" : "text-green-600"}`}>
            {isDuplicate ? (
              <span className="text-gray-500">0.00 (Dup)</span>
            ) : (
              score.toFixed(2)
            )}
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
      header: "Ratio",
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
      accessorKey: "tracker",
      header: "Tracker",
      cell: ({ row }: any) => (
        <div className="max-w-32 truncate text-xs" title={row.original.tracker}>
          {row.original.tracker}
        </div>
      ),
      size: 150,
      meta: {
        headerString: "Tracker",
      },
    },
  ]
}
