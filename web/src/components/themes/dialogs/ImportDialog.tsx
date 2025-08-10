/*
 * Copyright (c) 2024-2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { parseCSSFormat, ensureFonts } from '@/utils/cssParser'

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (themeData: {
    name: string
    description: string
    baseThemeId: string
    cssVarsLight: Record<string, string>
    cssVarsDark: Record<string, string>
  }) => void
}

export function ImportDialog({ open, onOpenChange, onImport }: ImportDialogProps) {
  const [input, setInput] = useState('')
  const [themeName, setThemeName] = useState('')
  const [themeDescription, setThemeDescription] = useState('')
  const [error, setError] = useState('')
  const [isValid, setIsValid] = useState(false)
  
  useEffect(() => {
    if (!input.trim()) {
      setIsValid(false)
      return
    }
    
    if (input.includes(':root') || input.includes('.dark')) {
      const parsed = parseCSSFormat(input)
      setIsValid(!!parsed)
    } else {
      setIsValid(false)
    }
  }, [input])
  
  const handleImport = () => {
    try {
      const parsed = parseCSSFormat(input)
      if (!parsed) {
        setError('Invalid CSS format. Please check your input.')
        return
      }
      
      if (!themeName.trim()) {
        setError('Please enter a name for this theme.')
        return
      }
      
      const themeData = {
        name: themeName.trim(),
        description: themeDescription.trim() || 'Imported theme',
        baseThemeId: 'minimal',
        cssVarsLight: ensureFonts(parsed.light),
        cssVarsDark: ensureFonts(parsed.dark)
      }
      
      if (!themeData.cssVarsLight['--background'] || !themeData.cssVarsDark['--background']) {
        setError('Theme is missing essential color variables.')
        return
      }
      
      onImport(themeData)
      setInput('')
      setThemeName('')
      setError('')
      onOpenChange(false)
    } catch {
      setError('Failed to parse CSS. Please check the format.')
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) {
        setInput('')
        setThemeName('')
        setThemeDescription('')
        setError('')
      }
      onOpenChange(open)
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Theme</DialogTitle>
          <DialogDescription>
            Paste CSS theme data from another user or from ui.shadcn.com / tweakcn.com
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme-name">Theme Name *</Label>
            <Input
              id="theme-name"
              value={themeName}
              onChange={(e) => setThemeName(e.target.value)}
              placeholder="Enter a name for this theme"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="theme-description">Description (optional)</Label>
            <Textarea
              id="theme-description"
              value={themeDescription}
              onChange={(e) => setThemeDescription(e.target.value)}
              placeholder="A brief description of your theme..."
              rows={2}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="theme-data">CSS Theme Data</Label>
            <div className="relative">
              <Textarea
                id="theme-data"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  setError('')
                }}
                placeholder={`:root {\n  --background: oklch(1 0 0);\n  --foreground: oklch(0.1450 0 0);\n  ...\n}\n\n.dark {\n  --background: oklch(0.1450 0 0);\n  --foreground: oklch(0.9850 0 0);\n  ...\n}`}
                className={cn(
                  "font-mono text-xs h-80",
                  isValid && "text-blue-600 dark:text-blue-400"
                )}
              />
              {isValid && (
                <Badge variant="outline" className="absolute top-2 right-2 text-xs">
                  <Check className="h-3 w-3 mr-1" />
                  Valid CSS
                </Badge>
              )}
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!input.trim() || !isValid || !themeName.trim()}
          >
            Import Theme
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}