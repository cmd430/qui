/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { TQMConfigRequest, TQMRetagRequest } from "@/types"

/**
 * Hook to get TQM configuration for an instance
 */
export function useTQMConfig(instanceId: number) {
  return useQuery({
    queryKey: ["tqm-config", instanceId],
    queryFn: () => api.getTQMConfig(instanceId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Hook to get TQM status for an instance
 */
export function useTQMStatus(instanceId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["tqm-status", instanceId],
    queryFn: () => api.getTQMStatus(instanceId),
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000, // 10 seconds
    enabled: options?.enabled ?? true,
  })
}

/**
 * Hook to update TQM configuration
 */
export function useUpdateTQMConfig(instanceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (config: TQMConfigRequest) => api.updateTQMConfig(instanceId, config),
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["tqm-config", instanceId] })
      queryClient.invalidateQueries({ queryKey: ["tqm-status", instanceId] })
    },
  })
}

/**
 * Hook to trigger TQM retag operation
 */
export function useRetag(instanceId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request?: TQMRetagRequest) => api.retag(instanceId, request),
    onSuccess: () => {
      // Invalidate TQM status to show updated operation status
      queryClient.invalidateQueries({ queryKey: ["tqm-status", instanceId] })

      // Also invalidate torrent lists to show updated tags
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ["torrents-list", instanceId],
          exact: false,
        })
      }, 1000) // Wait 1 second for TQM to process
    },
  })
}

/**
 * Hook to check if TQM is enabled for an instance
 */
export function useTQMEnabled(instanceId: number) {
  const { data: status } = useTQMStatus(instanceId)
  return status?.enabled ?? false
}

/**
 * Hook to get the last TQM operation status
 */
export function useLastTQMOperation(instanceId: number) {
  const { data: status } = useTQMStatus(instanceId)
  return status?.lastRun
}