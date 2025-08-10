/*
 * Copyright (c) 2024-2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { converter, formatHex, formatCss } from 'culori'

// Simple OKLCH color parsing and formatting
export function parseOklch(str: string): { l: number; c: number; h: number } {
  const match = str.match(/oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)/)
  if (!match) return { l: 0.5, c: 0.1, h: 0 }
  return { 
    l: parseFloat(match[1]), 
    c: parseFloat(match[2]), 
    h: parseFloat(match[3]) 
  }
}

export function formatOklch(l: number, c: number, h: number): string {
  return `oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(4)})`
}

// Accurate OKLCH to Hex conversion using culori
export function oklchToHex(l: number, c: number, h: number): string {
  try {
    // Create OKLCH color object
    const oklchColor = { 
      mode: 'oklch' as const, 
      l, 
      c, 
      h: h || 0 // Handle NaN/undefined hue
    }
    
    // Convert to RGB then to hex
    const toRgb = converter('rgb')
    const rgbColor = toRgb(oklchColor)
    
    if (!rgbColor) return '#000000'
    
    const hexColor = formatHex(rgbColor)
    return hexColor || '#000000'
  } catch (error) {
    console.warn('Failed to convert OKLCH to hex:', { l, c, h }, error)
    return '#000000'
  }
}

// Accurate Hex to OKLCH conversion using culori
export function hexToOklch(hex: string): { l: number; c: number; h: number } | null {
  try {
    // Convert hex to OKLCH
    const toOklch = converter('oklch')
    const oklchColor = toOklch(hex)
    
    if (!oklchColor) return null
    
    return {
      l: oklchColor.l || 0,
      c: oklchColor.c || 0,
      h: oklchColor.h || 0
    }
  } catch (error) {
    console.warn('Failed to convert hex to OKLCH:', hex, error)
    return null
  }
}

// Export formatted CSS string for OKLCH color
export function formatOklchCss(l: number, c: number, h: number): string {
  try {
    const oklchColor = { mode: 'oklch' as const, l, c, h }
    return formatCss(oklchColor) || formatOklch(l, c, h)
  } catch {
    return formatOklch(l, c, h)
  }
}