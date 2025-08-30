/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { Button } from "@/components/ui/button"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { useRetag } from "@/hooks/useTQM"
import { Tags, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface RetagButtonProps {
  instanceId: number
  variant?: "button" | "dropdown-item"
  size?: "sm" | "default"
  disabled?: boolean
  showText?: boolean
}

export function RetagButton({
  instanceId,
  variant = "button",
  size = "sm",
  disabled = false,
  showText = false,
}: RetagButtonProps) {
  const { mutate: retag, isPending } = useRetag(instanceId)

  const handleRetag = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    retag(undefined, {
      onSuccess: (result) => {
        toast.success(
          `Retag operation completed: ${result.torrentsProcessed} torrents processed, ${result.tagsApplied} tags applied`,
          {
            duration: 5000,
          }
        )
      },
      onError: (error) => {
        toast.error(`Failed to retag torrents: ${error.message}`, {
          duration: 8000,
        })
      },
    })
  }

  if (variant === "dropdown-item") {
    return (
      <DropdownMenuItem
        onClick={handleRetag}
        disabled={disabled || isPending}
        className="cursor-pointer"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Tags className="h-4 w-4 mr-2" />
        )}
        <span>
          {isPending ? "Retagging..." : "Retag Torrents"}
        </span>
      </DropdownMenuItem>
    )
  }

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={handleRetag}
      disabled={disabled || isPending}
      className={showText ? "" : "h-8 w-8 p-0"}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Tags className="h-4 w-4" />
      )}
      {showText && (
        <span className="ml-2">
          {isPending ? "Running..." : "Run TQM"}
        </span>
      )}
    </Button>
  )
}