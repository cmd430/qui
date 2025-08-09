/*
 * Copyright (c) 2024-2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useEffect } from 'react'
import { useTheme } from './useTheme'
import { useThemeCustomizations } from './useThemeCustomizations'

/**
 * Hook that automatically applies theme customizations when theme changes
 */
export function useThemeWithCustomizations() {
  const { theme: currentThemeId } = useTheme()
  const { colorOverrides } = useThemeCustomizations()

  useEffect(() => {
    if (!currentThemeId) return

    // Determine current mode
    const isDarkMode = document.documentElement.classList.contains('dark')
    const currentMode = isDarkMode ? 'dark' : 'light'
    
    // Check if there are saved customizations for the current theme and mode
    const themeOverrides = colorOverrides[currentThemeId]?.[currentMode]
    if (!themeOverrides) return

    // Apply each color override
    Object.entries(themeOverrides).forEach(([cssVar, value]) => {
      document.documentElement.style.setProperty(cssVar, value)
    })

    // Cleanup function to remove overrides when component unmounts
    return () => {
      Object.keys(themeOverrides).forEach(cssVar => {
        document.documentElement.style.removeProperty(cssVar)
      })
    }
  }, [currentThemeId, colorOverrides])
}