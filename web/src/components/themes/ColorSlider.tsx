/*
 * Copyright (c) 2024-2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

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
}

export function ColorSlider({ 
  label, 
  value, 
  onChange, 
  min = 0, 
  max = 1, 
  step = 0.01, 
  suffix = '' 
}: ColorSliderProps) {
  let displayValue: string
  if (label === 'Hue') {
    displayValue = value.toFixed(0)
  } else if (label === 'Lightness') {
    displayValue = value.toFixed(2)
  } else {
    displayValue = value.toFixed(3)
  }
      
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
}