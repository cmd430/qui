/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { formatBytes } from "@/lib/utils"
import { 
  Shield, 
  Copy, 
  ChevronDown, 
  ChevronRight, 
  Crown,
  Info,
  Star
} from "lucide-react"
import type { TorrentGroup } from "@/types"
import { useState } from "react"
import { TorrentActions } from "../torrents/TorrentActions"

interface TorrentGroupCardProps {
  group: TorrentGroup
  selectedTorrents: Set<string>
  instanceId: number
  onSelectTorrent: (hash: string, checked: boolean) => void
  onSelectGroup: (hashes: string[], checked: boolean) => void
}

export function TorrentGroupCard({
  group,
  selectedTorrents,
  instanceId,
  onSelectTorrent,
  onSelectGroup
}: TorrentGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Check if all torrents in group are selected
  const allSelected = group.torrents.every(torrent => selectedTorrents.has(torrent.hash))

  // Get selected torrents from this group
  const selectedHashesInGroup = group.torrents
    .filter(torrent => selectedTorrents.has(torrent.hash))
    .map(torrent => torrent.hash)

  const handleGroupSelect = (checked: boolean) => {
    const hashes = group.torrents.map(t => t.hash)
    onSelectGroup(hashes, checked)
  }

  const handleComplete = () => {
    // Clear selections for this group
    selectedHashesInGroup.forEach(hash => onSelectTorrent(hash, false))
  }

  const getGroupIcon = () => {
    switch (group.groupType) {
      case "last_seed":
        return <Shield className="h-5 w-5 text-red-600" />
      case "duplicate":
        return <Copy className="h-5 w-5 text-blue-600" />
      default:
        return <Star className="h-5 w-5 text-yellow-600" />
    }
  }

  const getGroupBadge = () => {
    switch (group.groupType) {
      case "last_seed":
        return <Badge variant="destructive" className="text-xs">CRITICAL - Last Seed</Badge>
      case "duplicate":
        return <Badge variant="secondary" className="text-xs">Duplicate Content</Badge>
      default:
        return <Badge variant="outline" className="text-xs">Unique Content</Badge>
    }
  }

  const getRecommendationBadge = () => {
    switch (group.recommendedAction) {
      case "preserve":
        return <Badge variant="destructive" className="text-xs">PRESERVE</Badge>
      case "keep_best":
        return <Badge variant="secondary" className="text-xs">Keep Best</Badge>
      case "keep_all":
        return <Badge variant="default" className="text-xs">Keep All</Badge>
      default:
        return <Badge variant="outline" className="text-xs">Review</Badge>
    }
  }

  const getPriorityColor = () => {
    if (group.priority <= 3) return "text-red-600 font-bold"
    if (group.priority <= 10) return "text-orange-600 font-semibold"
    return "text-gray-600"
  }

  return (
    <Card className={`
      ${group.groupType === "last_seed" ? "border-red-200 bg-red-50/50" : ""}
      ${group.groupType === "duplicate" ? "border-blue-200 bg-blue-50/30" : ""}
      ${group.priority <= 3 ? "shadow-md" : ""}
    `}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={allSelected}
              onCheckedChange={handleGroupSelect}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {getGroupIcon()}
                <CardTitle className="text-base truncate">
                  {group.primaryTorrent.name}
                </CardTitle>
                <span className={`text-xs ${getPriorityColor()}`}>
                  Priority #{group.priority}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {getGroupBadge()}
                {getRecommendationBadge()}
                {group.torrents.length > 1 && (
                  <Badge variant="outline" className="text-xs">
                    {group.torrents.length} copies
                  </Badge>
                )}
                {group.potentialSavings > 0 && (
                  <Badge variant="outline" className="text-xs text-green-600">
                    Save {formatBytes(group.potentialSavings)}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-sm">
                {group.groupType === "last_seed" && (
                  <span className="text-red-600 font-medium">
                    ⚠️ We are the only remaining seed - NEVER REMOVE
                  </span>
                )}
                {group.groupType === "duplicate" && (
                  <span>
                    Multiple copies found. Consider keeping only the best copy.
                    Total: {formatBytes(group.totalSize)} → {formatBytes(group.deduplicatedSize)}
                  </span>
                )}
                {group.groupType === "unique" && (
                  <span>
                    Single copy of content. Score: {group.primaryTorrent.economyScore.toFixed(2)}
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {group.torrents.length > 1 && (
              <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
            )}
          </div>
        </div>
      </CardHeader>

      {group.torrents.length > 1 && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {group.torrents.map((torrent, index) => (
                  <div
                    key={torrent.hash}
                    className={`
                      p-3 rounded-lg border
                      ${index === 0 ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Checkbox
                          checked={selectedTorrents.has(torrent.hash)}
                          onCheckedChange={(checked: boolean) => onSelectTorrent(torrent.hash, checked)}
                        />
                        {index === 0 && (
                          <Crown className="h-4 w-4 text-yellow-600" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate" title={torrent.name}>
                            {torrent.name}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-4">
                            <span>Size: {formatBytes(torrent.size)}</span>
                            <span>Seeds: {torrent.seeds}</span>
                            <span>Score: {torrent.economyScore.toFixed(2)}</span>
                            <span>Age: {torrent.age}d</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {torrent.seeds === 0 && (
                          <Badge variant="destructive" className="text-xs">
                            Last Seed
                          </Badge>
                        )}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Info className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>{torrent.name}</DialogTitle>
                              <DialogDescription>
                                Detailed torrent information
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <h4 className="font-semibold">Basic Info</h4>
                                <div className="text-sm space-y-1">
                                  <div><strong>Size:</strong> {formatBytes(torrent.size)}</div>
                                  <div><strong>Seeds:</strong> {torrent.seeds}</div>
                                  <div><strong>Peers:</strong> {torrent.peers}</div>
                                  <div><strong>Age:</strong> {torrent.age} days</div>
                                  <div><strong>Ratio:</strong> {torrent.ratio.toFixed(2)}</div>
                                  <div><strong>State:</strong> {torrent.state}</div>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <h4 className="font-semibold">Economy Metrics</h4>
                                <div className="text-sm space-y-1">
                                  <div><strong>Economy Score:</strong> {torrent.economyScore.toFixed(2)}</div>
                                  <div><strong>Storage Value:</strong> {torrent.storageValue.toFixed(2)} GB</div>
                                  <div><strong>Rarity Bonus:</strong> {torrent.rarityBonus.toFixed(1)}x</div>
                                  <div><strong>Review Priority:</strong> {torrent.reviewPriority.toFixed(2)}</div>
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Single torrent display */}
      {group.torrents.length === 1 && (
        <CardContent className="pt-0">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>Size: {formatBytes(group.primaryTorrent.size)}</span>
              <span>Seeds: {group.primaryTorrent.seeds}</span>
              <span>Age: {group.primaryTorrent.age} days</span>
              <span>Score: {group.primaryTorrent.economyScore.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Info className="h-4 w-4 mr-2" />
                    Details
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{group.primaryTorrent.name}</DialogTitle>
                    <DialogDescription>
                      Detailed torrent analysis
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-semibold">Basic Info</h4>
                      <div className="text-sm space-y-1">
                        <div><strong>Size:</strong> {formatBytes(group.primaryTorrent.size)}</div>
                        <div><strong>Seeds:</strong> {group.primaryTorrent.seeds}</div>
                        <div><strong>Peers:</strong> {group.primaryTorrent.peers}</div>
                        <div><strong>Age:</strong> {group.primaryTorrent.age} days</div>
                        <div><strong>Ratio:</strong> {group.primaryTorrent.ratio.toFixed(2)}</div>
                        <div><strong>State:</strong> {group.primaryTorrent.state}</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold">Economy Analysis</h4>
                      <div className="text-sm space-y-1">
                        <div><strong>Economy Score:</strong> {group.primaryTorrent.economyScore.toFixed(2)}</div>
                        <div><strong>Storage Value:</strong> {group.primaryTorrent.storageValue.toFixed(2)} GB</div>
                        <div><strong>Rarity Bonus:</strong> {group.primaryTorrent.rarityBonus.toFixed(1)}x</div>
                      </div>
                      <div className="pt-2">
                        <h5 className="font-medium text-sm mb-1">Recommendations:</h5>
                        <div className="text-xs space-y-1">
                          {group.primaryTorrent.seeds === 0 && (
                            <div className="text-red-600 font-medium">• CRITICAL: Last remaining seed - PRESERVE</div>
                          )}
                          {group.primaryTorrent.economyScore < 20.0 && group.primaryTorrent.seeds > 10 && (
                            <div className="text-orange-600">• Well-seeded old content - consider removal</div>
                          )}
                          {group.primaryTorrent.seeds < 5 && group.primaryTorrent.seeds > 0 && (
                            <div className="text-blue-600">• Rare content - high preservation value</div>
                          )}
                          {group.primaryTorrent.ratio < 0.5 && (
                            <div className="text-yellow-600">• Poor ratio - may need attention</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      )}

      {/* Torrent Actions */}
      {selectedHashesInGroup.length > 0 && (
        <CardFooter className="pt-0">
          <div className="flex justify-between items-center w-full">
            <div className="text-sm text-muted-foreground">
              {selectedHashesInGroup.length} torrent{selectedHashesInGroup.length !== 1 ? 's' : ''} selected
            </div>
            <TorrentActions
              instanceId={instanceId}
              selectedHashes={selectedHashesInGroup}
              selectedTorrents={group.torrents.filter(torrent => selectedTorrents.has(torrent.hash))}
              onComplete={handleComplete}
            />
          </div>
        </CardFooter>
      )}
    </Card>
  )
}
