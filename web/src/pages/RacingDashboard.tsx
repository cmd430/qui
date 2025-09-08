/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useInstances } from "@/hooks/useInstances"
import { api } from "@/lib/api"
import { cn, formatBytes, getRatioColor } from "@/lib/utils"
import type { RacingDashboardOptions, RacingTorrent } from "@/types"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { Activity, AlertCircle, CalendarIcon, ChevronDown, Clock, Database, Filter, HardDrive, ListFilter, Percent, RotateCcw, Settings2, Tag, TrendingDown, TrendingUp } from "lucide-react"
import { useState, useEffect } from "react"
import type { DateRange } from "react-day-picker"

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

// Custom hook for persisting Racing Dashboard filters state
function usePersistedRacingFiltersState(defaultOpen: boolean = true) {
  const storageKey = "qui-racing-filters-collapsed"

  // Initialize state from localStorage or default value
  const [filtersOpen, setFiltersOpenState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored !== null) {
        // Note: we store "collapsed" but use "open" in state, so invert
        return stored === "false"
      }
    } catch (error) {
      console.error("Failed to load racing filters state from localStorage:", error)
    }
    return defaultOpen
  })

  // Persist to localStorage whenever state changes
  useEffect(() => {
    try {
      // Store as "collapsed" (inverse of "open")
      localStorage.setItem(storageKey, (!filtersOpen).toString())
    } catch (error) {
      console.error("Failed to save racing filters state to localStorage:", error)
    }
  }, [filtersOpen])

  return [filtersOpen, setFiltersOpenState] as const
}

export function RacingDashboard() {
  const { instances, isLoading: instancesLoading } = useInstances()

  // Initialize selectedInstanceId from localStorage
  const [selectedInstanceId, setSelectedInstanceIdState] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem("qui-racing-selected-instance")
      if (stored !== null) {
        const id = parseInt(stored, 10)
        if (!isNaN(id)) {
          return id
        }
      }
    } catch (error) {
      console.error("Failed to load selected instance from localStorage:", error)
    }
    return null
  })

  // Wrapper to persist instance selection
  const setSelectedInstanceId = (id: number) => {
    setSelectedInstanceIdState(id)
    try {
      localStorage.setItem("qui-racing-selected-instance", id.toString())
    } catch (error) {
      console.error("Failed to save selected instance to localStorage:", error)
    }
  }

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
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [filtersOpen, setFiltersOpen] = usePersistedRacingFiltersState(true)

  // Auto-select first instance if none selected or if selected instance doesn't exist
  useEffect(() => {
    if (instances && instances.length > 0) {
      // Check if selected instance exists in the list
      const instanceExists = selectedInstanceId && instances.some(inst => inst.id === selectedInstanceId)

      if (!instanceExists) {
        // Select first available instance
        setSelectedInstanceId(instances[0].id)
      }
    }
  }, [instances, selectedInstanceId])

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
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CardHeader>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity">
                <div className="space-y-1 flex-1">
                  <CardTitle className="flex gap-2">
                    <Filter className="h-5 w-5" />
                    Filters
                  </CardTitle>
                  <CardDescription>
                    Configure filters to analyze specific conditions
                  </CardDescription>
                </div>
                <ChevronDown className={cn(
                  "h-5 w-5 transition-transform duration-200 self-center",
                  filtersOpen ? "" : "-rotate-90"
                )} />
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              {/* Basic Settings Section */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Settings2 className="h-4 w-4" />
                  Basic Settings
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Instance Selector */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Database className="h-3 w-3" />
                      Instance
                    </Label>
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
                    <p className="text-xs text-muted-foreground">
                      Select the qBittorrent instance to analyze
                    </p>
                  </div>

                  {/* Results per section */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <ListFilter className="h-3 w-3" />
                      Results per section
                    </Label>
                    <Select
                      value={options.limit?.toString()}
                      onValueChange={(value) => setOptions(prev => ({ ...prev, limit: Number(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 torrents</SelectItem>
                        <SelectItem value="10">10 torrents</SelectItem>
                        <SelectItem value="15">15 torrents</SelectItem>
                        <SelectItem value="20">20 torrents</SelectItem>
                        <SelectItem value="25">25 torrents</SelectItem>
                        <SelectItem value="50">50 torrents</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Number of torrents to display in each category
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Performance Filters Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <TrendingUp className="h-4 w-4" />
                  Performance Filters
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Min Ratio */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Percent className="h-3 w-3" />
                      Minimum Ratio
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="0.0"
                        value={options.minRatio || 0}
                        onChange={(e) => setOptions(prev => ({ ...prev, minRatio: parseFloat(e.target.value) || 0 }))}
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        x
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Filter torrents below this ratio
                    </p>
                  </div>

                  {/* Size Range */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <HardDrive className="h-3 w-3" />
                      Size Range
                    </Label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
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
                          className="pr-10"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          GB
                        </span>
                      </div>
                      <span className="text-muted-foreground">—</span>
                      <div className="relative flex-1">
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
                          className="pr-10"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          GB
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Filter torrents by size range
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Time Period Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4" />
                  Time Period
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Time Range Preset */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <CalendarIcon className="h-3 w-3" />
                      Time Range
                    </Label>
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
                    <p className="text-xs text-muted-foreground">
                      Filter torrents by time period
                    </p>
                  </div>

                  {/* Custom Date Range */}
                  {customDateRange && (
                    <div className="space-y-2">
                      <Label>Custom Date Range</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !dateRange && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange?.from ? (
                              dateRange.to ? (
                                <>
                                  {format(dateRange.from, "LLL dd, y")} -{" "}
                                  {format(dateRange.to, "LLL dd, y")}
                                </>
                              ) : (
                                format(dateRange.from, "LLL dd, y")
                              )
                            ) : (
                              <span>Pick a date range</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            autoFocus
                            mode="range"
                            defaultMonth={dateRange?.from}
                            selected={dateRange}
                            onSelect={(newRange: DateRange | undefined) => {
                              setDateRange(newRange)
                              if (newRange?.from && newRange?.to) {
                                setOptions(prev => ({
                                  ...prev,
                                  startDate: newRange.from?.toISOString() || "",
                                  endDate: newRange.to?.toISOString() || "",
                                }))
                              }
                            }}
                            numberOfMonths={2}
                            className="rounded-md border p-3"
                            classNames={{
                              months: "flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0 relative",
                              month: "space-y-4",
                              caption: "flex justify-center pt-1 relative items-center px-10",
                              caption_label: "text-sm font-medium",
                              nav: "absolute inset-x-0 top-0 flex w-full items-center justify-between",
                              nav_button: cn(
                                "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                              ),
                              nav_button_previous: "absolute left-1",
                              nav_button_next: "absolute right-1",
                              table: "w-full border-collapse space-y-1",
                              head_row: "flex",
                              head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
                              row: "flex w-full mt-2",
                              cell: "relative h-8 w-8 text-center text-sm p-0 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                              day: cn(
                                "h-8 w-8 p-0 font-normal aria-selected:opacity-100"
                              ),
                              day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                              day_today: "bg-accent text-accent-foreground",
                              day_outside: "text-muted-foreground opacity-50",
                              day_disabled: "text-muted-foreground opacity-50",
                              day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                              day_hidden: "invisible",
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                      <p className="text-xs text-muted-foreground">
                        Select specific start and end dates
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Advanced Filters Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Settings2 className="h-4 w-4" />
                  Advanced Filters
                </div>

                {/* Tracker Filter */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Database className="h-3 w-3" />
                    Tracker Filter
                  </Label>
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
                        <Badge key={tracker} variant="secondary" className="pl-2">
                          <Database className="h-3 w-3 mr-1" />
                          {tracker}
                          <button
                            className="ml-2 hover:text-destructive transition-colors"
                            onClick={() => handleRemoveTracker(tracker)}
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Filter results by specific trackers
                  </p>
                </div>

                {/* Category Filter */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Tag className="h-3 w-3" />
                    Category Filter
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., movies, tv-shows"
                      value={categoryInput}
                      onChange={(e) => setCategoryInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                    />
                    <Button onClick={handleAddCategory} size="sm" variant="secondary">
                      Add
                    </Button>
                  </div>
                  {options.categoryFilter && options.categoryFilter.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {options.categoryFilter.map(category => (
                        <Badge key={category} variant="secondary" className="pl-2">
                          <Tag className="h-3 w-3 mr-1" />
                          {category}
                          <button
                            className="ml-2 hover:text-destructive transition-colors"
                            onClick={() => handleRemoveCategory(category)}
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Filter results by torrent categories
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={resetFilters} variant="outline" size="sm">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset All Filters
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
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
                    {dashboard.topFastest && dashboard.topFastest.length > 0 ? (
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
                    {dashboard.topRatios && dashboard.topRatios.length > 0 ? (
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
                    {dashboard.bottomRatios && dashboard.bottomRatios.length > 0 ? (
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

          {/* Last Updated */}
          <div className="text-center text-sm text-muted-foreground">
            Last updated: {formatDate(dashboard.lastUpdated)}
          </div>
        </>
      )}
    </div>
  )
}