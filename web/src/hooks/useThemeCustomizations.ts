/*
 * Copyright (c) 2024-2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'

// Structure: theme_id -> mode (light/dark) -> color_var -> value
type ColorOverrides = Record<string, Record<string, Record<string, string>>>

export function useThemeCustomizations() {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['theme-customizations'],
    queryFn: api.getThemeCustomizations,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on 403 (no premium access)
      if (error?.message?.includes('403')) {
        return false
      }
      return failureCount < 2
    }
  })

  const updateMutation = useMutation({
    mutationFn: (colorOverrides: ColorOverrides) => 
      api.updateThemeCustomizations(colorOverrides),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['theme-customizations'] })
      toast.success('Theme colors saved')
    },
    onError: (error: any) => {
      if (error?.message?.includes('403') || error?.message?.includes('Premium')) {
        toast.error('Premium feature - valid license required')
      } else {
        toast.error('Failed to save theme colors')
      }
    }
  })

  const resetMutation = useMutation({
    mutationFn: api.resetThemeCustomizations,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['theme-customizations'] })
      toast.success('Theme colors reset to defaults')
    },
    onError: (error: any) => {
      if (error?.message?.includes('403') || error?.message?.includes('Premium')) {
        toast.error('Premium feature - valid license required')
      } else {
        toast.error('Failed to reset theme colors')
      }
    }
  })

  return {
    colorOverrides: data?.colorOverrides || {},
    isLoading,
    error,
    updateColors: updateMutation.mutate,
    resetColors: resetMutation.mutate,
    isUpdating: updateMutation.isPending,
    isResetting: resetMutation.isPending
  }
}