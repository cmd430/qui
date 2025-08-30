/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Plus, Edit, Trash2, TestTube } from "lucide-react"
import { TQMFilterDialog } from "./TQMFilterDialog"
import { TQMExpressionTester } from "./TQMExpressionTester"
import { useDeleteTQMFilter, useUpdateTQMFilter } from "@/hooks/useTQM"
import type { TQMConfigResponse, TQMTagRule, TQM_TAG_MODES } from "@/types"
import { toast } from "sonner"

interface TQMFilterManagerProps {
  instanceId: number
  config?: TQMConfigResponse
  onClose?: () => void
}

export function TQMFilterManager({
  instanceId,
  config,
}: TQMFilterManagerProps) {
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [expressionTesterOpen, setExpressionTesterOpen] = useState(false)
  const [editingFilter, setEditingFilter] = useState<TQMTagRule | undefined>()
  const [testingExpression, setTestingExpression] = useState<string>("")

  const { mutate: deleteFilter, isPending: isDeletingFilter } = useDeleteTQMFilter(instanceId)
  const { mutate: updateFilter, isPending: isUpdatingFilter } = useUpdateTQMFilter(instanceId)

  const handleEditFilter = (filter: TQMTagRule) => {
    setEditingFilter(filter)
    setFilterDialogOpen(true)
  }

  const handleDeleteFilter = (filter: TQMTagRule) => {
    if (!filter.id) return

    deleteFilter(filter.id, {
      onSuccess: () => {
        toast.success(`Filter "${filter.name}" deleted successfully`)
      },
      onError: (error) => {
        toast.error(`Failed to delete filter: ${error.message}`)
      },
    })
  }

  const handleTestExpression = (expression: string) => {
    setTestingExpression(expression)
    setExpressionTesterOpen(true)
  }

  const handleCreateFilter = () => {
    setEditingFilter(undefined)
    setFilterDialogOpen(true)
  }

  const handleToggleFilter = (filter: TQMTagRule) => {
    if (!filter.id) return

    updateFilter(
      {
        filterId: filter.id,
        filter: {
          name: filter.name,
          mode: filter.mode,
          expression: filter.expression,
          uploadKb: filter.uploadKb,
          enabled: !filter.enabled,
        },
      },
      {
        onSuccess: () => {
          toast.success(
            `Filter "${filter.name}" ${!filter.enabled ? "enabled" : "disabled"}`
          )
        },
        onError: (error) => {
          toast.error(`Failed to update filter: ${error.message}`)
        },
      }
    )
  }

  const getModeColor = (mode: string): "default" | "secondary" | "destructive" => {
    switch (mode) {
      case "add":
        return "default"
      case "remove":
        return "destructive"
      case "full":
        return "secondary"
      default:
        return "default"
    }
  }

  const getModeLabel = (mode: string): string => {
    const modeLabels: Record<keyof typeof TQM_TAG_MODES, string> = {
      add: "Add Only",
      remove: "Remove Only",
      full: "Add/Remove",
    }
    return modeLabels[mode as keyof typeof TQM_TAG_MODES] ?? mode
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Filter Management</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage custom TQM filters for automatic torrent tagging
          </p>
        </div>
        <Button onClick={handleCreateFilter} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Filter
        </Button>
      </div>

      <div className="space-y-3">
        {config?.tagRules?.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">
                  No filters configured yet
                </p>
                <Button onClick={handleCreateFilter} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Filter
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          config?.tagRules?.map((filter) => (
            <Card key={filter.id || filter.name}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <CardTitle className="text-base">{filter.name}</CardTitle>
                    <Badge variant={getModeColor(filter.mode)}>
                      {getModeLabel(filter.mode)}
                    </Badge>
                    {filter.uploadKb && (
                      <Badge variant="outline">
                        {filter.uploadKb} KB/s limit
                      </Badge>
                    )}
                    <div className="flex items-center space-x-1">
                      <Switch
                        checked={filter.enabled}
                        disabled={isUpdatingFilter}
                        onCheckedChange={() => handleToggleFilter(filter)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {filter.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTestExpression(filter.expression)}
                    >
                      <TestTube className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditFilter(filter)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteFilter(filter)}
                      disabled={isDeletingFilter}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Expression
                    </div>
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {filter.expression}
                    </code>
                  </div>

                  {(filter.createdAt || filter.updatedAt) && (
                    <div className="text-xs text-muted-foreground">
                      {filter.createdAt && (
                        <span>
                          Created: {new Date(filter.createdAt).toLocaleString()}
                        </span>
                      )}
                      {filter.updatedAt && filter.createdAt !== filter.updatedAt && (
                        <span className="ml-4">
                          Updated: {new Date(filter.updatedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Filter Dialog */}
      <TQMFilterDialog
        instanceId={instanceId}
        filter={editingFilter}
        open={filterDialogOpen}
        onOpenChange={setFilterDialogOpen}
      />

      {/* Expression Tester Dialog */}
      <TQMExpressionTester
        instanceId={instanceId}
        expression={testingExpression}
        open={expressionTesterOpen}
        onOpenChange={setExpressionTesterOpen}
      />
    </div>
  )
}