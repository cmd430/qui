/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: MIT
 */

import { useEffect } from 'react'
import { initializeTheme } from '@/utils/theme'
import { initializePWANativeTheme } from '@/utils/pwaNativeTheme'
import { useThemeWithCustomizations } from '@/hooks/useThemeWithCustomizations'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize base theme
  useEffect(() => {
    initializeTheme().catch(console.error)
    initializePWANativeTheme()
  }, [])

  // Apply customizations when theme changes
  useThemeWithCustomizations()

  return <>{children}</>
}
