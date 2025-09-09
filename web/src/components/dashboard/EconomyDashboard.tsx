/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { formatBytes } from "@/lib/utils"
import { TrendingUp, HardDrive, Target, AlertTriangle, Star, Zap, Lightbulb, Recycle } from "lucide-react"
import type { EconomyAnalysis } from "@/types"
import { useState, useCallback, useMemo } from "react"
import { TorrentGroupCard } from "./TorrentGroupCard"
import { TorrentActions } from "../torrents/TorrentActions"

interface EconomyDashboardProps {
  analysis: EconomyAnalysis
  instanceId: number
  onPageChange?: (page: number, pageSize: number) => void
}

export function EconomyDashboard({ analysis, instanceId, onPageChange }: EconomyDashboardProps) {
  const { stats, topValuable, optimizations, storageOptimization, reviewTorrents } = analysis
  const [selectedTorrents, setSelectedTorrents] = useState<Set<string>>(new Set())

  // Use paginated data from backend - backend handles grouping logic
  const { torrents: currentTorrents, torrentGroups: enhancedGroups, pagination } = reviewTorrents
  const { page, pageSize, totalItems, totalPages, hasNextPage, hasPrevPage } = pagination

  // Backend determines if grouping should be used
  const shouldUseGroupedView = enhancedGroups && enhancedGroups.length > 0

  // Memoize all selected check
  const allSelected = useMemo(() => 
    currentTorrents.length > 0 && currentTorrents.every(torrent => selectedTorrents.has(torrent.hash)),
    [currentTorrents, selectedTorrents]
  )

  const handleSelectTorrent = useCallback((hash: string, checked: boolean) => {
    setSelectedTorrents((prev: Set<string>) => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(hash)
      } else {
        newSet.delete(hash)
      }
      return newSet
    })
  }, [])

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      const allHashes = currentTorrents.map(torrent => torrent.hash)
      setSelectedTorrents((prev: Set<string>) => new Set([...prev, ...allHashes]))
    } else {
      const currentHashes = new Set(currentTorrents.map(torrent => torrent.hash))
      setSelectedTorrents((prev: Set<string>) => {
        const newSet = new Set(prev)
        currentHashes.forEach((hash: string) => newSet.delete(hash))
        return newSet
      })
    }
  }, [currentTorrents])

  const handleSelectGroup = useCallback((hashes: string[], checked: boolean) => {
    if (checked) {
      setSelectedTorrents((prev: Set<string>) => new Set([...prev, ...hashes]))
    } else {
      setSelectedTorrents((prev: Set<string>) => {
        const newSet = new Set(prev)
        hashes.forEach((hash: string) => newSet.delete(hash))
        return newSet
      })
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Total Storage</p>
              <p className="text-xl font-bold">{formatBytes(stats.totalStorage)}</p>
            </div>
            <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/20 rounded-md flex items-center justify-center">
              <HardDrive className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </Card>

        <Card className="p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Deduplicated</p>
              <p className="text-xl font-bold">{formatBytes(stats.deduplicatedStorage)}</p>
            </div>
            <div className="h-8 w-8 bg-green-100 dark:bg-green-900/20 rounded-md flex items-center justify-center">
              <Target className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </Card>

        <Card className="p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Avg Economy Score</p>
              <p className="text-xl font-bold">{stats.averageEconomyScore.toFixed(1)}</p>
            </div>
            <div className="h-8 w-8 bg-purple-100 dark:bg-purple-900/20 rounded-md flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </Card>

        <Card className="p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Rare Content</p>
              <p className="text-xl font-bold">{stats.rareContentCount}</p>
            </div>
            <div className="h-8 w-8 bg-amber-100 dark:bg-amber-900/20 rounded-md flex items-center justify-center">
              <Star className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Storage Efficiency */}
      <Card className="hover:shadow-sm transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="h-6 w-6 bg-blue-100 dark:bg-blue-900/20 rounded-md flex items-center justify-center">
              <Zap className="h-3 w-3 text-blue-600 dark:text-blue-400" />
            </div>
            Storage Efficiency
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>Deduplication Efficiency</span>
            <span className="font-semibold text-green-600 dark:text-green-400">
              {((stats.storageSavings / stats.totalStorage) * 100).toFixed(1)}% saved
            </span>
          </div>
          <Progress
            value={(stats.deduplicatedStorage / stats.totalStorage) * 100}
            className="h-2"
          />
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total Saved</p>
              <p className="text-sm font-semibold">{formatBytes(stats.storageSavings)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Efficiency</p>
              <p className="text-sm font-semibold">
                {stats.totalStorage > 0 ? ((stats.deduplicatedStorage / stats.totalStorage) * 100).toFixed(1) : 0}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Optimization Opportunities */}
      {optimizations && optimizations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Optimization Opportunities
            </CardTitle>
            <CardDescription>
              Recommended actions to improve your torrent economy and storage efficiency
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {optimizations.map((opportunity, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm">{opportunity.title}</h4>
                      <Badge
                        variant={
                          opportunity.priority === "high" ? "destructive" :
                          opportunity.priority === "medium" ? "default" : "secondary"
                        }
                        className="text-xs"
                      >
                        {opportunity.priority}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {formatBytes(opportunity.savings)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {opportunity.impact.toFixed(1)}% impact
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{opportunity.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {opportunity.torrents.length} affected torrent{opportunity.torrents.length !== 1 ? "s" : ""}
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-xs h-7">
                          Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{opportunity.title}</DialogTitle>
                          <DialogDescription>{opportunity.description}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-semibold mb-2">Opportunity Details</h4>
                              <div className="space-y-2 text-sm">
                                <div><strong>Type:</strong> {opportunity.type}</div>
                                <div><strong>Priority:</strong> 
                                  <Badge 
                                    variant={
                                      opportunity.priority === "high" ? "destructive" :
                                      opportunity.priority === "medium" ? "default" : "secondary"
                                    }
                                    className="ml-2"
                                  >
                                    {opportunity.priority}
                                  </Badge>
                                </div>
                                <div><strong>Category:</strong> {opportunity.category}</div>
                                <div><strong>Impact Score:</strong> {opportunity.impact.toFixed(1)}%</div>
                                <div><strong>Potential Savings:</strong> {formatBytes(opportunity.savings)}</div>
                                <div><strong>Affected Torrents:</strong> {opportunity.torrents.length}</div>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold mb-2">Affected Torrents</h4>
                              <div className="max-h-60 overflow-y-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Name</TableHead>
                                      <TableHead>Size</TableHead>
                                      <TableHead>Seeds</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {opportunity.torrents.slice(0, 10).map((hash) => {
                                      const score = analysis.scores.find(s => s.hash === hash)
                                      return score ? (
                                        <TableRow key={hash}>
                                          <TableCell className="max-w-xs truncate" title={score.name}>
                                            {score.name}
                                          </TableCell>
                                          <TableCell>{formatBytes(score.size)}</TableCell>
                                          <TableCell>
                                            <Badge variant={score.seeds < 5 ? "destructive" : "default"}>
                                              {score.seeds}
                                            </Badge>
                                          </TableCell>
                                        </TableRow>
                                      ) : null
                                    })}
                                  </TableBody>
                                </Table>
                                {opportunity.torrents.length > 10 && (
                                  <p className="text-sm text-muted-foreground mt-2">
                                    And {opportunity.torrents.length - 10} more torrents...
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Storage Optimization Breakdown */}
      {storageOptimization && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Recycle className="h-5 w-5 text-green-500" />
              Storage Optimization Breakdown
            </CardTitle>
            <CardDescription>
              Detailed breakdown of potential storage savings by category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatBytes(storageOptimization.totalPotentialSavings)}
                </div>
                <p className="text-sm text-muted-foreground">Total Potential Savings</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Deduplication</span>
                    <span className="font-medium">{formatBytes(storageOptimization.deduplicationSavings)}</span>
                  </div>
                  <Progress
                    value={(storageOptimization.deduplicationSavings / storageOptimization.totalPotentialSavings) * 100}
                    className="h-2"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Old Content</span>
                    <span className="font-medium">{formatBytes(storageOptimization.oldContentCleanupSavings)}</span>
                  </div>
                  <Progress
                    value={(storageOptimization.oldContentCleanupSavings / storageOptimization.totalPotentialSavings) * 100}
                    className="h-2"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Ratio Opt.</span>
                    <span className="font-medium">{formatBytes(storageOptimization.ratioOptimizationSavings)}</span>
                  </div>
                  <Progress
                    value={(storageOptimization.ratioOptimizationSavings / storageOptimization.totalPotentialSavings) * 100}
                    className="h-2"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Unused</span>
                    <span className="font-medium">{formatBytes(storageOptimization.unusedContentSavings)}</span>
                  </div>
                  <Progress
                    value={(storageOptimization.unusedContentSavings / storageOptimization.totalPotentialSavings) * 100}
                    className="h-2"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Valuable Torrents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Top Valuable Torrents
          </CardTitle>
          <CardDescription>
            Torrents with the highest economy scores based on rarity, size, and storage value
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Seeds</TableHead>
                <TableHead>Age (days)</TableHead>
                <TableHead>Economy Score</TableHead>
                <TableHead>Rarity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topValuable.slice(0, 10).map((torrent) => (
                <TableRow key={torrent.hash}>
                  <TableCell className="font-medium max-w-xs truncate" title={torrent.name}>
                    {torrent.name}
                  </TableCell>
                  <TableCell>{formatBytes(torrent.size)}</TableCell>
                  <TableCell>
                    <Badge variant={torrent.seeds < 5 ? "destructive" : torrent.seeds < 10 ? "secondary" : "default"}>
                      {torrent.seeds}
                    </Badge>
                  </TableCell>
                  <TableCell>{torrent.age}d</TableCell>
                  <TableCell className="font-semibold text-green-600">
                    {torrent.economyScore.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                           style={{ backgroundPosition: `${Math.min(torrent.rarityBonus * 20, 100)}% 0` }} />
                      <span className="text-xs">{torrent.rarityBonus.toFixed(1)}x</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Torrents Needing Review */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Torrents Needing Review
              </CardTitle>
              <CardDescription>
                Torrents with the lowest economy scores that may need attention or removal
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {shouldUseGroupedView ? (
            // Backend has provided grouped data - render TorrentGroupCard components
            <div className="space-y-4">
              {enhancedGroups.map((group) => (
                <TorrentGroupCard
                  key={group.id}
                  group={group}
                  selectedTorrents={selectedTorrents}
                  instanceId={instanceId}
                  onSelectTorrent={handleSelectTorrent}
                  onSelectGroup={handleSelectGroup}
                />
              ))}
            </div>
          ) : (
            // Backend has provided individual torrents - render table
            <>
              {/* Torrent Actions */}
              {selectedTorrents.size > 0 && (
                <div className="flex justify-between items-center mb-4">
                  <div className="text-sm text-muted-foreground">
                    {selectedTorrents.size} torrent{selectedTorrents.size !== 1 ? 's' : ''} selected
                  </div>
                  <TorrentActions
                    instanceId={instanceId}
                    selectedHashes={Array.from(selectedTorrents)}
                    onComplete={() => setSelectedTorrents(new Set())}
                  />
                </div>
              )}

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Seeds</TableHead>
                      <TableHead>Age (days)</TableHead>
                      <TableHead>Economy Score</TableHead>
                      <TableHead>Ratio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentTorrents.map((torrent) => (
                      <TableRow key={torrent.hash}>
                        <TableCell>
                          <Checkbox
                            checked={selectedTorrents.has(torrent.hash)}
                            onCheckedChange={(checked: boolean) => handleSelectTorrent(torrent.hash, checked)}
                          />
                        </TableCell>
                        <TableCell className="font-medium max-w-xs truncate" title={torrent.name}>
                          <div className="flex items-center gap-2">
                            {torrent.name}
                            {torrent.deduplicationFactor === 0 && (
                              <Badge variant="outline" className="text-xs">
                                Duplicate
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatBytes(torrent.size)}</TableCell>
                        <TableCell>
                          <Badge variant={torrent.seeds < 5 ? "destructive" : torrent.seeds < 10 ? "secondary" : "default"}>
                            {torrent.seeds}
                          </Badge>
                        </TableCell>
                        <TableCell>{torrent.age}d</TableCell>
                        <TableCell className="font-semibold text-red-600">
                          {torrent.economyScore === 0 ? (
                            <span className="text-gray-500">0.00 (Dup)</span>
                          ) : (
                            torrent.economyScore.toFixed(2)
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={torrent.ratio < 0.5 ? "text-red-500" : torrent.ratio < 1.0 ? "text-yellow-500" : "text-green-500"}>
                            {torrent.ratio.toFixed(2)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, totalItems)} of {totalItems} torrents
                  {totalPages > 1 && (
                    <span className="ml-2 text-xs">
                      (Page {page} of {totalPages})
                    </span>
                  )}
                </div>
                {totalPages > 1 || totalItems > pageSize ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onPageChange?.(page - 1, pageSize)}
                      disabled={!hasPrevPage}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onPageChange?.(page + 1, pageSize)}
                      disabled={!hasNextPage}
                    >
                      Next
                    </Button>
                  </div>
                ) : null}
              </div>

              {/* Performance note for large datasets */}
              {totalItems > 100 && (
                <div className="mt-2 text-xs text-muted-foreground text-center">
                  Large dataset detected. Consider using filters or adjusting page size for better performance.
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Economy Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Storage Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">Well-seeded old content:</span>{" "}
              <Badge variant="outline">{stats.wellSeededOldContent}</Badge>
            </div>
            <div className="text-sm">
              <span className="font-medium">Rare content count:</span>{" "}
              <Badge variant="outline">{stats.rareContentCount}</Badge>
            </div>
            <div className="text-sm">
              <span className="font-medium">High-value torrents:</span>{" "}
              <Badge variant="outline">{stats.highValueTorrents}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              Optimization Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              Consider removing well-seeded content that's been seeding for extended periods
            </div>
            <div className="text-sm">
              Prioritize keeping rare content with low seed counts
            </div>
            <div className="text-sm">
              Large files with high rarity scores provide the best storage value
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
