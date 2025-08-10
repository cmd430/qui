/*
 * Copyright (c) 2024-2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useTheme } from './useTheme'
import { useThemeCustomizations } from './useThemeCustomizations'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { parseOklch, formatOklch } from '@/utils/colors'
import { getThemeById } from '@/config/themes'
import { COPY_FEEDBACK_DURATION } from '@/constants/timings'

// Type for theme color overrides structure
type ColorOverrides = Record<string, Record<string, Record<string, string>>>

export function useColorCustomizer() {
  const { theme: currentThemeId } = useTheme()
  const { colorOverrides: savedOverrides, updateColors } = useThemeCustomizations()
  const [activeColor, setActiveColor] = useState('primary')
  const [hasChanges, setHasChanges] = useState(false)
  const [copiedValue, setCopiedValue] = useState<string | null>(null)
  const [currentMode, setCurrentMode] = useState<'light' | 'dark'>('light')
  const [colorValues, setColorValues] = useState<Record<string, string>>({})
  
  // Initialize mode and colors from DOM after mount
  useEffect(() => {
    // Read mode from DOM
    const mode = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    setCurrentMode(mode)
    
    // Read all color values from DOM
    const allColors: Record<string, string> = {}
    const colorVars = [
      '--primary', '--secondary', '--destructive', '--muted', '--accent', '--popover',
      '--card', '--primary-foreground', '--secondary-foreground', '--destructive-foreground',
      '--muted-foreground', '--accent-foreground', '--popover-foreground', '--card-foreground',
      '--background', '--foreground', '--border', '--input', '--ring', '--radius',
      '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5',
      '--success', '--warning', '--error', '--info'
    ]
    
    colorVars.forEach(cssVar => {
      const value = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
      if (value) {
        allColors[cssVar] = value
      }
    })
    
    setColorValues(allColors)
  }, [])
  
  // Get current color value from state
  const currentColorValue = useMemo(() => {
    const key = `--${activeColor}`
    return colorValues[key] || 'oklch(0.5 0.1 0)'
  }, [activeColor, colorValues])
  
  const parsedColor = parseOklch(currentColorValue)
  
  // When switching colors, just update the active color
  const handleSetActiveColor = useCallback((color: string) => {
    setActiveColor(color)
  }, [])
  
  const updateColorValue = useCallback((l: number, c: number, h: number) => {
    const color = formatOklch(l, c, h)
    const key = `--${activeColor}`
    
    // Update state (for slider position)
    setColorValues(prev => ({ ...prev, [key]: color }))
    
    // Update DOM (for visual preview)
    document.documentElement.style.setProperty(key, color)
    setHasChanges(true)
  }, [activeColor])
  
  const saveChanges = useCallback(async () => {
    if (!currentThemeId || !hasChanges) return
    
    try {
      // Build the overrides object with current edits
      const updatedOverrides = { ...savedOverrides }
      if (!updatedOverrides[currentThemeId]) {
        updatedOverrides[currentThemeId] = {}
      }
      if (!updatedOverrides[currentThemeId][currentMode]) {
        updatedOverrides[currentThemeId][currentMode] = {}
      }
      
      // Save all edited colors
      Object.entries(colorValues).forEach(([key, value]) => {
        updatedOverrides[currentThemeId][currentMode][key] = value
      })
      
      // Use the hook's updateColors which handles API, localStorage and toast
      await updateColors(updatedOverrides)
      setHasChanges(false)
    } catch (error) {
      console.error('Failed to save customizations:', error)
      toast.error('Failed to save customizations')
    }
  }, [currentThemeId, currentMode, colorValues, hasChanges, savedOverrides, updateColors])
  
  const resetColor = useCallback(async (resetAll: boolean) => {
    if (!currentThemeId) return
    
    const theme = getThemeById(currentThemeId)
    if (!theme) return
    
    try {
      // Get fresh data from server
      const freshData = await api.getThemeCustomizations()
      const freshOverrides: ColorOverrides = freshData.colorOverrides || {}
      
      // Clear the appropriate colors from overrides
      if (resetAll) {
        // Reset all colors for this theme
        delete freshOverrides[currentThemeId]
      } else {
        // Reset just the active color
        if (freshOverrides[currentThemeId]?.[currentMode]) {
          delete freshOverrides[currentThemeId][currentMode][`--${activeColor}`]
          
          // Clean up empty objects
          if (Object.keys(freshOverrides[currentThemeId][currentMode]).length === 0) {
            delete freshOverrides[currentThemeId][currentMode]
          }
          if (freshOverrides[currentThemeId] && Object.keys(freshOverrides[currentThemeId]).length === 0) {
            delete freshOverrides[currentThemeId]
          }
        }
      }
      
      // Save via updateColors to handle localStorage and API
      await updateColors(freshOverrides)
      
      // Apply base theme colors to DOM
      const cssVars = currentMode === 'dark' ? theme.cssVars.dark : theme.cssVars.light
      Object.entries(cssVars).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value as string)
      })
      
      // Update local state
      if (resetAll) {
        setColorValues({})
      } else {
        setColorValues(prev => {
          const next = { ...prev }
          delete next[`--${activeColor}`]
          return next
        })
      }
      
      setHasChanges(false)
      toast.success(resetAll ? 'All colors reset' : 'Color reset')
    } catch (error) {
      console.error('Failed to reset customizations:', error)
      toast.error('Failed to reset customizations')
    }
  }, [activeColor, currentThemeId, currentMode, updateColors])
  
  const copyToClipboard = useCallback((value: string) => {
    navigator.clipboard.writeText(value)
    setCopiedValue(value)
    setTimeout(() => setCopiedValue(null), COPY_FEEDBACK_DURATION)
  }, [])
  
  return {
    currentThemeId,
    currentMode,
    activeColor,
    setActiveColor: handleSetActiveColor,
    parsedColor,
    updateColorValue,
    saveChanges,
    resetColor,
    hasChanges,
    copyToClipboard,
    copiedValue,
    colorOverrides: savedOverrides
  }
}