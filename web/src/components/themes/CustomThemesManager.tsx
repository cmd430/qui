/*
 * Copyright (c) 2024-2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { refreshThemesList } from '@/config/themes'
import type { CustomTheme } from '@/types'
import { 
  Sparkles, 
  Download, 
  Upload, 
  Copy, 
  Trash2, 
  Edit2,
  MoreVertical,
  FileJson,
  Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { useHasPremiumAccess } from '@/hooks/useThemeLicense'
import { cn } from '@/lib/utils'

interface ThemeEditorProps {
  theme: CustomTheme
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ExportDialogProps {
  theme: CustomTheme | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (json: string) => void
}

// Helper to add syntax highlighting to JSON
function highlightJson(json: string): React.ReactNode {
  // Simple regex-based JSON syntax highlighting
  const highlighted = json
    .replace(/("[\w-]+")(:)/g, '<span class="text-blue-600 dark:text-blue-400">$1</span>$2')  // Keys
    .replace(/(:\s*"[^"]*")/g, '<span class="text-green-600 dark:text-green-400">$1</span>')  // String values
    .replace(/(:\s*)(\d+)/g, '$1<span class="text-orange-600 dark:text-orange-400">$2</span>')  // Numbers
    .replace(/(:\s*)(true|false|null)/g, '$1<span class="text-purple-600 dark:text-purple-400">$2</span>')  // Booleans/null
  
  return <div dangerouslySetInnerHTML={{ __html: highlighted }} />
}

function ExportDialog({ theme, open, onOpenChange }: ExportDialogProps) {
  const [copied, setCopied] = useState(false)
  const [exportJson, setExportJson] = useState('')
  
  useEffect(() => {
    if (theme && open) {
      // Prepare the export data
      const exportData = {
        name: theme.name,
        description: theme.description,
        baseThemeId: theme.baseThemeId,
        cssVarsLight: theme.cssVarsLight,
        cssVarsDark: theme.cssVarsDark,
      }
      setExportJson(JSON.stringify(exportData, null, 2))
      setCopied(false)
    }
  }, [theme, open])
  
  const handleCopy = () => {
    navigator.clipboard.writeText(exportJson)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export Theme</DialogTitle>
          <DialogDescription>
            Copy the JSON below to share this theme with others.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <div className="overflow-auto h-96 rounded-md border bg-muted/30 p-4">
              <pre className="font-mono text-xs whitespace-pre-wrap break-all">
                {highlightJson(exportJson)}
              </pre>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-2 right-2"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ImportDialog({ open, onOpenChange, onImport }: ImportDialogProps) {
  const [jsonInput, setJsonInput] = useState('')
  const [error, setError] = useState('')
  const [isValidJson, setIsValidJson] = useState(false)
  
  // Validate JSON as user types
  useEffect(() => {
    if (!jsonInput.trim()) {
      setIsValidJson(false)
      return
    }
    try {
      JSON.parse(jsonInput)
      setIsValidJson(true)
    } catch {
      setIsValidJson(false)
    }
  }, [jsonInput])
  
  const handleImport = () => {
    try {
      // Validate JSON
      const parsed = JSON.parse(jsonInput)
      
      // Check if it's a shadcn/tweakcn format
      if (parsed.$schema?.includes('shadcn') || parsed.type === 'registry:style' || (parsed.cssVars && !parsed.cssVarsLight)) {
        // Convert shadcn format to our format
        const converted = {
          name: parsed.name,
          description: parsed.description || 'Imported from tweakcn.com',
          baseThemeId: 'minimal', // Default to minimal as base
          cssVarsLight: {} as Record<string, string>,
          cssVarsDark: {} as Record<string, string>
        }
        
        // Process light theme
        if (parsed.cssVars?.light) {
          Object.entries(parsed.cssVars.light).forEach(([key, value]) => {
            // Skip non-color properties that might be in the format
            if (typeof value === 'string') {
              converted.cssVarsLight[`--${key}`] = value
            }
          })
        }
        
        // Process dark theme
        if (parsed.cssVars?.dark) {
          Object.entries(parsed.cssVars.dark).forEach(([key, value]) => {
            // Skip non-color properties that might be in the format
            if (typeof value === 'string') {
              converted.cssVarsDark[`--${key}`] = value
            }
          })
        }
        
        // Also include theme-level vars in both light and dark
        if (parsed.cssVars?.theme) {
          Object.entries(parsed.cssVars.theme).forEach(([key, value]) => {
            if (typeof value === 'string') {
              converted.cssVarsLight[`--${key}`] = value
              converted.cssVarsDark[`--${key}`] = value
            }
          })
        }
        
        // Ensure we have at least the essential variables
        if (!converted.cssVarsLight['--background'] || !converted.cssVarsDark['--background']) {
          setError('Theme is missing essential color variables.')
          return
        }
        
        onImport(JSON.stringify(converted))
      } else if (parsed.name && parsed.cssVarsLight && parsed.cssVarsDark) {
        // It's already in our format
        onImport(jsonInput)
      } else {
        setError('Invalid theme format. Missing required fields.')
        return
      }
      
      setJsonInput('')
      setError('')
      onOpenChange(false)
    } catch (e) {
      setError('Invalid JSON format. Please check your input.')
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) {
        setJsonInput('')
        setError('')
      }
      onOpenChange(open)
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Theme</DialogTitle>
          <DialogDescription>
            Paste theme JSON below. Supports both our format and shadcn/ui themes from tweakcn.com.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <Textarea
                value={jsonInput}
                onChange={(e) => {
                  setJsonInput(e.target.value)
                  setError('')
                }}
                placeholder='Paste theme JSON here (supports tweakcn.com exports)'
                className={cn(
                  "font-mono text-xs h-96",
                  isValidJson && "text-green-600 dark:text-green-400"
                )}
              />
              {isValidJson && (
                <Badge variant="outline" className="absolute top-2 right-2 text-xs">
                  <Check className="h-3 w-3 mr-1" />
                  Valid JSON
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
            disabled={!jsonInput.trim()}
          >
            Import Theme
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ThemeEditor({ theme, open, onOpenChange }: ThemeEditorProps) {
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
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to update theme')
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

interface ThemeCardProps {
  theme: CustomTheme
  onEdit: () => void
  onDuplicate: () => void
  onExport: () => void
  onDelete: () => void
}

function CustomThemeCard({ theme, onEdit, onDuplicate, onExport, onDelete }: ThemeCardProps) {
  // Helper to extract color preview from theme
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
    <Card className="h-full hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-2 sm:pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm sm:text-base">
            {theme.name}
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {theme.description && (
          <CardDescription className="text-xs mt-1">
            {theme.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="pb-3 sm:pb-4">
        {/* Color preview circles */}
        <div className="flex gap-2 mb-3">
          <div 
            className="h-8 w-8 rounded-full ring-1 ring-black/10 dark:ring-white/10"
            style={{ backgroundColor: colors.primary }}
          />
          <div 
            className="h-8 w-8 rounded-full ring-1 ring-black/10 dark:ring-white/10"
            style={{ backgroundColor: colors.secondary }}
          />
          <div 
            className="h-8 w-8 rounded-full ring-1 ring-black/10 dark:ring-white/10"
            style={{ backgroundColor: colors.accent }}
          />
        </div>
        
        {/* Badges */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Badge variant="secondary" className="text-xs px-1.5 sm:px-2">
            <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
            Custom
          </Badge>
          {theme.description?.includes('Imported from') ? (
            <Badge variant="outline" className="text-xs px-1.5 sm:px-2">
              Imported
            </Badge>
          ) : theme.baseThemeId ? (
            <Badge variant="outline" className="text-xs px-1.5 sm:px-2">
              Based on {theme.baseThemeId}
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export function CustomThemesManager() {
  const { hasPremiumAccess, isLoading: isLicenseLoading } = useHasPremiumAccess()
  const queryClient = useQueryClient()
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
    onSuccess: () => {
      toast.success('Theme deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['custom-themes'] })
      refreshThemesList()
      setDeleteThemeId(null)
    },
    onError: () => {
      toast.error('Failed to delete theme')
    }
  })
  
  const duplicateMutation = useMutation({
    mutationFn: (id: number) => api.duplicateCustomTheme(id),
    onSuccess: (newTheme) => {
      toast.success(`Created "${newTheme.name}"`)
      queryClient.invalidateQueries({ queryKey: ['custom-themes'] })
      refreshThemesList()
    },
    onError: () => {
      toast.error('Failed to duplicate theme')
    }
  })
  
  const importMutation = useMutation({
    mutationFn: async (jsonString: string) => {
      const theme = JSON.parse(jsonString)
      return api.importCustomTheme(theme)
    },
    onSuccess: (theme) => {
      toast.success(`Imported "${theme.name}"`)
      queryClient.invalidateQueries({ queryKey: ['custom-themes'] })
      refreshThemesList()
      setShowImportDialog(false)
    },
    onError: (error: any) => {
      if (error?.message?.includes('already exists')) {
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
                <FileJson className="h-12 w-12 mx-auto text-muted-foreground/50" />
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
                    Custom
                  </Badge>
                  Custom Themes
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                  {themes.map((theme) => (
                    <CustomThemeCard
                      key={theme.id}
                      theme={theme}
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
        <ThemeEditor
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
        onImport={(json) => importMutation.mutate(json)}
      />
    </Card>
  )
}