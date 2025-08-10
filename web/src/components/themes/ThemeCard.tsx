/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: MIT
 */

import { Check, Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ThemeCardMenu } from './ThemeCardMenu'
import type { CustomTheme } from '@/types'

interface ThemeCardProps {
  theme: CustomTheme
  isSelected: boolean
  onSelect: () => void
  onEdit: () => void
  onDuplicate: () => void
  onExport: () => void
  onDelete: () => void
}

export function ThemeCard({ 
  theme, 
  isSelected, 
  onSelect, 
  onEdit, 
  onDuplicate, 
  onExport, 
  onDelete 
}: ThemeCardProps) {
  const getThemeColors = () => {
    const isDark = document.documentElement.classList.contains('dark')
    const cssVars = isDark ? theme.cssVarsDark : theme.cssVarsLight
    
    return {
      primary: cssVars['--primary'] || '',
      secondary: cssVars['--secondary'] || '',
      accent: cssVars['--accent'] || ''
    }
  }
  
  const colors = getThemeColors()
  
  return (
    <Card 
      className={cn(
        "h-full hover:shadow-md transition-all duration-200 cursor-pointer",
        isSelected && "ring-2 ring-primary"
      )}
      onClick={onSelect}
    >
      <CardHeader className="pb-2 sm:pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            {theme.name}
            {isSelected && <Check className="h-4 w-4 text-primary" />}
          </CardTitle>
          <ThemeCardMenu
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onExport={onExport}
            onDelete={onDelete}
          />
        </div>
        {theme.description && (
          <CardDescription className="text-xs mt-1">
            {theme.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="pb-3 sm:pb-4">
        <div className="flex gap-1 mb-3">
          <div 
            className="w-3 h-3 sm:w-4 sm:h-4 rounded-full ring-1 ring-black/10 dark:ring-white/10"
            style={{ backgroundColor: colors.primary }}
          />
          <div 
            className="w-3 h-3 sm:w-4 sm:h-4 rounded-full ring-1 ring-black/10 dark:ring-white/10"
            style={{ backgroundColor: colors.secondary }}
          />
          <div 
            className="w-3 h-3 sm:w-4 sm:h-4 rounded-full ring-1 ring-black/10 dark:ring-white/10"
            style={{ backgroundColor: colors.accent }}
          />
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2">
          <Badge variant="secondary" className="text-xs px-1.5 sm:px-2">
            <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
            Custom
          </Badge>
          {theme.description?.includes('Imported from') && (
            <Badge variant="outline" className="text-xs px-1.5 sm:px-2">
              Imported
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
