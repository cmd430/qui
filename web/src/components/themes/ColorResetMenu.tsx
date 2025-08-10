/*
 * Copyright (c) 2024-2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { RotateCcw, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getColorLabel } from '@/constants/colors'

interface ColorResetMenuProps {
  activeColor: string
  resetColor: (resetAll: boolean) => void
}

export function ColorResetMenu({ activeColor, resetColor }: ColorResetMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => resetColor(false)}>
          Reset {getColorLabel(activeColor)}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => resetColor(true)}>
          Reset All Colors
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}