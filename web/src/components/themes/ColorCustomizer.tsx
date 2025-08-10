/*
 * Copyright (c) 2024-2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Palette, Save, RotateCcw, X, Sparkles, Copy, Check, ChevronDown, Package, GripHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DraggableDialog, DraggableDialogHandle } from '@/components/ui/draggable-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useTheme } from '@/hooks/useTheme'
import { useThemeCustomizations } from '@/hooks/useThemeCustomizations'
import { useHasPremiumAccess } from '@/hooks/useThemeLicense'
import { converter } from 'culori'
import { getThemeById } from '@/config/themes'
import { cn } from '@/lib/utils'
import { ThemeCreator } from './ThemeCreator'

// Color conversion utilities
const parseOklch = (str: string) => {
  const match = str.match(/oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)/)
  return match 
    ? { l: parseFloat(match[1]), c: parseFloat(match[2]), h: parseFloat(match[3]) }
    : { l: 0.5, c: 0.1, h: 0 }
}

const formatOklch = (l: number, c: number, h: number) => 
  `oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(4)})`

const toHex = (l: number, c: number, h: number) => {
  try {
    const rgb = converter('rgb')({ mode: 'oklch', l, c, h })
    if (!rgb) return '#000000'
    const toHexPart = (n: number) => {
      const hex = Math.round(Math.max(0, Math.min(255, n * 255))).toString(16)
      return hex.padStart(2, '0')
    }
    return `#${toHexPart(rgb.r)}${toHexPart(rgb.g)}${toHexPart(rgb.b)}`
  } catch {
    return '#000000'
  }
}

const fromHex = (hex: string) => {
  try {
    const oklch = converter('oklch')(hex)
    if (!oklch || typeof oklch.l !== 'number' || typeof oklch.c !== 'number' || typeof oklch.h !== 'number') {
      return null
    }
    return { l: oklch.l, c: oklch.c, h: oklch.h }
  } catch {
    return null
  }
}

// Types
type ColorCategory = 'base' | 'ui' | 'semantic' | 'chart' | 'sidebar'
type ColorKey = string

const COLOR_CATEGORIES = {
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

const CHART_LABELS: Record<string, string> = {
  'chart-5': 'Ratio < 0.5',
  'chart-4': 'Ratio 0.5-1.0',
  'chart-3': 'Ratio 1.0-2.0',
  'chart-2': 'Ratio 2.0-5.0',
  'chart-1': 'Ratio > 5.0'
}

const getColorLabel = (color: string) => 
  CHART_LABELS[color] || color.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

// Components
const ColorSlider = ({ label, value, onChange, min = 0, max = 1, step = 0.01, suffix = '' }: any) => (
  <div className="space-y-1">
    <div className="flex justify-between">
      <Label className="text-xs">{label}</Label>
      <span className="text-xs text-muted-foreground">
        {typeof value === 'number' ? value.toFixed(label === 'Hue' ? 0 : label === 'Lightness' ? 2 : 3) : value}{suffix}
      </span>
    </div>
    <Slider value={[value]} onValueChange={onChange} min={min} max={max} step={step} />
  </div>
)

const ColorInput = ({ value, onChange, placeholder, onCopy, copied }: any) => (
  <div className="flex items-center gap-2">
    <Input
      className="text-xs flex-1 font-mono h-8"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onCopy}>
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  </div>
)

const DialogHeader = ({ onClose }: { onClose: () => void }) => (
  <DraggableDialogHandle className="flex items-center justify-between p-4 pb-2 border-b">
    <div className="flex items-center gap-2">
      <GripHorizontal className="h-4 w-4 text-muted-foreground" />
      <Palette className="h-5 w-5" />
      <h3 className="font-semibold">Customize Colors</h3>
      <Badge variant="secondary" className="text-xs">
        <Sparkles className="h-3 w-3 mr-1" />
        Premium
      </Badge>
    </div>
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
      <X className="h-4 w-4" />
    </Button>
  </DraggableDialogHandle>
)

const PopoverHeader = ({ onClose }: { onClose: () => void }) => (
  <div className="flex items-center justify-between p-4 pb-2 border-b">
    <div className="flex items-center gap-2">
      <Palette className="h-5 w-5" />
      <h3 className="font-semibold">Customize Colors</h3>
      <Badge variant="secondary" className="text-xs">
        <Sparkles className="h-3 w-3 mr-1" />
        Premium
      </Badge>
    </div>
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
      <X className="h-4 w-4" />
    </Button>
  </div>
)

// Main component
export function ColorCustomizer({ 
  open: controlledOpen, 
  onOpenChange: controlledOnOpenChange,
  mode = 'popover' 
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  mode?: 'popover' | 'dialog'
} = {}) {
  const { theme: currentThemeId } = useTheme()
  const { hasPremiumAccess, isLoading: isLicenseLoading } = useHasPremiumAccess()
  const { colorOverrides, updateColors, isUpdating, isResetting } = useThemeCustomizations()
  
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = controlledOnOpenChange || setInternalOpen
  
  const [activeCategory, setActiveCategory] = useState<ColorCategory>('ui')
  const [activeColor, setActiveColor] = useState<ColorKey>('primary')
  const [copiedValue, setCopiedValue] = useState<string | null>(null)
  const [showThemeCreator, setShowThemeCreator] = useState(false)
  
  const currentMode = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  
  const getCurrentColor = useCallback((colorKey: string) => {
    const saved = colorOverrides[currentThemeId]?.[currentMode]?.[colorKey]
    return saved || getComputedStyle(document.documentElement).getPropertyValue(colorKey).trim() || 'oklch(0.5 0.1 0)'
  }, [currentThemeId, currentMode, colorOverrides])
  
  const currentColor = useMemo(() => getCurrentColor(`--${activeColor}`), [activeColor, getCurrentColor])
  const initialParsed = useMemo(() => parseOklch(currentColor), [currentColor])
  
  const valuesRef = useRef(initialParsed)
  const [displayValues, setDisplayValues] = useState(initialParsed)
  const [hasChanges, setHasChanges] = useState(false)
  
  // Update values when active color changes
  useEffect(() => {
    const parsed = parseOklch(currentColor)
    valuesRef.current = parsed
    setDisplayValues(parsed)
    setHasChanges(false)
  }, [currentColor, activeColor])
  
  const previewColor = useMemo(() => toHex(displayValues.l, displayValues.c, displayValues.h), [displayValues])
  
  const updateColorValue = useCallback((updates: Partial<typeof displayValues>) => {
    const newValues = { ...valuesRef.current, ...updates }
    valuesRef.current = newValues
    setDisplayValues(newValues)
    setHasChanges(true)
    const color = formatOklch(newValues.l, newValues.c, newValues.h)
    document.documentElement.style.setProperty(`--${activeColor}`, color)
  }, [activeColor])
  
  const handleSave = useCallback(() => {
    if (!currentThemeId || !hasChanges) return
    
    const newColor = formatOklch(valuesRef.current.l, valuesRef.current.c, valuesRef.current.h)
    const existingThemeOverrides = colorOverrides[currentThemeId] || { light: {}, dark: {} }
    
    updateColors({
      ...colorOverrides,
      [currentThemeId]: {
        light: existingThemeOverrides.light || {},
        dark: existingThemeOverrides.dark || {},
        [currentMode]: {
          ...(existingThemeOverrides[currentMode] || {}),
          [`--${activeColor}`]: newColor
        }
      }
    })
    setHasChanges(false)
  }, [currentThemeId, currentMode, activeColor, colorOverrides, updateColors, hasChanges])
  
  const handleReset = useCallback((resetAll = false) => {
    if (!currentThemeId) return
    
    const theme = getThemeById(currentThemeId)
    if (!theme) return
    
    const newOverrides = { ...colorOverrides }
    
    if (resetAll) {
      delete newOverrides[currentThemeId]
      const colors = currentMode === 'dark' ? theme.cssVars.dark : theme.cssVars.light
      Object.entries(colors).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value)
      })
    } else {
      if (newOverrides[currentThemeId]?.[currentMode]) {
        delete newOverrides[currentThemeId][currentMode][`--${activeColor}`]
        if (Object.keys(newOverrides[currentThemeId][currentMode]).length === 0) {
          delete newOverrides[currentThemeId][currentMode]
          if (Object.keys(newOverrides[currentThemeId]).length === 0) {
            delete newOverrides[currentThemeId]
          }
        }
      }
      const originalColors = currentMode === 'dark' ? theme.cssVars.dark : theme.cssVars.light
      const originalValue = originalColors[`--${activeColor}`]
      if (originalValue) {
        document.documentElement.style.setProperty(`--${activeColor}`, originalValue)
        const parsed = parseOklch(originalValue)
        valuesRef.current = parsed
        setDisplayValues(parsed)
      }
    }
    
    updateColors(Object.keys(newOverrides).length === 0 ? {} : newOverrides)
    setHasChanges(false)
  }, [activeColor, currentThemeId, currentMode, colorOverrides, updateColors])
  
  const handleColorSwitch = useCallback((color: ColorKey) => {
    setActiveColor(color)
  }, [])
  
  const copyToClipboard = useCallback((value: string) => {
    navigator.clipboard.writeText(value)
    setCopiedValue(value)
    setTimeout(() => setCopiedValue(null), 2000)
  }, [])
  
  const collectCurrentColors = useCallback((mode?: 'light' | 'dark') => {
    const colors: Record<string, string> = {}
    
    if (mode) {
      const theme = getThemeById(currentThemeId)
      if (theme) {
        Object.assign(colors, mode === 'dark' ? theme.cssVars.dark : theme.cssVars.light)
        if (colorOverrides[currentThemeId]?.[mode]) {
          Object.assign(colors, colorOverrides[currentThemeId][mode])
        }
      }
    } else {
      const allColors = Object.values(COLOR_CATEGORIES).flatMap(cat => cat.colors)
      allColors.forEach(color => {
        const value = getComputedStyle(document.documentElement).getPropertyValue(`--${color}`).trim()
        if (value) colors[`--${color}`] = value
      })
    }
    
    return colors
  }, [currentThemeId, colorOverrides])
  
  if (!isLicenseLoading && !hasPremiumAccess) return null
  
  const content = (
    <>
      <div className="p-4 space-y-4">
        {/* Category tabs */}
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
        
        {/* Color buttons */}
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
          <Label className="text-sm">{getColorLabel(activeColor)}</Label>
          <div 
            className="w-12 h-12 rounded-lg border ring-1 ring-black/10 dark:ring-white/10"
            style={{ backgroundColor: previewColor }}
          />
        </div>
        
        {/* Sliders */}
        <div className="space-y-3">
          <ColorSlider 
            label="Lightness" 
            value={displayValues.l} 
            onChange={(v: number[]) => updateColorValue({ l: v[0] })}
          />
          <ColorSlider 
            label="Chroma (Saturation)" 
            value={displayValues.c} 
            onChange={(v: number[]) => updateColorValue({ c: v[0] })}
            max={0.4} 
            step={0.005}
          />
          <ColorSlider 
            label="Hue" 
            value={displayValues.h} 
            onChange={(v: number[]) => updateColorValue({ h: v[0] })}
            max={360} 
            step={1} 
            suffix="°"
          />
        </div>
        
        {/* Color codes */}
        <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
          <div className="text-xs font-medium text-muted-foreground mb-2">Color Values</div>
          
          <ColorInput
            value={previewColor.toUpperCase()}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const hex = e.target.value.trim()
              if (/^#?[0-9A-Fa-f]{6}$/.test(hex)) {
                const oklch = fromHex(hex.startsWith('#') ? hex : `#${hex}`)
                if (oklch) updateColorValue(oklch)
              }
            }}
            placeholder="#000000"
            onCopy={() => copyToClipboard(previewColor.toUpperCase())}
            copied={copiedValue === previewColor.toUpperCase()}
          />
          
          <ColorInput
            value={formatOklch(displayValues.l, displayValues.c, displayValues.h)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const parsed = parseOklch(e.target.value.trim())
              if (parsed.l > 0 || parsed.c > 0 || parsed.h > 0) {
                updateColorValue(parsed)
              }
            }}
            placeholder="oklch(0.5 0.1 0)"
            onCopy={() => copyToClipboard(formatOklch(displayValues.l, displayValues.c, displayValues.h))}
            copied={copiedValue === formatOklch(displayValues.l, displayValues.c, displayValues.h)}
          />
        </div>
        
        <div className="text-xs text-muted-foreground">
          <p>• Editing <strong>{currentMode}</strong> mode colors</p>
          <p>• Switch theme mode to edit {currentMode === 'light' ? 'dark' : 'light'} colors</p>
          <p>• Each mode has independent color settings</p>
        </div>
      </div>
      
      <div className="flex items-center justify-between p-4 pt-2 gap-2 border-t">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={isResetting}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => handleReset(false)}>
              Reset {getColorLabel(activeColor)}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleReset(true)}>
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
  
  // Render based on mode
  if (mode === 'dialog') {
    return (
      <>
        <DraggableDialog open={open} onOpenChange={setOpen} className="max-w-2xl overflow-hidden">
          <DialogHeader onClose={() => setOpen(false)} />
          {content}
        </DraggableDialog>
        
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
  
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon"
            className={cn("relative", hasChanges && "ring-2 ring-primary ring-offset-2")}
          >
            <Palette className="h-4 w-4" />
            {hasChanges && (
              <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full animate-pulse" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[440px] p-0" align="end">
          <PopoverHeader onClose={() => setOpen(false)} />
          {content}
        </PopoverContent>
      </Popover>
      
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