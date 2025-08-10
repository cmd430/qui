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
import { DEFAULT_COLOR } from '@/constants/colors'
import { debounce } from '@/utils/debounce'

// Type for theme color overrides structure
type ColorOverrides = Record<string, Record<string, Record<string, string>>>

export function useColorCustomizer() {
  const { theme: currentThemeId, mode: themeMode } = useTheme()
  const { colorOverrides: savedOverrides, updateColors } = useThemeCustomizations()
  const [activeColor, setActiveColor] = useState('primary')
  const [hasChanges, setHasChanges] = useState(false)
  const [copiedValue, setCopiedValue] = useState<string | null>(null)
  const [editedColors, setEditedColors] = useState<Record<string, string>>({})
  
  // Determine current mode from document
  const currentMode = useMemo(() => {
    // Use themeMode from useTheme, or fallback to checking DOM
    if (themeMode && themeMode !== 'auto') {
      return themeMode as 'light' | 'dark'
    }
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  }, [themeMode])
  
  // Get base colors from theme configuration
  const baseColors = useMemo(() => {
    const theme = getThemeById(currentThemeId)
    if (!theme) return {}
    
    const themeColors = currentMode === 'dark' ? theme.cssVars.dark : theme.cssVars.light
    const overrides = savedOverrides[currentThemeId]?.[currentMode] || {}
    
    // Merge base theme colors with saved overrides
    return { ...themeColors, ...overrides }
  }, [currentThemeId, currentMode, savedOverrides])
  
  // Combine base colors with current edits
  const colorValues = useMemo(() => {
    return { ...baseColors, ...editedColors }
  }, [baseColors, editedColors])
  
  // Clear edited colors when theme changes
  useEffect(() => {
    setEditedColors({})
    setHasChanges(false)
  }, [currentThemeId, currentMode])
  
  // Get current color value
  const currentColorValue = useMemo(() => {
    const key = `--${activeColor}`
    return colorValues[key] || DEFAULT_COLOR
  }, [activeColor, colorValues])
  
  const parsedColor = parseOklch(currentColorValue)
  
  // When switching colors, just update the active color
  const handleSetActiveColor = useCallback((color: string) => {
    setActiveColor(color)
  }, [])
  
  // Create a debounced version of updating edited colors
  const debouncedSetEditedColors = useMemo(
    () => debounce((key: string, color: string) => {
      setEditedColors(prev => ({ ...prev, [key]: color }))
      setHasChanges(true)
    }, 300),
    []
  )
  
  const updateColorValue = useCallback((l: number, c: number, h: number) => {
    const color = formatOklch(l, c, h)
    const key = `--${activeColor}`
    
    // Update DOM immediately for visual preview
    document.documentElement.style.setProperty(key, color)
    
    // Debounce the state update to reduce re-renders
    debouncedSetEditedColors(key, color)
  }, [activeColor, debouncedSetEditedColors])
  
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
      
      // Save all edited colors (merge with existing overrides)
      const existingOverrides = savedOverrides[currentThemeId]?.[currentMode] || {}
      Object.entries({ ...existingOverrides, ...editedColors }).forEach(([key, value]) => {
        updatedOverrides[currentThemeId][currentMode][key] = value
      })
      
      // Use the hook's updateColors which handles API, localStorage and toast
      await updateColors(updatedOverrides)
      setHasChanges(false)
    } catch (error) {
      console.error('Failed to save customizations:', error)
      toast.error('Failed to save customizations')
    }
  }, [currentThemeId, currentMode, editedColors, hasChanges, savedOverrides, updateColors])
  
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
      
      // Clear edited colors (will cause re-render with base theme colors)
      if (resetAll) {
        setEditedColors({})
      } else {
        setEditedColors(prev => {
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