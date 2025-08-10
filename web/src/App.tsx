/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: MIT
 */

import { RouterProvider } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from './router'
import { ThemeProvider } from '@/components/themes/ThemeProvider'
import { ThemeCustomizationProvider } from '@/components/themes/ThemeCustomizationProvider'
import { Toaster } from '@/components/ui/sonner'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import { IOSInstallPrompt } from '@/components/pwa/IOSInstallPrompt'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 1000,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ThemeCustomizationProvider>
          <RouterProvider router={router} />
          <Toaster />
          <InstallPrompt />
          <IOSInstallPrompt />
        </ThemeCustomizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
