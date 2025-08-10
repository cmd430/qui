/*
 * Copyright (c) 2024-2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useState, useCallback, useMemo } from 'react'
import { useTheme } from './useTheme'
import { useThemeCustomizations } from './useThemeCustomizations'
import { parseOklch, formatOklch } from '@/utils/colors'
import { DEFAULT_COLOR } from '@/constants/colors'

export function useColorState() {
  const { theme: currentThemeId } = useTheme()
  const { colorOverrides } = useThemeCustomizations()
  const [activeColor, setActiveColor] = useState('primary')
  const [hasChanges, setHasChanges] = useState(false)
  
  const currentMode = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  
  const getCurrentColor = useCallback((colorKey: string) => {
    const override = colorOverrides[currentThemeId]?.[currentMode]?.[colorKey]
    const computed = getComputedStyle(document.documentElement).getPropertyValue(colorKey).trim()
    return override || computed || DEFAULT_COLOR
  }, [currentThemeId, currentMode, colorOverrides])
  
  const currentColorValue = useMemo(() => getCurrentColor(`--${activeColor}`), [activeColor, getCurrentColor])
  const parsedColor = useMemo(() => parseOklch(currentColorValue), [currentColorValue])
  
  const updateColorValue = useCallback((l: number, c: number, h: number) => {
    const color = formatOklch(l, c, h)
    document.documentElement.style.setProperty(`--${activeColor}`, color)
    setHasChanges(true)
  }, [activeColor])
  
  return {
    currentThemeId,
    currentMode,
    activeColor,
    setActiveColor,
    parsedColor,
    updateColorValue,
    hasChanges,
    setHasChanges,
    colorOverrides,
    getCurrentColor
  }
}