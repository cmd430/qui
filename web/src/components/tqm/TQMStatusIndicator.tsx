/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useTQMStatus } from "@/hooks/useTQM"
import { Tags, AlertTriangle, CheckCircle, Clock } from "lucide-react"
import { TQM_OPERATION_STATUS } from "@/types"

interface TQMStatusIndicatorProps {
  instanceId: number
  size?: "sm" | "default"
  showText?: boolean
}

export function TQMStatusIndicator({
  instanceId,
  size = "sm",
  showText = false,
}: TQMStatusIndicatorProps) {
  const { data: status, isLoading } = useTQMStatus(instanceId)

  if (isLoading || !status?.enabled || !status?.lastRun) {
    return null
  }

  const lastRun = status.lastRun
  const operationStatus = lastRun.status
  const isRecent = new Date(lastRun.startedAt) > new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago

  const getStatusIcon = () => {
    switch (operationStatus) {
      case "running":
        return <Clock className="h-3 w-3" />
      case "completed":
        return <CheckCircle className="h-3 w-3" />
      case "failed":
        return <AlertTriangle className="h-3 w-3" />
      default:
        return <Tags className="h-3 w-3" />
    }
  }

  const getStatusVariant = () => {
    switch (operationStatus) {
      case "running":
        return "secondary"
      case "completed":
        return isRecent ? "default" : "secondary"
      case "failed":
        return "destructive"
      default:
        return "secondary"
    }
  }

  const getTooltipContent = () => {
    const statusText = TQM_OPERATION_STATUS[operationStatus] || "Unknown"
    const timeAgo = new Date(lastRun.startedAt).toLocaleString()

    if (operationStatus === "running") {
      return `TQM is currently ${statusText.toLowerCase()} (started ${timeAgo})`
    }

    if (operationStatus === "failed") {
      return `TQM operation failed at ${timeAgo}${lastRun.errorMessage ? `: ${lastRun.errorMessage}` : ""}`
    }

    return `Last TQM operation ${statusText.toLowerCase()} at ${timeAgo} - ${lastRun.torrentsProcessed} torrents processed, ${lastRun.tagsApplied} tags applied`
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={getStatusVariant() as "secondary" | "default" | "destructive"}
          className={`${size === "sm" ? "h-5" : "h-6"} px-1.5 cursor-help`}
        >
          {getStatusIcon()}
          {showText && (
            <span className="ml-1 text-xs">
              TQM {operationStatus === "running" ? "Running" : ""}
            </span>
          )}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="max-w-xs text-sm">{getTooltipContent()}</p>
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Simple TQM enabled indicator for showing TQM is available on instance
 */
export function TQMEnabledIndicator({ instanceId }: { instanceId: number }) {
  const { data: status } = useTQMStatus(instanceId)

  if (!status?.enabled) {
    return null
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="h-5 px-1.5 cursor-help">
          <Tags className="h-3 w-3" />
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-sm">TQM enabled - automatic torrent tagging available</p>
      </TooltipContent>
    </Tooltip>
  )
}