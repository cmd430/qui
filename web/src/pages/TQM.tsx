/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useState } from "react"
import { useInstances } from "@/hooks/useInstances"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  TQMStatusIndicator,
  RetagButton,
  TQMConfigurationForm,
  TQMFilterManager
} from "@/components/tqm"
import { useTQMConfig, useTQMStatus } from "@/hooks/useTQM"
import type { TQMConfigResponse } from "@/types"
import {
  Tags,
  Server,
  Activity,
  HardDrive,
  Plus
} from "lucide-react"
import { Link } from "@tanstack/react-router"
import { cn } from "@/lib/utils"
import type { InstanceResponse } from "@/types"

function InstanceSelector({
  instances,
  selectedInstanceId,
  onInstanceSelect,
}: {
  instances: InstanceResponse[]
  selectedInstanceId: number | null
  onInstanceSelect: (instanceId: number) => void
}) {
  const connectedInstances = instances.filter(instance => instance.connected)

  if (connectedInstances.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="space-y-4">
            <HardDrive className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold">No Connected Instances</h3>
              <p className="text-muted-foreground">
                Connect to at least one qBittorrent instance to use TQM
              </p>
            </div>
            <Link to="/instances" search={{ modal: "add-instance" }}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Instance
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {connectedInstances.map(instance => (
        <Button
          key={instance.id}
          variant={selectedInstanceId === instance.id ? "default" : "outline"}
          onClick={() => onInstanceSelect(instance.id)}
          className="flex items-center gap-2"
        >
          <Server className="h-4 w-4" />
          {instance.name}
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              instance.connected ? "bg-green-500" : "bg-red-500"
            )}
          />
        </Button>
      ))}
    </div>
  )
}

function TQMInstanceOverview({ instanceId, config }: { instanceId: number, config?: TQMConfigResponse }) {
  const { isLoading: configLoading } = useTQMConfig(instanceId)
  const { isLoading: statusLoading } = useTQMStatus(instanceId)

  if (configLoading || statusLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-48 mx-auto"></div>
            <div className="h-3 bg-muted rounded w-32 mx-auto"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const activeFiltersCount = config?.tagRules?.filter(rule => rule.enabled).length ?? 0

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">TQM Status</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <TQMStatusIndicator instanceId={instanceId} />
            <Badge variant={config?.config?.enabled ? "default" : "secondary"}>
              {config?.config?.enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Filters</CardTitle>
          <Tags className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeFiltersCount}</div>
          <p className="text-xs text-muted-foreground">
            {config?.tagRules?.length ?? 0} total filters
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export function TQMPage() {
  const { instances, isLoading } = useInstances()
  const [selectedInstanceId, setSelectedInstanceId] = useState<number | null>(null)

  // Auto-select first connected instance
  const connectedInstances = instances?.filter(instance => instance.connected) ?? []

  // Set default selection to first connected instance
  if (!selectedInstanceId && connectedInstances.length > 0) {
    setSelectedInstanceId(connectedInstances[0].id)
  }

  // Fetch TQM config for selected instance
  const { data: tqmConfig } = useTQMConfig(selectedInstanceId ?? 0)

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48"></div>
          <div className="h-4 bg-muted rounded w-64"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Tags className="h-8 w-8" />
          TQM
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage torrent tags and filters across your qBittorrent instances
        </p>
      </div>

      {/* Instance Selector */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Select Instance</h2>
        <InstanceSelector
          instances={instances ?? []}
          selectedInstanceId={selectedInstanceId}
          onInstanceSelect={setSelectedInstanceId}
        />
      </div>

      {/* Main Content */}
      {selectedInstanceId ? (
        <div className="space-y-6">
          {/* Overview Cards */}
          <TQMInstanceOverview instanceId={selectedInstanceId} config={tqmConfig} />

          {/* TQM Management Tabs */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>TQM Management</CardTitle>
                  <CardDescription>
                    Configure filters and manage torrent tagging rules
                  </CardDescription>
                </div>
                <RetagButton instanceId={selectedInstanceId} showText={true} size="default" />
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="configuration" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="configuration">Configuration</TabsTrigger>
                  <TabsTrigger value="filters">Filter Management</TabsTrigger>
                </TabsList>

                <TabsContent value="configuration" className="mt-6">
                  <TQMConfigurationForm instanceId={selectedInstanceId} config={tqmConfig} onClose={() => {}} />
                </TabsContent>

                <TabsContent value="filters" className="mt-6">
                  <TQMFilterManager instanceId={selectedInstanceId} config={tqmConfig} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      ) : connectedInstances.length > 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              <Tags className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">Select an Instance</h3>
                <p className="text-muted-foreground">
                  Choose a connected instance to manage its TQM configuration
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}