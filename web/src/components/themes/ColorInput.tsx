/*
 * Copyright (c) 2024-2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, Check } from 'lucide-react'

interface ColorInputProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder: string
  onCopy: () => void
  copied: boolean
}

export const ColorInput = memo(function ColorInput({ 
  value, 
  onChange, 
  placeholder, 
  onCopy, 
  copied 
}: ColorInputProps) {
  return (
    <div className="flex items-center gap-2">
      <Input
        className="text-xs flex-1 font-mono h-8"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      <Button 
        size="sm" 
        variant="ghost" 
        className="h-7 w-7 p-0" 
        onClick={onCopy}
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </Button>
    </div>
  )
})