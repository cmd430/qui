/*
 * Copyright (c) 2024-2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useState, useCallback } from 'react'
import { COPY_FEEDBACK_DURATION } from '@/constants/timings'

export function useColorActions() {
  const [copiedValue, setCopiedValue] = useState<string | null>(null)
  
  const copyToClipboard = useCallback((value: string) => {
    navigator.clipboard.writeText(value)
    setCopiedValue(value)
    setTimeout(() => setCopiedValue(null), COPY_FEEDBACK_DURATION)
  }, [])
  
  return { copyToClipboard, copiedValue }
}