/*
 * Copyright (c) 2024-2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ColorSlider } from './ColorSlider'
import { ColorInput } from './ColorInput'
import { COLOR_CATEGORIES, getColorLabel, COLOR_LIMITS } from '@/constants/colors'
import { formatOklch, hexToOklch, oklchToHex } from '@/utils/colors'

type ColorCategory = keyof typeof COLOR_CATEGORIES

interface ColorPickerProps {
  activeCategory: ColorCategory
  setActiveCategory: (category: ColorCategory) => void
  activeColor: string
  setActiveColor: (color: string) => void
  parsedColor: { l: number; c: number; h: number }
  updateColorValue: (l: number, c: number, h: number) => void
  copyToClipboard: (value: string) => void
  copiedValue: string | null
  colorOverrides: Record<string, Record<string, Record<string, string>>>
  currentThemeId: string
  currentMode: 'light' | 'dark'
}

export function ColorPicker({
  activeCategory,
  setActiveCategory,
  activeColor,
  setActiveColor,
  parsedColor,
  updateColorValue,
  copyToClipboard,
  copiedValue,
  colorOverrides,
  currentThemeId,
  currentMode
}: ColorPickerProps) {
  const previewHex = oklchToHex(parsedColor.l, parsedColor.c, parsedColor.h)
  const oklchString = formatOklch(parsedColor.l, parsedColor.c, parsedColor.h)
  
  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        {Object.entries(COLOR_CATEGORIES).map(([key, category]) => (
          <button
            key={key}
            onClick={() => {
              setActiveCategory(key as ColorCategory)
              setActiveColor(category.colors[0])
            }}
            className={cn(
              "flex-1 px-2 py-1 text-xs font-medium rounded transition-colors",
              activeCategory === key ? "bg-background shadow-sm" : "hover:bg-background/50"
            )}
          >
            {category.label}
          </button>
        ))}
      </div>
      
      <div className="grid grid-cols-2 gap-1.5">
        {COLOR_CATEGORIES[activeCategory].colors.map((color) => {
          const isCustomized = !!(colorOverrides[currentThemeId]?.[currentMode]?.[`--${color}`])
          return (
            <Button
              key={color}
              size="sm"
              variant={activeColor === color ? 'default' : 'outline'}
              onClick={() => setActiveColor(color)}
              className="text-xs justify-start relative"
            >
              {getColorLabel(color)}
              {isCustomized && (
                <div className="absolute top-1 right-1 h-1.5 w-1.5 bg-primary rounded-full" />
              )}
            </Button>
          )
        })}
      </div>
      
      <div className="flex items-center justify-between">
        <Label className="text-sm">{getColorLabel(activeColor)}</Label>
        <div 
          className="w-12 h-12 rounded-lg border ring-1 ring-black/10 dark:ring-white/10"
          style={{ backgroundColor: previewHex }}
        />
      </div>
      
      <div className="space-y-3">
        <ColorSlider 
          label="Lightness" 
          value={parsedColor.l} 
          onChange={(v) => updateColorValue(v[0], parsedColor.c, parsedColor.h)}
          {...COLOR_LIMITS.lightness}
        />
        <ColorSlider 
          label="Chroma (Saturation)" 
          value={parsedColor.c} 
          onChange={(v) => updateColorValue(parsedColor.l, v[0], parsedColor.h)}
          {...COLOR_LIMITS.chroma}
        />
        <ColorSlider 
          label="Hue" 
          value={parsedColor.h} 
          onChange={(v) => updateColorValue(parsedColor.l, parsedColor.c, v[0])}
          {...COLOR_LIMITS.hue}
          suffix="°"
        />
      </div>
      
      <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
        <div className="text-xs font-medium text-muted-foreground mb-2">Color Values</div>
        
        <ColorInput
          value={previewHex.toUpperCase()}
          onChange={(e) => {
            const hex = e.target.value.trim()
            if (/^#?[0-9A-Fa-f]{6}$/.test(hex)) {
              const oklch = hexToOklch(hex.startsWith('#') ? hex : `#${hex}`)
              if (oklch) updateColorValue(oklch.l, oklch.c, oklch.h)
            }
          }}
          placeholder="#000000"
          onCopy={() => copyToClipboard(previewHex.toUpperCase())}
          copied={copiedValue === previewHex.toUpperCase()}
        />
        
        <ColorInput
          value={oklchString}
          onChange={(e) => {
            const match = e.target.value.match(/oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)/)
            if (match) {
              updateColorValue(parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]))
            }
          }}
          placeholder="oklch(0.5 0.1 0)"
          onCopy={() => copyToClipboard(oklchString)}
          copied={copiedValue === oklchString}
        />
      </div>
      
      <div className="text-xs text-muted-foreground">
        <p>• Editing <strong>{currentMode}</strong> mode colors</p>
        <p>• Switch theme mode to edit {currentMode === 'light' ? 'dark' : 'light'} colors</p>
      </div>
    </div>
  )
}