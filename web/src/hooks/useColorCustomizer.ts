/*
 * Copyright (c) 2024-2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useCallback } from 'react'
import { useColorState } from './useColorState'
import { useColorPersistence } from './useColorPersistence'
import { useColorActions } from './useColorActions'

export function useColorCustomizer() {
  const state = useColorState()
  const persistence = useColorPersistence()
  const actions = useColorActions()
  
  const saveChanges = useCallback(() => {
    return persistence.saveChanges(
      state.currentThemeId,
      state.currentMode,
      state.activeColor,
      state.hasChanges,
      state.setHasChanges
    )
  }, [state, persistence])
  
  const resetColor = useCallback((resetAll: boolean) => {
    return persistence.resetColor(
      resetAll,
      state.activeColor,
      state.currentThemeId,
      state.currentMode,
      state.setHasChanges
    )
  }, [state, persistence])
  
  return {
    currentThemeId: state.currentThemeId,
    currentMode: state.currentMode,
    activeColor: state.activeColor,
    setActiveColor: state.setActiveColor,
    parsedColor: state.parsedColor,
    updateColorValue: state.updateColorValue,
    saveChanges,
    resetColor,
    hasChanges: state.hasChanges,
    copyToClipboard: actions.copyToClipboard,
    copiedValue: actions.copiedValue,
    colorOverrides: state.colorOverrides
  }
}