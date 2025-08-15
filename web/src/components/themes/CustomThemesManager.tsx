/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: MIT
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { refreshThemesList } from '@/config/themes'
import { setTheme } from '@/utils/theme'
import { useTheme } from '@/hooks/useTheme'
import { Sparkles, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useHasPremiumAccess } from '@/hooks/useThemeLicense'
import { ThemeCard } from './ThemeCard'
import { ExportDialog } from './dialogs/ExportDialog'
import { ImportDialog } from './dialogs/ImportDialog'
import { ThemeEditDialog } from './dialogs/ThemeEditDialog'
import type { CustomTheme } from '@/types'

export function CustomThemesManager() {
  const { hasPremiumAccess, isLoading: isLicenseLoading } = useHasPremiumAccess()
  const queryClient = useQueryClient()
  const { theme: currentTheme } = useTheme()
  const [deleteThemeId, setDeleteThemeId] = useState<number | null>(null)
  const [editTheme, setEditTheme] = useState<CustomTheme | null>(null)
  const [exportTheme, setExportTheme] = useState<CustomTheme | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  
  const { data: themes = [], isLoading } = useQuery({
    queryKey: ['custom-themes'],
    queryFn: () => api.getCustomThemes(),
    enabled: hasPremiumAccess,
  })
  
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteCustomTheme(id),
    onSuccess: async () => {
      toast.success('Theme deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['custom-themes'] })
      await refreshThemesList()
      // Trigger theme validation refresh
      queryClient.invalidateQueries({ queryKey: ['theme-licenses'] })
      setDeleteThemeId(null)
    },
    onError: () => {
      toast.error('Failed to delete theme')
    }
  })
  
  const duplicateMutation = useMutation({
    mutationFn: (id: number) => api.duplicateCustomTheme(id),
    onSuccess: async (newTheme) => {
      toast.success(`Created "${newTheme.name}"`)
      queryClient.invalidateQueries({ queryKey: ['custom-themes'] })
      await refreshThemesList()
      // Trigger theme validation refresh
      queryClient.invalidateQueries({ queryKey: ['theme-licenses'] })
    },
    onError: () => {
      toast.error('Failed to duplicate theme')
    }
  })
  
  const importMutation = useMutation({
    mutationFn: async (themeData: {
      name: string
      description: string
      baseThemeId: string
      cssVarsLight: Record<string, string>
      cssVarsDark: Record<string, string>
    }) => {
      return api.importCustomTheme(themeData)
    },
    onSuccess: async (theme) => {
      toast.success(`Imported "${theme.name}"`)
      queryClient.invalidateQueries({ queryKey: ['custom-themes'] })
      await refreshThemesList()
      // Trigger theme validation refresh
      queryClient.invalidateQueries({ queryKey: ['theme-licenses'] })
      setShowImportDialog(false)
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : ''
      if (message.includes('already exists')) {
        toast.error('A theme with this name already exists')
      } else {
        toast.error('Failed to import theme. Please check the format.')
      }
    }
  })
  
  if (!hasPremiumAccess && !isLicenseLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Custom Themes</CardTitle>
          </div>
          <CardDescription>
            Create and manage your own custom themes. This is a premium feature.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Purchase a license to unlock custom theme creation and management.
          </p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle>Custom Themes</CardTitle>
              </div>
              <CardDescription>
                Create and manage your own custom themes
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowImportDialog(true)}
              disabled={importMutation.isPending}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-32 bg-muted rounded"></div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {themes.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      No custom themes created yet
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Use the color customizer to create your first theme
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Premium
                    </Badge>
                    Custom Themes
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                    {themes.map((theme) => (
                      <ThemeCard
                        key={theme.id}
                        theme={theme}
                        isSelected={currentTheme === `custom-${theme.id}`}
                        onSelect={() => {
                          setTheme(`custom-${theme.id}`)
                          toast.success(`Applied theme: ${theme.name}`)
                        }}
                        onEdit={() => setEditTheme(theme)}
                        onDuplicate={() => duplicateMutation.mutate(theme.id)}
                        onExport={() => setExportTheme(theme)}
                        onDelete={() => setDeleteThemeId(theme.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      
      <AlertDialog open={!!deleteThemeId} onOpenChange={() => setDeleteThemeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Theme?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The theme will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteThemeId && deleteMutation.mutate(deleteThemeId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {editTheme && (
        <ThemeEditDialog
          theme={editTheme}
          open={!!editTheme}
          onOpenChange={(open) => !open && setEditTheme(null)}
        />
      )}
      
      <ExportDialog
        theme={exportTheme}
        open={!!exportTheme}
        onOpenChange={(open) => !open && setExportTheme(null)}
      />
      
      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={(themeData) => importMutation.mutate(themeData)}
      />
    </>
  )
}
