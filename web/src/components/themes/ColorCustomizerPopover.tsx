/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: MIT
 */

import { useState } from 'react'
import { Palette, Save, Package, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useColorCustomizer } from '@/hooks/useColorCustomizer'
import { ColorPicker } from './ColorPicker'
import { ColorResetMenu } from './ColorResetMenu'
import { ThemeCreator } from './ThemeCreator'
import { getThemeById } from '@/config/themes'
import { COLOR_CATEGORIES } from '@/constants/colors'
import { cn } from '@/lib/utils'

type ColorCategory = keyof typeof COLOR_CATEGORIES

interface ColorCustomizerPopoverProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ColorCustomizerPopover({ 
  open: controlledOpen, 
  onOpenChange: controlledOnOpenChange 
}: ColorCustomizerPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<ColorCategory>('ui')
  const [showThemeCreator, setShowThemeCreator] = useState(false)
  
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = controlledOnOpenChange || setInternalOpen
  
  const {
    currentThemeId,
    currentMode,
    activeColor,
    setActiveColor,
    parsedColor,
    updateColorValue,
    saveChanges,
    resetColor,
    hasChanges,
    copyToClipboard,
    copiedValue,
    colorOverrides
  } = useColorCustomizer()
  
  const collectCurrentColors = (mode?: 'light' | 'dark') => {
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
          <div className="flex items-center justify-between p-4 pb-2 border-b">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              <h3 className="font-semibold">Customize Colors</h3>
              <Badge variant="secondary" className="text-xs">Premium</Badge>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <ColorPicker
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            activeColor={activeColor}
            setActiveColor={setActiveColor}
            parsedColor={parsedColor}
            updateColorValue={updateColorValue}
            copyToClipboard={copyToClipboard}
            copiedValue={copiedValue}
            colorOverrides={colorOverrides}
            currentThemeId={currentThemeId}
            currentMode={currentMode}
          />
          
          <div className="flex items-center justify-between p-4 pt-2 gap-2 border-t">
            <ColorResetMenu activeColor={activeColor} resetColor={resetColor} />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowThemeCreator(true)}
              >
                <Package className="h-4 w-4 mr-2" />
                Save as Theme
              </Button>
              <Button
                size="sm"
                onClick={saveChanges}
                disabled={!hasChanges}
              >
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
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
