/*
 * Copyright (c) 2024-2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useEffect } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useThemeCustomizations } from '@/hooks/useThemeCustomizations'

/**
 * Provider component that applies theme color customizations
 * when theme or mode changes
 */
export function ThemeCustomizationProvider({ children }: { children: React.ReactNode }) {
  const { theme: currentThemeId, mode } = useTheme()
  const { colorOverrides } = useThemeCustomizations()
  
  useEffect(() => {
    // Determine which mode's colors to apply
    const isDarkMode = document.documentElement.classList.contains('dark')
    const currentMode = isDarkMode ? 'dark' : 'light'
    
    // Get custom colors for current theme and mode
    const customColors = colorOverrides[currentThemeId]?.[currentMode]
    
    if (customColors) {
      // Apply each custom color
      Object.entries(customColors).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value)
      })
    }
  }, [currentThemeId, mode, colorOverrides])
  
  return <>{children}</>
}