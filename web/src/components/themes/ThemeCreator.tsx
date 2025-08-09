/*
 * Copyright (c) 2024-2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getThemeById } from '@/config/themes'

interface ThemeCreatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  baseThemeId: string
  initialColors?: {
    light: Record<string, string>
    dark: Record<string, string>
  }
}

export function ThemeCreator({ 
  open, 
  onOpenChange, 
  baseThemeId,
  initialColors 
}: ThemeCreatorProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const queryClient = useQueryClient()
  
  // Get the base theme to fill in any missing colors
  const baseTheme = getThemeById(baseThemeId) || getThemeById('minimal')
  
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) {
        throw new Error('Theme name is required')
      }
      
      // Helper to ensure fonts are present
      const ensureFonts = (cssVars: Record<string, string>) => {
        const result = { ...cssVars }
        const minimalFonts = {
          '--font-sans': "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
          '--font-serif': 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
          '--font-mono': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
        }
        
        // Add fonts only if missing
        if (!result['--font-sans']) result['--font-sans'] = minimalFonts['--font-sans']
        if (!result['--font-serif']) result['--font-serif'] = minimalFonts['--font-serif']
        if (!result['--font-mono']) result['--font-mono'] = minimalFonts['--font-mono']
        
        return result
      }
      
      // Merge initial colors with base theme colors to ensure completeness
      let lightColors = {
        ...baseTheme!.cssVars.light,
        ...(initialColors?.light || {})
      }
      
      let darkColors = {
        ...baseTheme!.cssVars.dark,
        ...(initialColors?.dark || {})
      }
      
      // Ensure fonts are present (uses provided fonts or falls back to minimal)
      lightColors = ensureFonts(lightColors)
      darkColors = ensureFonts(darkColors)
      
      return api.createCustomTheme({
        name: name.trim(),
        description: description.trim(),
        baseThemeId: baseTheme!.id,
        cssVarsLight: lightColors,
        cssVarsDark: darkColors,
      })
    },
    onSuccess: (theme) => {
      toast.success(`Theme "${theme.name}" created successfully!`)
      queryClient.invalidateQueries({ queryKey: ['custom-themes'] })
      onOpenChange(false)
      // Reset form
      setName('')
      setDescription('')
    },
    onError: (error: any) => {
      if (error?.message?.includes('already exists')) {
        toast.error('A theme with this name already exists')
      } else {
        toast.error(error?.message || 'Failed to create theme')
      }
    }
  })
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate()
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Create New Theme
          </DialogTitle>
          <DialogDescription>
            Save your current color customizations as a new theme that you can switch to anytime.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Theme Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Theme"
              required
              autoFocus
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of your theme..."
              rows={3}
            />
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p>• Based on: <strong>{baseTheme?.name || 'Minimal'}</strong> theme</p>
            <p>• Includes all your current color customizations</p>
            <p>• Can be edited or deleted later in Settings</p>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || !name.trim()}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Theme'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}