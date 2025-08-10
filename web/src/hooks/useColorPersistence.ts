/*
 * Copyright (c) 2024-2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useCallback } from 'react'
import { useThemeCustomizations } from './useThemeCustomizations'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { setTheme } from '@/utils/theme'
import { getThemeById } from '@/config/themes'

export function useColorPersistence() {
  const { updateColors } = useThemeCustomizations()
  
  const saveChanges = useCallback(async (
    currentThemeId: string,
    currentMode: 'light' | 'dark',
    activeColor: string,
    hasChanges: boolean,
    setHasChanges: (value: boolean) => void
  ) => {
    if (!currentThemeId || !hasChanges) return
    
    try {
      const freshData = await api.getThemeCustomizations()
      const freshOverrides = freshData.colorOverrides || {}
      
      if (!freshOverrides[currentThemeId]) {
        freshOverrides[currentThemeId] = {}
      }
      if (!freshOverrides[currentThemeId][currentMode]) {
        freshOverrides[currentThemeId][currentMode] = {}
      }
      
      const currentColorValue = document.documentElement.style.getPropertyValue(`--${activeColor}`)
      freshOverrides[currentThemeId][currentMode][`--${activeColor}`] = currentColorValue
      
      updateColors(freshOverrides)
      await setTheme(currentThemeId)
      setHasChanges(false)
    } catch (error) {
      toast.error('Failed to save customizations')
    }
  }, [updateColors])
  
  const resetColor = useCallback(async (
    resetAll: boolean,
    activeColor: string,
    currentThemeId: string,
    currentMode: 'light' | 'dark',
    setHasChanges: (value: boolean) => void
  ) => {
    if (!currentThemeId) return
    
    const theme = getThemeById(currentThemeId)
    if (!theme) return
    
    try {
      const freshData = await api.getThemeCustomizations()
      const freshOverrides = freshData.colorOverrides || {}
      
      if (resetAll) {
        delete freshOverrides[currentThemeId]
      } else {
        if (freshOverrides[currentThemeId]?.[currentMode]) {
          delete freshOverrides[currentThemeId][currentMode][`--${activeColor}`]
          
          if (Object.keys(freshOverrides[currentThemeId][currentMode]).length === 0) {
            delete freshOverrides[currentThemeId][currentMode]
          }
          if (freshOverrides[currentThemeId] && Object.keys(freshOverrides[currentThemeId]).length === 0) {
            delete freshOverrides[currentThemeId]
          }
        }
      }
      
      updateColors(freshOverrides)
      await setTheme(currentThemeId)
      setHasChanges(false)
    } catch (error) {
      toast.error('Failed to reset customizations')
    }
  }, [updateColors])
  
  return { saveChanges, resetColor }
}