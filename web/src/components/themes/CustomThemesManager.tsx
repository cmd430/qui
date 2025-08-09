/*
 * Copyright (c) 2024-2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { refreshThemesList } from '@/config/themes'
import { setTheme } from '@/utils/theme'
import { useTheme } from '@/hooks/useTheme'
import type { CustomTheme } from '@/types'
import { 
  Sparkles, 
  Download, 
  Upload, 
  Copy, 
  Trash2, 
  Edit2,
  MoreVertical,
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
  onImport: (themeData: any) => void
}

// Helper to format CSS for export
function formatCSSForExport(theme: CustomTheme): string {
  const lightVars = Object.entries(theme.cssVarsLight)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n')
  
  const darkVars = Object.entries(theme.cssVarsDark)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n')
  
  return `:root {\n${lightVars}\n}\n\n.dark {\n${darkVars}\n}`
}

function ExportDialog({ theme, open, onOpenChange }: ExportDialogProps) {
  const [copied, setCopied] = useState(false)
  const [exportCSS, setExportCSS] = useState('')
  
  useEffect(() => {
    if (theme && open) {
      // Format as CSS
      setExportCSS(formatCSSForExport(theme))
      setCopied(false)
    }
  }, [theme, open])
  
  const handleCopy = () => {
    navigator.clipboard.writeText(exportCSS)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export Theme</DialogTitle>
          <DialogDescription>
            Copy the CSS below to share this theme with other users or use it elsewhere.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <div className="overflow-auto h-96 rounded-md border bg-muted/30 p-4">
              <pre className="font-mono text-xs whitespace-pre-wrap break-all">
                {exportCSS}
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

// Get minimal theme fonts as defaults
const getMinimalFonts = () => ({
  '--font-sans': "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
  '--font-serif': 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  '--font-mono': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
})

// Helper to ensure theme has fonts
function ensureFonts(cssVars: Record<string, string>): Record<string, string> {
  const minimalFonts = getMinimalFonts()
  const result = { ...cssVars }
  
  // Add fonts only if missing
  if (!result['--font-sans']) result['--font-sans'] = minimalFonts['--font-sans']
  if (!result['--font-serif']) result['--font-serif'] = minimalFonts['--font-serif']
  if (!result['--font-mono']) result['--font-mono'] = minimalFonts['--font-mono']
  
  return result
}

// Helper to parse CSS format from ui.shadcn.com
function parseCSSFormat(cssText: string): { light: Record<string, string>, dark: Record<string, string> } | null {
  try {
    const lightVars: Record<string, string> = {}
    const darkVars: Record<string, string> = {}
    
    // Parse :root (light mode) variables
    const rootMatch = cssText.match(/:root\s*{([^}]+)}/s)
    if (rootMatch) {
      const vars = rootMatch[1].matchAll(/--([a-z-]+):\s*([^;]+);/g)
      for (const match of vars) {
        const key = `--${match[1]}`
        const value = match[2].trim()
        lightVars[key] = value
      }
    }
    
    // Parse .dark variables
    const darkMatch = cssText.match(/\.dark\s*{([^}]+)}/s)
    if (darkMatch) {
      const vars = darkMatch[1].matchAll(/--([a-z-]+):\s*([^;]+);/g)
      for (const match of vars) {
        const key = `--${match[1]}`
        const value = match[2].trim()
        darkVars[key] = value
      }
    }
    
    // Must have at least some variables
    if (Object.keys(lightVars).length === 0 && Object.keys(darkVars).length === 0) {
      return null
    }
    
    return { light: lightVars, dark: darkVars }
  } catch {
    return null
  }
}

function ImportDialog({ open, onOpenChange, onImport }: ImportDialogProps) {
  const [input, setInput] = useState('')
  const [themeName, setThemeName] = useState('')
  const [error, setError] = useState('')
  const [isValid, setIsValid] = useState(false)
  
  // Validate CSS input
  useEffect(() => {
    if (!input.trim()) {
      setIsValid(false)
      return
    }
    
    // Check if it's valid CSS format
    if (input.includes(':root') || input.includes('.dark')) {
      const parsed = parseCSSFormat(input)
      setIsValid(!!parsed)
    } else {
      setIsValid(false)
    }
  }, [input])
  
  const handleImport = () => {
    try {
      // Parse CSS format
      const parsed = parseCSSFormat(input)
      if (!parsed) {
        setError('Invalid CSS format. Please check your input.')
        return
      }
      
      // CSS format requires a theme name
      if (!themeName.trim()) {
        setError('Please enter a name for this theme.')
        return
      }
      
      const themeData = {
        name: themeName.trim(),
        description: 'Imported theme',
        baseThemeId: 'minimal',
        cssVarsLight: ensureFonts(parsed.light),
        cssVarsDark: ensureFonts(parsed.dark)
      }
      
      // Ensure we have at least the essential variables
      if (!themeData.cssVarsLight['--background'] || !themeData.cssVarsDark['--background']) {
        setError('Theme is missing essential color variables.')
        return
      }
      
      onImport(themeData)
      setInput('')
      setThemeName('')
      setError('')
      onOpenChange(false)
    } catch (e) {
      setError('Failed to parse CSS. Please check the format.')
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) {
        setInput('')
        setThemeName('')
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
          {/* Theme name input */}
          <div className="space-y-2">
            <Label htmlFor="theme-name">Theme Name</Label>
            <Input
              id="theme-name"
              value={themeName}
              onChange={(e) => setThemeName(e.target.value)}
              placeholder="Enter a name for this theme"
              required
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
  isSelected: boolean
  onSelect: () => void
  onEdit: () => void
  onDuplicate: () => void
  onExport: () => void
  onDelete: () => void
}

function CustomThemeCard({ theme, isSelected, onSelect, onEdit, onDuplicate, onExport, onDelete }: ThemeCardProps) {
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()} // Prevent card click when clicking menu
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                onDuplicate()
              }}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                onExport()
              }}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
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
    mutationFn: async (themeData: any) => {
      return api.importCustomTheme(themeData)
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
                    Custom
                  </Badge>
                  Custom Themes
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                  {themes.map((theme) => (
                    <CustomThemeCard
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
        onImport={(themeData) => importMutation.mutate(themeData)}
      />
    </Card>
  )
}