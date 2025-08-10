/*
 * Copyright (c) 2024-2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

export const COLOR_CATEGORIES = {
  base: {
    label: 'Base',
    colors: ['background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground']
  },
  ui: {
    label: 'UI Elements', 
    colors: ['primary', 'primary-foreground', 'secondary', 'secondary-foreground', 
             'muted', 'muted-foreground', 'accent', 'accent-foreground', 'border', 'input', 'ring']
  },
  semantic: {
    label: 'Semantic',
    colors: ['destructive', 'destructive-foreground']
  },
  chart: {
    label: 'Ratio Colors',
    colors: ['chart-5', 'chart-4', 'chart-3', 'chart-2', 'chart-1']
  },
  sidebar: {
    label: 'Sidebar',
    colors: ['sidebar', 'sidebar-foreground', 'sidebar-primary', 'sidebar-primary-foreground',
             'sidebar-accent', 'sidebar-accent-foreground', 'sidebar-border', 'sidebar-ring']
  }
}

export const CHART_LABELS: Record<string, string> = {
  'chart-5': 'Ratio < 0.5',
  'chart-4': 'Ratio 0.5-1.0',
  'chart-3': 'Ratio 1.0-2.0',
  'chart-2': 'Ratio 2.0-5.0',
  'chart-1': 'Ratio > 5.0'
}

export function getColorLabel(color: string): string {
  return CHART_LABELS[color] || color.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// Color slider limits
export const COLOR_LIMITS = {
  lightness: { min: 0, max: 1, step: 0.01 },
  chroma: { min: 0, max: 0.4, step: 0.005 },
  hue: { min: 0, max: 360, step: 1 }
}

// Default color fallback
export const DEFAULT_COLOR = 'oklch(0.5 0.1 0)'

// Get all color CSS variable names
export function getAllColorVars(): string[] {
  const allColors = Object.values(COLOR_CATEGORIES).flatMap(cat => cat.colors)
  // Add additional status colors not in categories
  allColors.push('success', 'warning', 'error', 'info', 'radius')
  return allColors.map(color => `--${color}`)
}