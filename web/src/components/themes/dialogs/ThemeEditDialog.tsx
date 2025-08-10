/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: MIT
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { refreshThemesList } from '@/config/themes'
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
import type { CustomTheme } from '@/types'

interface ThemeEditDialogProps {
  theme: CustomTheme
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ThemeEditDialog({ theme, open, onOpenChange }: ThemeEditDialogProps) {
  const [name, setName] = useState(theme.name)
  const [description, setDescription] = useState(theme.description || '')
  const queryClient = useQueryClient()
  
  const updateMutation = useMutation({
    mutationFn: () => api.updateCustomTheme(theme.id, {
      name,
      description,
      cssVarsLight: theme.cssVarsLight,
      cssVarsDark: theme.cssVarsDark,
    }),
    onSuccess: () => {
      toast.success('Theme updated successfully')
      queryClient.invalidateQueries({ queryKey: ['custom-themes'] })
      refreshThemesList()
      onOpenChange(false)
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to update theme'
      toast.error(message)
    }
  })
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Theme</DialogTitle>
          <DialogDescription>
            Update the name and description of your custom theme.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Theme name"
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
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || !name.trim()}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
