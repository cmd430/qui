/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: MIT
 */

import { memo } from 'react'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'

interface ColorSliderProps {
  label: string
  value: number
  onChange: (values: number[]) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  precision?: number
}

export const ColorSlider = memo(function ColorSlider({ 
  label, 
  value, 
  onChange, 
  min = 0, 
  max = 1, 
  step = 0.01, 
  suffix = '',
  precision = 2
}: ColorSliderProps) {
  const displayValue = value.toFixed(precision)
      
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs text-muted-foreground">
          {displayValue}{suffix}
        </span>
      </div>
      <Slider 
        value={[value]} 
        onValueChange={onChange} 
        min={min} 
        max={max} 
        step={step}
      />
    </div>
  )
})
