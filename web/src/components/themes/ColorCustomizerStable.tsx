/*
 * Copyright (c) 2024-2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useState, useCallback, useMemo, useRef } from 'react'
import { Palette, Save, RotateCcw, X, Sparkles, Copy, Check, ChevronDown, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { useTheme } from '@/hooks/useTheme'
import { useThemeCustomizations } from '@/hooks/useThemeCustomizations'
import { useHasPremiumAccess } from '@/hooks/useThemeLicense'
import { converter } from 'culori'
import { getThemeById } from '@/config/themes'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { ThemeCreator } from './ThemeCreator'

// Parse OKLCH
function parseOklch(str: string): { l: number; c: number; h: number } {
  const match = str.match(/oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)/)
  if (!match) return { l: 0.5, c: 0.1, h: 0 }
  return {
    l: parseFloat(match[1]),
    c: parseFloat(match[2]),
    h: parseFloat(match[3])
  }
}

// Format OKLCH
function formatOklch(l: number, c: number, h: number): string {
  return `oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(4)})`
}

// Convert to hex
function toHex(l: number, c: number, h: number): string {
  try {
    const toRgb = converter('rgb')
    const rgb = toRgb({ mode: 'oklch', l, c, h })
    if (!rgb) return '#000000'
    
    // Convert RGB values to hex
    const toHexPart = (n: number) => {
      const hex = Math.round(Math.max(0, Math.min(255, n * 255))).toString(16)
      return hex.length === 1 ? '0' + hex : hex
    }
    
    return `#${toHexPart(rgb.r)}${toHexPart(rgb.g)}${toHexPart(rgb.b)}`
  } catch {
    return '#000000'
  }
}

// Color types organized by category
type ColorCategory = 'base' | 'ui' | 'semantic' | 'chart' | 'sidebar'
type ColorKey = 
  // Base colors
  | 'background' | 'foreground' | 'card' | 'card-foreground' | 'popover' | 'popover-foreground'
  // UI colors
  | 'primary' | 'primary-foreground' | 'secondary' | 'secondary-foreground' 
  | 'muted' | 'muted-foreground' | 'accent' | 'accent-foreground'
  // Semantic colors  
  | 'destructive' | 'destructive-foreground'
  // Utility colors
  | 'border' | 'input' | 'ring'
  // Chart colors (ratio colors)
  | 'chart-1' | 'chart-2' | 'chart-3' | 'chart-4' | 'chart-5'
  // Sidebar colors
  | 'sidebar' | 'sidebar-foreground' | 'sidebar-primary' | 'sidebar-primary-foreground'
  | 'sidebar-accent' | 'sidebar-accent-foreground' | 'sidebar-border' | 'sidebar-ring'

const COLOR_CATEGORIES: Record<ColorCategory, { label: string; colors: ColorKey[] }> = {
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

interface ColorCustomizerProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  mode?: 'popover' | 'dialog' // Control how it's displayed
}

export function ColorCustomizer({ 
  open: controlledOpen, 
  onOpenChange: controlledOnOpenChange,
  mode = 'popover' 
}: ColorCustomizerProps = {}) {
  const { theme: currentThemeId } = useTheme()
  const { hasPremiumAccess, isLoading: isLicenseLoading } = useHasPremiumAccess()
  const { colorOverrides, updateColors, isUpdating, isResetting } = useThemeCustomizations()
  
  const [internalOpen, setInternalOpen] = useState(false)
  
  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = controlledOnOpenChange || setInternalOpen
  const [activeCategory, setActiveCategory] = useState<ColorCategory>('ui')
  const [activeColor, setActiveColor] = useState<ColorKey>('primary')
  const [copiedValue, setCopiedValue] = useState<string | null>(null)
  const [showThemeCreator, setShowThemeCreator] = useState(false)
  
  // Determine current mode (light or dark)
  const isDarkMode = document.documentElement.classList.contains('dark')
  const currentMode = isDarkMode ? 'dark' : 'light'
  
  // Get current color
  const getCurrentColor = useCallback((colorKey: string) => {
    const saved = colorOverrides[currentThemeId]?.[currentMode]?.[colorKey]
    if (saved) return saved
    
    const computed = getComputedStyle(document.documentElement).getPropertyValue(colorKey).trim()
    return computed || 'oklch(0.5 0.1 0)'
  }, [currentThemeId, currentMode, colorOverrides])
  
  const currentColor = useMemo(() => 
    getCurrentColor(`--${activeColor}`),
    [activeColor, getCurrentColor]
  )
  
  const parsed = useMemo(() => parseOklch(currentColor), [currentColor])
  
  // Use refs to store values to avoid state update loops
  const valuesRef = useRef({ l: parsed.l, c: parsed.c, h: parsed.h })
  const [displayValues, setDisplayValues] = useState({ l: parsed.l, c: parsed.c, h: parsed.h })
  const [hasChanges, setHasChanges] = useState(false)
  
  // Preview color
  const previewColor = useMemo(() => 
    toHex(displayValues.l, displayValues.c, displayValues.h),
    [displayValues]
  )
  
  // Stable handlers
  const handleLightnessChange = useCallback((values: number[]) => {
    const newL = values[0]
    valuesRef.current.l = newL
    setDisplayValues(prev => ({ ...prev, l: newL }))
    setHasChanges(true)
    
    // Live preview
    const color = formatOklch(newL, valuesRef.current.c, valuesRef.current.h)
    document.documentElement.style.setProperty(`--${activeColor}`, color)
  }, [activeColor])
  
  const handleChromaChange = useCallback((values: number[]) => {
    const newC = values[0]
    valuesRef.current.c = newC
    setDisplayValues(prev => ({ ...prev, c: newC }))
    setHasChanges(true)
    
    // Live preview
    const color = formatOklch(valuesRef.current.l, newC, valuesRef.current.h)
    document.documentElement.style.setProperty(`--${activeColor}`, color)
  }, [activeColor])
  
  const handleHueChange = useCallback((values: number[]) => {
    const newH = values[0]
    valuesRef.current.h = newH
    setDisplayValues(prev => ({ ...prev, h: newH }))
    setHasChanges(true)
    
    // Live preview
    const color = formatOklch(valuesRef.current.l, valuesRef.current.c, newH)
    document.documentElement.style.setProperty(`--${activeColor}`, color)
  }, [activeColor])
  
  const handleSave = useCallback(() => {
    if (!currentThemeId || !hasChanges) return
    
    const newColor = formatOklch(valuesRef.current.l, valuesRef.current.c, valuesRef.current.h)
    
    // Get existing overrides for this theme - make sure we have the full structure
    const existingThemeOverrides = colorOverrides[currentThemeId] || { light: {}, dark: {} }
    
    // Build the complete structure preserving ALL modes
    const newOverrides = {
      ...colorOverrides,
      [currentThemeId]: {
        // Ensure both modes exist, preserving existing data
        light: existingThemeOverrides.light || {},
        dark: existingThemeOverrides.dark || {},
      }
    }
    
    // Now update only the current mode's specific color
    newOverrides[currentThemeId][currentMode] = {
      ...newOverrides[currentThemeId][currentMode],
      [`--${activeColor}`]: newColor
    }
    
    updateColors(newOverrides)
    setHasChanges(false)
  }, [currentThemeId, currentMode, activeColor, colorOverrides, updateColors, hasChanges])
  
  const handleResetCurrent = useCallback(() => {
    // Reset the current color to its original value
    if (!currentThemeId) return
    
    // Get the original theme colors
    const theme = getThemeById(currentThemeId)
    if (!theme) return
    
    const originalColors = currentMode === 'dark' ? theme.cssVars.dark : theme.cssVars.light
    const originalValue = originalColors[`--${activeColor}`]
    
    // Remove this specific color from overrides
    const newOverrides = { ...colorOverrides }
    if (newOverrides[currentThemeId]?.[currentMode]) {
      delete newOverrides[currentThemeId][currentMode][`--${activeColor}`]
      
      // If no colors left for this mode, clean up the structure
      if (Object.keys(newOverrides[currentThemeId][currentMode]).length === 0) {
        delete newOverrides[currentThemeId][currentMode]
        if (Object.keys(newOverrides[currentThemeId]).length === 0) {
          delete newOverrides[currentThemeId]
        }
      }
    }
    
    // Update the database
    updateColors(newOverrides)
    
    // Apply the original theme value
    if (originalValue) {
      document.documentElement.style.setProperty(`--${activeColor}`, originalValue)
      const parsed = parseOklch(originalValue)
      valuesRef.current = parsed
      setDisplayValues(parsed)
    }
    
    setHasChanges(false)
  }, [activeColor, currentThemeId, currentMode, colorOverrides, updateColors])
  
  const handleResetAll = useCallback(() => {
    // Reset all customizations for current theme
    if (!currentThemeId) return
    
    // Get the original theme
    const theme = getThemeById(currentThemeId)
    if (!theme) return
    
    // Remove this theme's overrides entirely
    const newOverrides = { ...colorOverrides }
    delete newOverrides[currentThemeId]
    
    // Always update the database - even if it results in an empty object
    // This ensures the theme entry is removed from the database
    updateColors(Object.keys(newOverrides).length === 0 ? {} : newOverrides)
    
    // Reapply all original theme colors for both modes
    const lightColors = theme.cssVars.light
    const darkColors = theme.cssVars.dark
    const originalColors = currentMode === 'dark' ? darkColors : lightColors
    
    Object.entries(originalColors).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value)
    })
    
    // Update the color picker display
    const originalValue = originalColors[`--${activeColor}`]
    if (originalValue) {
      const parsed = parseOklch(originalValue)
      valuesRef.current = parsed
      setDisplayValues(parsed)
    }
    
    setHasChanges(false)
  }, [currentThemeId, currentMode, activeColor, colorOverrides, updateColors])
  
  const handleColorSwitch = useCallback((color: ColorKey) => {
    setActiveColor(color)
    const newColor = getCurrentColor(`--${color}`)
    const parsed = parseOklch(newColor)
    valuesRef.current = parsed
    setDisplayValues(parsed)
    setHasChanges(false)
  }, [getCurrentColor])
  
  const getColorLabel = (color: ColorKey): string => {
    // Special labels for chart colors
    if (color === 'chart-5') return 'Ratio < 0.5'
    if (color === 'chart-4') return 'Ratio 0.5-1.0'
    if (color === 'chart-3') return 'Ratio 1.0-2.0'
    if (color === 'chart-2') return 'Ratio 2.0-5.0'
    if (color === 'chart-1') return 'Ratio > 5.0'
    
    // Format other colors
    return color.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }
  
  const copyToClipboard = useCallback((value: string) => {
    navigator.clipboard.writeText(value)
    setCopiedValue(value)
    setTimeout(() => setCopiedValue(null), 2000)
  }, [])
  
  // Collect all current colors (including customizations)
  const collectCurrentColors = useCallback((mode?: 'light' | 'dark') => {
    const colors: Record<string, string> = {}
    
    // If mode is specified, get from theme + overrides
    if (mode) {
      const theme = getThemeById(currentThemeId)
      if (theme) {
        const baseColors = mode === 'dark' ? theme.cssVars.dark : theme.cssVars.light
        // Start with base theme colors
        Object.assign(colors, baseColors)
        // Apply any customizations for this mode
        if (colorOverrides[currentThemeId]?.[mode]) {
          Object.assign(colors, colorOverrides[currentThemeId][mode])
        }
      }
    } else {
      // Get from currently rendered DOM (current mode)
      const root = document.documentElement
      
      // Get all color variables we track
      const allColors = [
        ...COLOR_CATEGORIES.base.colors,
        ...COLOR_CATEGORIES.ui.colors,
        ...COLOR_CATEGORIES.semantic.colors,
        ...COLOR_CATEGORIES.chart.colors,
        ...COLOR_CATEGORIES.sidebar.colors
      ]
      
      allColors.forEach(color => {
        const value = getComputedStyle(root).getPropertyValue(`--${color}`).trim()
        if (value) {
          colors[`--${color}`] = value
        }
      })
    }
    
    return colors
  }, [currentThemeId, colorOverrides])
  
  if (!isLicenseLoading && !hasPremiumAccess) {
    return null
  }

  // The main content that will be used in both dialog and popover
  const customizationContent = (
    <>
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          <h3 className="font-semibold">Customize Colors</h3>
          <Badge variant="secondary" className="text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            Premium
          </Badge>
        </div>
        {mode === 'popover' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
        
        <Separator />
        
        <div className="p-4 space-y-4">
          {/* Category tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {Object.entries(COLOR_CATEGORIES).map(([key, category]) => (
              <button
                key={key}
                onClick={() => {
                  setActiveCategory(key as ColorCategory)
                  setActiveColor(category.colors[0])
                  const newColor = getCurrentColor(`--${category.colors[0]}`)
                  const parsed = parseOklch(newColor)
                  valuesRef.current = parsed
                  setDisplayValues(parsed)
                  setHasChanges(false)
                }}
                className={cn(
                  "flex-1 px-2 py-1 text-xs font-medium rounded transition-colors",
                  activeCategory === key
                    ? "bg-background shadow-sm"
                    : "hover:bg-background/50"
                )}
              >
                {category.label}
              </button>
            ))}
          </div>
          
          {/* Color selector for active category */}
          <div className="grid grid-cols-2 gap-1.5">
            {COLOR_CATEGORIES[activeCategory].colors.map((color) => {
              const isCustomized = !!(colorOverrides[currentThemeId]?.[currentMode]?.[`--${color}`])
              return (
                <Button
                  key={color}
                  size="sm"
                  variant={activeColor === color ? 'default' : 'outline'}
                  onClick={() => handleColorSwitch(color)}
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
          
          {/* Preview */}
          <div className="flex items-center justify-between">
            <Label className="text-sm">
              {getColorLabel(activeColor)}
            </Label>
            <div 
              className="w-12 h-12 rounded-lg border ring-1 ring-black/10 dark:ring-white/10"
              style={{ backgroundColor: previewColor }}
            />
          </div>
          
          {/* Sliders */}
          <div className="space-y-3">
            {/* Lightness */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-xs">Lightness</Label>
                <span className="text-xs text-muted-foreground">
                  {displayValues.l.toFixed(2)}
                </span>
              </div>
              <Slider
                value={[displayValues.l]}
                onValueChange={handleLightnessChange}
                min={0}
                max={1}
                step={0.01}
              />
            </div>
            
            {/* Chroma */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-xs">Chroma (Saturation)</Label>
                <span className="text-xs text-muted-foreground">
                  {displayValues.c.toFixed(3)}
                </span>
              </div>
              <Slider
                value={[displayValues.c]}
                onValueChange={handleChromaChange}
                min={0}
                max={0.4}
                step={0.005}
              />
            </div>
            
            {/* Hue */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-xs">Hue</Label>
                <span className="text-xs text-muted-foreground">
                  {displayValues.h.toFixed(0)}°
                </span>
              </div>
              <Slider
                value={[displayValues.h]}
                onValueChange={handleHueChange}
                min={0}
                max={360}
                step={1}
              />
            </div>
          </div>
          
          {/* Color codes section */}
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
            <div className="text-xs font-medium text-muted-foreground mb-2">Color Values</div>
            
            {/* HEX value */}
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs flex-1 font-mono bg-background px-2 py-1 rounded">
                {previewColor.toUpperCase()}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => copyToClipboard(previewColor.toUpperCase())}
              >
                {copiedValue === previewColor.toUpperCase() ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
            
            {/* OKLCH value */}
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs flex-1 font-mono bg-background px-2 py-1 rounded">
                {formatOklch(displayValues.l, displayValues.c, displayValues.h)}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => copyToClipboard(formatOklch(displayValues.l, displayValues.c, displayValues.h))}
              >
                {copiedValue === formatOklch(displayValues.l, displayValues.c, displayValues.h) ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
          
          <div className="text-xs text-muted-foreground">
            <p>• Editing <strong>{currentMode}</strong> mode colors</p>
            <p>• Switch theme mode to edit {currentMode === 'light' ? 'dark' : 'light'} colors</p>
            <p>• Each mode has independent color settings</p>
          </div>
        </div>
        
        <Separator />
        
        <div className="flex items-center justify-between p-4 pt-2 gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={isResetting}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleResetCurrent}>
                Reset {getColorLabel(activeColor)}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleResetAll}>
                Reset All Colors
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowThemeCreator(true)}
              title="Save current colors as a new theme"
            >
              <Package className="h-4 w-4 mr-2" />
              Save as Theme
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || isUpdating}
            >
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
    </>
  )
  
  // Render as Dialog or Popover based on mode
  if (mode === 'dialog') {
    return (
      <>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-[480px] p-0">
            {customizationContent}
          </DialogContent>
        </Dialog>
      
        {/* Pass collected colors to ThemeCreator when it's shown */}
        {showThemeCreator && (
          <ThemeCreator
            open={showThemeCreator}
            onOpenChange={setShowThemeCreator}
            baseThemeId={currentThemeId}
            initialColors={{
              light: collectCurrentColors('light'),
              dark: collectCurrentColors('dark')
            }}
          />
        )}
      </>
    )
  }
  
  // Default: Render as Popover with button trigger
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon"
            className={cn(
              "relative",
              hasChanges && "ring-2 ring-primary ring-offset-2"
            )}
          >
            <Palette className="h-4 w-4" />
            {hasChanges && (
              <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full animate-pulse" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[440px] p-0" align="end">
          {customizationContent}
        </PopoverContent>
      </Popover>
      
      {/* Pass collected colors to ThemeCreator when it's shown */}
      {showThemeCreator && (
        <ThemeCreator
          open={showThemeCreator}
          onOpenChange={setShowThemeCreator}
          baseThemeId={currentThemeId}
          initialColors={{
            light: collectCurrentColors('light'),
            dark: collectCurrentColors('dark')
          }}
        />
      )}
    </>
  )
}