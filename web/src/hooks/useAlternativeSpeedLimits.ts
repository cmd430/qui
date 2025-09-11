/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

// Hook for toggling alternative speed limits
// The current state comes from ServerState.use_alt_speed_limits in the torrents data
export function useAlternativeSpeedLimits(instanceId: number | undefined) {
  const queryClient = useQueryClient()

  const toggleMutation = useMutation({
    mutationFn: () => {
      if (!instanceId) throw new Error("No instance ID")
      return api.toggleAlternativeSpeedLimits(instanceId)
    },
    onSuccess: () => {
      // Invalidate torrents-list queries to refresh ServerState data
      // This will update the use_alt_speed_limits field
      queryClient.invalidateQueries({
        queryKey: ["torrents-list", instanceId],
      })
    },
  })

  return {
    toggle: toggleMutation.mutate,
    isToggling: toggleMutation.isPending,
  }
}