/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatBytes } from "@/lib/utils"
import { TrendingUp, HardDrive, Target, AlertTriangle, Star, Zap } from "lucide-react"
import type { EconomyAnalysis } from "@/types"

interface EconomyDashboardProps {
  analysis: EconomyAnalysis
  instanceId: number
}

export function EconomyDashboard({ analysis }: EconomyDashboardProps) {
  const { stats, topValuable } = analysis

  return (
    <div className="space-y-6">
      {/* Economy Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Storage Value</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(stats.totalStorage)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalTorrents} torrents analyzed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deduplicated Storage</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(stats.deduplicatedStorage)}</div>
            <p className="text-xs text-muted-foreground">
              {formatBytes(stats.storageSavings)} saved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Economy Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageEconomyScore.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.highValueTorrents} high-value torrents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rare Content</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rareContentCount}</div>
            <p className="text-xs text-muted-foreground">
              Low seed count torrents
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Storage Efficiency */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Storage Efficiency
          </CardTitle>
          <CardDescription>
            Deduplication analysis showing potential storage savings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Deduplication Efficiency</span>
              <span className="text-sm text-muted-foreground">
                {((stats.storageSavings / stats.totalStorage) * 100).toFixed(1)}% saved
              </span>
            </div>
            <Progress
              value={(stats.deduplicatedStorage / stats.totalStorage) * 100}
              className="h-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Deduplicated: {formatBytes(stats.deduplicatedStorage)}</span>
              <span>Total: {formatBytes(stats.totalStorage)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

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
                  <TableCell>{torrent.age}</TableCell>
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
