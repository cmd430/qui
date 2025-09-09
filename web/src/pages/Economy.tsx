/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EconomyDashboard } from "@/components/dashboard/EconomyDashboard"
import { api } from "@/lib/api"
import { Loader2, TrendingUp, AlertCircle } from "lucide-react"

export function Economy() {
  const [selectedInstanceId, setSelectedInstanceId] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25) // Increased default page size for better performance
  const [sortField, setSortField] = useState<string>("economyScore")
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Get all instances
  const { data: instances, isLoading: instancesLoading } = useQuery({
    queryKey: ["instances"],
    queryFn: () => api.getInstances(),
  })

  // Get economy analysis for selected instance with pagination, sorting, and filtering
  const { data: economyData, isLoading: economyLoading, error } = useQuery({
    queryKey: ["economy-analysis", selectedInstanceId, currentPage, pageSize, sortField, sortOrder],
    queryFn: () => {
      if (!selectedInstanceId) return null
      
      // Send sorting parameters to ensure proper backend sorting
      return api.getEconomyAnalysis(selectedInstanceId, currentPage, pageSize, sortField, sortOrder)
    },
    enabled: selectedInstanceId !== null,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Handle page changes
  const handlePageChange = (page: number, newPageSize: number) => {
    setCurrentPage(page)
    setPageSize(newPageSize)
  }

  // Handle sorting changes
  const handleSortingChange = (field: string, desc: boolean) => {
    setSortField(field)
    setSortOrder(desc ? 'desc' : 'asc')
    setCurrentPage(1) // Reset to first page when sorting changes
  }

  // Reset pagination when instance changes
  const handleInstanceChange = (instanceId: number) => {
    setSelectedInstanceId(instanceId)
    setCurrentPage(1) // Reset to first page
  }

  // Auto-select first connected instance
  const connectedInstances = instances?.filter((i: any) => i.connected) || []
  if (selectedInstanceId === null && connectedInstances.length > 0) {
    handleInstanceChange(connectedInstances[0].id)
  }

  if (instancesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!instances || instances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Instances Found</h2>
        <p className="text-muted-foreground mb-4">
          You need to add and connect to a qBittorrent instance to view economy data.
        </p>
        <Button asChild>
          <a href="/instances">Manage Instances</a>
        </Button>
      </div>
    )
  }

  if (connectedInstances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Connected Instances</h2>
        <p className="text-muted-foreground mb-4">
          Connect to a qBittorrent instance to analyze your torrent economy.
        </p>
        <Button asChild>
          <a href="/instances">Connect Instance</a>
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8" />
            Torrent Economy
          </h1>
          <p className="text-muted-foreground mt-2">
            Analyze your torrent storage efficiency and identify high-value content
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => {
              const newPageSize = parseInt(value)
              setPageSize(newPageSize)
              setCurrentPage(1) // Reset to first page when changing page size
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Page size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 per page</SelectItem>
              <SelectItem value="25">25 per page</SelectItem>
              <SelectItem value="50">50 per page</SelectItem>
              <SelectItem value="100">100 per page</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={selectedInstanceId?.toString() || ""}
            onValueChange={(value) => handleInstanceChange(parseInt(value))}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select instance" />
            </SelectTrigger>
            <SelectContent>
              {connectedInstances.map((instance) => (
                <SelectItem key={instance.id} value={instance.id.toString()}>
                  <div className="flex items-center gap-2">
                    <span>{instance.name}</span>
                    <Badge variant="outline" className="text-xs">
                      Connected
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedInstanceId && (
        <>
          {economyLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Analyzing torrent economy...</p>
              </div>
            </div>
          ) : error ? (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Failed to Load Economy Data</h3>
                  <p className="text-muted-foreground">
                    {error instanceof Error ? error.message : "An unknown error occurred"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : economyData ? (
            <EconomyDashboard 
              analysis={economyData} 
              instanceId={selectedInstanceId} 
              onPageChange={handlePageChange}
              onSortingChange={(sorting) => {
                if (sorting.length > 0) {
                  const sort = sorting[0]
                  handleSortingChange(sort.id, sort.desc)
                }
              }}
            />
          ) : null}
        </>
      )}

      {!selectedInstanceId && (
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select an Instance</h3>
              <p className="text-muted-foreground">
                Choose a qBittorrent instance to analyze its torrent economy
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
