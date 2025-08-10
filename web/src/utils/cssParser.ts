/*
 * Copyright (c) 2024-2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { DEFAULT_FONTS } from '@/constants/fonts'

export function parseCSSFormat(cssText: string): { light: Record<string, string>, dark: Record<string, string> } | null {
  try {
    const lightVars: Record<string, string> = {}
    const darkVars: Record<string, string> = {}
    
    const rootMatch = cssText.match(/:root\s*{([^}]+)}/s)
    if (rootMatch) {
      const vars = rootMatch[1].matchAll(/--([a-z-]+):\s*([^;]+);/g)
      for (const match of vars) {
        const key = `--${match[1]}`
        const value = match[2].trim()
        lightVars[key] = value
      }
    }
    
    const darkMatch = cssText.match(/\.dark\s*{([^}]+)}/s)
    if (darkMatch) {
      const vars = darkMatch[1].matchAll(/--([a-z-]+):\s*([^;]+);/g)
      for (const match of vars) {
        const key = `--${match[1]}`
        const value = match[2].trim()
        darkVars[key] = value
      }
    }
    
    if (Object.keys(lightVars).length === 0 && Object.keys(darkVars).length === 0) {
      return null
    }
    
    return { light: lightVars, dark: darkVars }
  } catch {
    return null
  }
}

export function ensureFonts(cssVars: Record<string, string>): Record<string, string> {
  const result = { ...cssVars }
  
  Object.entries(DEFAULT_FONTS).forEach(([key, value]) => {
    if (!result[key]) result[key] = value
  })
  
  return result
}

export function formatCSSForExport(theme: {
  cssVarsLight: Record<string, string>
  cssVarsDark: Record<string, string>
}): string {
  const lightVars = Object.entries(theme.cssVarsLight)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n')
  
  const darkVars = Object.entries(theme.cssVarsDark)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n')
  
  return `:root {\n${lightVars}\n}\n\n.dark {\n${darkVars}\n}`
}