/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: MIT
 */

import { useHasPremiumAccess } from '@/hooks/useThemeLicense'
import { ColorCustomizerDialog } from './ColorCustomizerDialog'
import { ColorCustomizerPopover } from './ColorCustomizerPopover'
import { ThemeErrorBoundary } from './ThemeErrorBoundary'

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
  
  if (mode === 'dialog' && (open === undefined || onOpenChange === undefined)) {
    return null
  }

  return (
    <ThemeErrorBoundary>
      {mode === 'dialog' ? (
        <ColorCustomizerDialog open={open!} onOpenChange={onOpenChange!} />
      ) : (
        <ColorCustomizerPopover open={open} onOpenChange={onOpenChange} />
      )}
    </ThemeErrorBoundary>
  )
}
