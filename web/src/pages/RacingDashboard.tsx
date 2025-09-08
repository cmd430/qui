/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { api } from "@/lib/api"
import { formatBytes, getRatioColor } from "@/lib/utils"
import { useInstances } from "@/hooks/useInstances"
import type { RacingDashboardOptions, RacingTorrent } from "@/types"
import { AlertCircle, Clock, TrendingDown, TrendingUp, Activity, Filter, RotateCcw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString()
}

function TorrentRow({ torrent, showCompletionTime = false }: { torrent: RacingTorrent, showCompletionTime?: boolean }) {
  return (
    <TableRow>
      <TableCell className="max-w-[300px]">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="truncate font-medium">{torrent.name}</div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[400px]">
            <p className="break-words">{torrent.name}</p>
          </TooltipContent>
        </Tooltip>
        <div className="flex gap-2 mt-1">
          {torrent.category && (
            <Badge variant="outline" className="text-xs">
              {torrent.category}
            </Badge>
          )}
          {torrent.tags && (
            <Badge variant="secondary" className="text-xs">
              {torrent.tags}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>{formatBytes(torrent.size)}</TableCell>
      <TableCell>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="cursor-help">
              {torrent.trackerDomain}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{torrent.tracker}</p>
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell>
        <span className={`font-semibold ${getRatioColor(torrent.ratio)}`}>
          {torrent.ratio.toFixed(2)}
        </span>
      </TableCell>
      {showCompletionTime && (
        <TableCell>
          {torrent.completionTime ? (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(torrent.completionTime)}
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
      )}
      <TableCell className="text-xs text-muted-foreground">
        <div>{formatDate(torrent.addedOn)}</div>
        {torrent.completedOn && (
          <div className="text-green-600 dark:text-green-400">
            Completed: {formatDate(torrent.completedOn)}
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}

export function RacingDashboard() {
  const { instances, isLoading: instancesLoading } = useInstances()
  const [selectedInstanceId, setSelectedInstanceId] = useState<number | null>(null)
  const [options, setOptions] = useState<RacingDashboardOptions>({
    limit: 5,
    trackerFilter: [],
    categoryFilter: [],
    minRatio: 0,
    timeRange: "",
    startDate: "",
    endDate: "",
  })
  const [categoryInput, setCategoryInput] = useState("")
  const [customDateRange, setCustomDateRange] = useState(false)

  // Auto-select first instance if none selected
  if (!selectedInstanceId && instances && instances.length > 0) {
    setSelectedInstanceId(instances[0].id)
  }

  const { data: dashboard, isLoading, error, refetch } = useQuery({
    queryKey: ["racing-dashboard", selectedInstanceId, options],
    queryFn: () => api.getRacingDashboard(selectedInstanceId!, options),
    enabled: !!selectedInstanceId,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000,
  })

  const handleRemoveTracker = (tracker: string) => {
    setOptions(prev => ({
      ...prev,
      trackerFilter: prev.trackerFilter?.filter(t => t !== tracker),
    }))
  }

  const handleAddCategory = () => {
    if (categoryInput && !options.categoryFilter?.includes(categoryInput)) {
      setOptions(prev => ({
        ...prev,
        categoryFilter: [...(prev.categoryFilter || []), categoryInput],
      }))
      setCategoryInput("")
    }
  }

  const handleRemoveCategory = (category: string) => {
    setOptions(prev => ({
      ...prev,
      categoryFilter: prev.categoryFilter?.filter(c => c !== category),
    }))
  }

  const resetFilters = () => {
    setOptions({
      limit: 5,
      trackerFilter: [],
      categoryFilter: [],
      minRatio: 0,
      timeRange: "",
      startDate: "",
      endDate: "",
    })
    setCategoryInput("")
    setCustomDateRange(false)
  }

  if (instancesLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-muted-foreground">Loading instances...</p>
        </div>
      </div>
    )
  }

  if (!instances || instances.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No instances configured. Please add an instance first.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8" />
            Racing Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Track and analyze your torrent racing performance
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RotateCcw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Instance Selector */}
            <div className="space-y-2">
              <Label>Instance</Label>
              <Select
                value={selectedInstanceId?.toString()}
                onValueChange={(value) => setSelectedInstanceId(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select instance" />
                </SelectTrigger>
                <SelectContent>
                  {instances?.map(instance => (
                    <SelectItem key={instance.id} value={instance.id.toString()}>
                      {instance.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Limit */}
            <div className="space-y-2">
              <Label>Torrents per section</Label>
              <Select
                value={options.limit?.toString()}
                onValueChange={(value) => setOptions(prev => ({ ...prev, limit: Number(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Min Ratio */}
            <div className="space-y-2">
              <Label>Minimum Ratio</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={options.minRatio || 0}
                onChange={(e) => setOptions(prev => ({ ...prev, minRatio: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            {/* Size Range */}
            <div className="space-y-2">
              <Label>Size Range (GB)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="Min"
                  value={options.minSize ? (options.minSize / 1073741824).toFixed(1) : ""}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    minSize: e.target.value ? Math.floor(parseFloat(e.target.value) * 1073741824) : undefined,
                  }))}
                />
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="Max"
                  value={options.maxSize ? (options.maxSize / 1073741824).toFixed(1) : ""}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    maxSize: e.target.value ? Math.floor(parseFloat(e.target.value) * 1073741824) : undefined,
                  }))}
                />
              </div>
            </div>
          </div>

          {/* Time Frame Filtering */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Time Range Preset */}
              <div className="space-y-2">
                <Label>Time Range</Label>
                <Select
                  value={customDateRange ? "custom" : options.timeRange || "all"}
                  onValueChange={(value) => {
                    if (value === "custom") {
                      setCustomDateRange(true)
                      setOptions(prev => ({ ...prev, timeRange: "" }))
                    } else if (value === "all") {
                      setCustomDateRange(false)
                      setOptions(prev => ({ ...prev, timeRange: "", startDate: "", endDate: "" }))
                    } else {
                      setCustomDateRange(false)
                      setOptions(prev => ({ ...prev, timeRange: value, startDate: "", endDate: "" }))
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="24h">Last 24 Hours</SelectItem>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Date Range */}
              {customDateRange && (
                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={options.startDate ? options.startDate.split("T")[0] : ""}
                      onChange={(e) => setOptions(prev => ({
                        ...prev,
                        startDate: e.target.value ? new Date(e.target.value).toISOString() : "",
                      }))}
                      placeholder="Start Date"
                    />
                    <Input
                      type="date"
                      value={options.endDate ? options.endDate.split("T")[0] : ""}
                      onChange={(e) => setOptions(prev => ({
                        ...prev,
                        endDate: e.target.value ? new Date(e.target.value).toISOString() : "",
                      }))}
                      placeholder="End Date"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Tracker Filter */}
          <div className="space-y-2">
            <Label>Tracker Filter</Label>
            <div className="flex gap-2">
              <Select
                onValueChange={(value) => {
                  if (value && !options.trackerFilter?.includes(value)) {
                    setOptions(prev => ({
                      ...prev,
                      trackerFilter: [...(prev.trackerFilter || []), value],
                    }))
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a tracker to filter" />
                </SelectTrigger>
                <SelectContent>
                  {dashboard?.trackerStats.byTracker && Object.keys(dashboard.trackerStats.byTracker)
                    .filter(tracker => !options.trackerFilter?.includes(tracker))
                    .sort()
                    .map(tracker => (
                      <SelectItem key={tracker} value={tracker}>
                        {tracker} ({dashboard.trackerStats.byTracker[tracker].totalTorrents} torrents)
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
            {options.trackerFilter && options.trackerFilter.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {options.trackerFilter.map(tracker => (
                  <Badge key={tracker} variant="secondary">
                    {tracker}
                    <button
                      className="ml-2 hover:text-destructive"
                      onClick={() => handleRemoveTracker(tracker)}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Category Filter */}
          <div className="space-y-2">
            <Label>Category Filter</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., movies"
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAddCategory()}
              />
              <Button onClick={handleAddCategory} size="sm">Add</Button>
            </div>
            {options.categoryFilter && options.categoryFilter.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {options.categoryFilter.map(category => (
                  <Badge key={category} variant="secondary">
                    {category}
                    <button
                      className="ml-2 hover:text-destructive"
                      onClick={() => handleRemoveCategory(category)}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Button onClick={resetFilters} variant="outline" size="sm">
            Reset Filters
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load racing dashboard: {(error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-muted-foreground">Loading racing data...</p>
        </div>
      )}

      {dashboard && (
        <>
          {/* Tracker Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Tracker Statistics</CardTitle>
              <CardDescription>
                Overall performance metrics across all trackers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-2xl font-bold">{dashboard.trackerStats.totalTorrents}</div>
                  <p className="text-xs text-muted-foreground">Total Torrents</p>
                </div>
                <div>
                  <div className="text-2xl font-bold">{dashboard.trackerStats.completedTorrents}</div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div>
                  <div className="text-2xl font-bold">{dashboard.trackerStats.averageRatio.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">Average Ratio</p>
                </div>
                {dashboard.trackerStats.averageCompletionTime && (
                  <div>
                    <div className="text-2xl font-bold">
                      {formatDuration(dashboard.trackerStats.averageCompletionTime)}
                    </div>
                    <p className="text-xs text-muted-foreground">Avg Completion Time</p>
                  </div>
                )}
              </div>

              {Object.keys(dashboard.trackerStats.byTracker).length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">Per Tracker Breakdown</h4>
                    <ScrollArea className="h-[300px] pr-4">
                      <div className="grid gap-3">
                        {Object.entries(dashboard.trackerStats.byTracker).map(([tracker, data]) => (
                          <div key={tracker} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div>
                              <Badge variant="outline">{tracker}</Badge>
                            </div>
                            <div className="flex gap-6 text-sm">
                              <div>
                                <span className="text-muted-foreground">Torrents:</span>{" "}
                                <span className="font-medium">{data.totalTorrents}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Completed:</span>{" "}
                                <span className="font-medium">{data.completedTorrents}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Ratio:</span>{" "}
                                <span className={`font-medium ${getRatioColor(data.averageRatio)}`}>
                                  {data.averageRatio.toFixed(2)}
                                </span>
                              </div>
                              {data.averageCompletionTime && (
                                <div>
                                  <span className="text-muted-foreground">Avg Time:</span>{" "}
                                  <span className="font-medium">{formatDuration(data.averageCompletionTime)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Racing Tables Tabs */}
          <Card>
            <CardHeader>
              <CardTitle>Racing Performance</CardTitle>
              <CardDescription>
                Detailed torrent performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="fastest" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="fastest" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Fastest Completions
                  </TabsTrigger>
                  <TabsTrigger value="top-ratios" className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Top Ratios
                  </TabsTrigger>
                  <TabsTrigger value="bottom-ratios" className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    Bottom Ratios
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="fastest" className="mt-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Torrents that completed in the shortest time
                    </p>
                    {dashboard.topFastest.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Tracker</TableHead>
                            <TableHead>Ratio</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dashboard.topFastest.map(torrent => (
                            <TorrentRow key={torrent.hash} torrent={torrent} showCompletionTime={true} />
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No data available</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="top-ratios" className="mt-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Torrents with the highest upload ratios
                    </p>
                    {dashboard.topRatios.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Tracker</TableHead>
                            <TableHead>Ratio</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dashboard.topRatios.map(torrent => (
                            <TorrentRow key={torrent.hash} torrent={torrent} />
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No data available</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="bottom-ratios" className="mt-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Torrents with the lowest upload ratios
                    </p>
                    {dashboard.bottomRatios.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Tracker</TableHead>
                            <TableHead>Ratio</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dashboard.bottomRatios.map(torrent => (
                            <TorrentRow key={torrent.hash} torrent={torrent} />
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No data available</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Last Updated */}
          <div className="text-center text-sm text-muted-foreground">
            Last updated: {formatDate(dashboard.lastUpdated)}
          </div>
        </>
      )}
    </div>
  )
}