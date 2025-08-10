/*
 * Copyright (c) 2024-2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useHasPremiumAccess } from '@/hooks/useThemeLicense'
import { ColorCustomizerDialog } from './ColorCustomizerDialog'
import { ColorCustomizerPopover } from './ColorCustomizerPopover'

export function ColorCustomizer({ 
  open, 
  onOpenChange,
  mode = 'popover' 
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  mode?: 'popover' | 'dialog'
} = {}) {
  const { hasPremiumAccess, isLoading: isLicenseLoading } = useHasPremiumAccess()
  
  if (!isLicenseLoading && !hasPremiumAccess) return null
  
  if (mode === 'dialog') {
    // Dialog mode requires both props
    if (open === undefined || onOpenChange === undefined) {
      console.warn('ColorCustomizer: dialog mode requires open and onOpenChange props')
      return null
    }
    return <ColorCustomizerDialog open={open} onOpenChange={onOpenChange} />
  }
  
  return <ColorCustomizerPopover open={open} onOpenChange={onOpenChange} />
}