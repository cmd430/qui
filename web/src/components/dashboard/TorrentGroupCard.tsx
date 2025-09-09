/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { formatBytes } from "@/lib/utils"
import { 
  Shield, 
  Copy, 
  ChevronDown, 
  ChevronRight, 
  Trash2, 
  Crown,
  RefreshCw,
  Info,
  Star
} from "lucide-react"
import type { TorrentGroup } from "@/types"
import { useState } from "react"

interface TorrentGroupCardProps {
  group: TorrentGroup
  selectedTorrents: Set<string>
  onSelectTorrent: (hash: string, checked: boolean) => void
  onSelectGroup: (hashes: string[], checked: boolean) => void
  onRemoveTorrent: (hash: string) => Promise<void>
  onRecheckTorrent: (hash: string) => Promise<void>
  onRemoveGroup: (hashes: string[]) => Promise<void>
}

export function TorrentGroupCard({
  group,
  selectedTorrents,
  onSelectTorrent,
  onSelectGroup,
  onRemoveTorrent,
  onRecheckTorrent,
  onRemoveGroup
}: TorrentGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  // Check if all torrents in group are selected
  const allSelected = group.torrents.every(torrent => selectedTorrents.has(torrent.hash))
  const someSelected = group.torrents.some(torrent => selectedTorrents.has(torrent.hash))

  const handleGroupSelect = (checked: boolean) => {
    const hashes = group.torrents.map(t => t.hash)
    onSelectGroup(hashes, checked)
  }

  const handleRemoveGroup = async () => {
    setIsRemoving(true)
    try {
      await onRemoveGroup(group.torrents.map(t => t.hash))
    } finally {
      setIsRemoving(false)
    }
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
              ref={(ref) => {
                if (ref) ref.indeterminate = someSelected && !allSelected
              }}
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
            {group.recommendedAction === "keep_best" && group.torrents.length > 1 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isRemoving}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Keep Best
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Keep Best Copy</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove {group.torrents.length - 1} duplicate copies, keeping only the best one.
                      You will save {formatBytes(group.potentialSavings)} of storage space.
                      The best copy is: {group.primaryTorrent.name}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRemoveGroup} className="bg-blue-600 hover:bg-blue-700">
                      Keep Best Copy
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
                          <Crown className="h-4 w-4 text-yellow-600" title="Best copy" />
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
                            <div className="flex gap-2 pt-4">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => onRecheckTorrent(torrent.hash)}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Recheck
                              </Button>
                              {group.groupType !== "last_seed" && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Remove
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Remove Torrent</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to remove this torrent?
                                        This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => onRemoveTorrent(torrent.hash)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Remove
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
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
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onRecheckTorrent(group.primaryTorrent.hash)}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Recheck
                    </Button>
                    {group.groupType !== "last_seed" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Torrent</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove this torrent?
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => onRemoveTorrent(group.primaryTorrent.hash)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
