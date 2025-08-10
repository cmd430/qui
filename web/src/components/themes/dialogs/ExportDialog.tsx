/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: MIT
 */

import { useState, useEffect } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { CustomTheme } from '@/types'
import { formatCSSForExport } from '@/utils/cssParser'
import { COPY_FEEDBACK_DURATION } from '@/constants/timings'

interface ExportDialogProps {
  theme: CustomTheme | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExportDialog({ theme, open, onOpenChange }: ExportDialogProps) {
  const [copied, setCopied] = useState(false)
  const [exportCSS, setExportCSS] = useState('')
  
  useEffect(() => {
    if (theme && open) {
      setExportCSS(formatCSSForExport(theme))
      setCopied(false)
    }
  }, [theme, open])
  
  const handleCopy = () => {
    navigator.clipboard.writeText(exportCSS)
    setCopied(true)
    setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION)
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
