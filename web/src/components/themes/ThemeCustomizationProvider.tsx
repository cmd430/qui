/*
 * Copyright (c) 2024-2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useEffect } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useThemeCustomizations } from '@/hooks/useThemeCustomizations'

/**
 * Simple provider that applies theme customizations
 */
export function ThemeCustomizationProvider({ children }: { children: React.ReactNode }) {
  const { theme: currentThemeId } = useTheme()
  const { colorOverrides, isLoading } = useThemeCustomizations()
  
  useEffect(() => {
    if (isLoading || !colorOverrides || !currentThemeId) return
    
    const isDarkMode = document.documentElement.classList.contains('dark')
    const currentMode = isDarkMode ? 'dark' : 'light'
    const customColors = colorOverrides[currentThemeId]?.[currentMode]
    
    if (customColors) {
      Object.entries(customColors).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value)
      })
    }
  }, [currentThemeId, colorOverrides, isLoading])
  
  return <>{children}</>
}