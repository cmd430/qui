/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: MIT
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Package, GripHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DraggableDialog, DraggableDialogHandle } from '@/components/ui/draggable-dialog'
import { getThemeById } from '@/config/themes'
import { DEFAULT_FONTS } from '@/constants/fonts'

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
        
        // Add fonts only if missing
        Object.entries(DEFAULT_FONTS).forEach(([key, value]) => {
          if (!result[key]) result[key] = value
        })
        
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
    <DraggableDialog open={open} onOpenChange={onOpenChange} className="sm:max-w-[425px]">
      <DraggableDialogHandle className="flex items-center justify-between p-6 pb-2 border-b">
        <div className="flex items-center gap-2">
          <GripHorizontal className="h-4 w-4 text-muted-foreground" />
          <Package className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Create New Theme</h2>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
          <X className="h-4 w-4" />
        </Button>
      </DraggableDialogHandle>
      
      <div className="p-6 pt-2">
        <p className="text-sm text-muted-foreground mb-4">
          Save your current color customizations as a new theme that you can switch to anytime.
        </p>
        
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
              data-1p-ignore
              autoComplete='off'
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
          
          <div className="flex items-center justify-end gap-2 pt-4">
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
          </div>
        </form>
      </div>
    </DraggableDialog>
  )
}
