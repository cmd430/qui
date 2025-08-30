/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { InstancePreferencesDialog } from "./preferences/InstancePreferencesDialog"
import { TQMSettingsDialog } from "../tqm/TQMSettingsDialog"
import { Cog, Settings, Tags } from "lucide-react"

interface InstanceSettingsButtonProps {
  instanceId: number
  instanceName: string
  onClick?: (e: React.MouseEvent) => void
}

export function InstanceSettingsButton({
  instanceId,
  instanceName,
  onClick,
}: InstanceSettingsButtonProps) {
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [tqmSettingsOpen, setTqmSettingsOpen] = useState(false)

  const handlePreferencesClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onClick?.(e)
    setPreferencesOpen(true)
  }

  const handleTQMClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onClick?.(e)
    setTqmSettingsOpen(true)
  }

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0"
              >
                <Cog className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            Instance Settings
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handlePreferencesClick}>
            <Settings className="h-4 w-4 mr-2" />
            Instance Preferences
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleTQMClick}>
            <Tags className="h-4 w-4 mr-2" />
            TQM Settings
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <InstancePreferencesDialog
        open={preferencesOpen}
        onOpenChange={setPreferencesOpen}
        instanceId={instanceId}
        instanceName={instanceName}
      />

      <TQMSettingsDialog
        open={tqmSettingsOpen}
        onOpenChange={setTqmSettingsOpen}
        instanceId={instanceId}
      />
    </>
  )
}