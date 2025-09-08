/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Lock, ShoppingCart, Sparkles } from "lucide-react"

interface PremiumLockedOverlayProps {
  title?: string
  description?: string
  className?: string
}

export function PremiumLockedOverlay({
  title = "Premium Feature",
  description = "Unlock this feature with a premium license",
  className,
}: PremiumLockedOverlayProps) {
  return (
    <>
      {/* Blur overlay that covers the entire parent with bleeding edges */}
      <div className={cn(
        "absolute -inset-4 z-10 backdrop-blur-md bg-background/50",
        className
      )} />

      {/* Content overlay on top of the blur */}
      <div className="absolute inset-0 z-20 flex items-center justify-center">
        <div className="text-center space-y-6 p-8 max-w-md">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted">
            <Lock className="h-10 w-10 text-muted-foreground" />
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl font-bold flex items-center justify-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              {title}
            </h3>
            <p className="text-muted-foreground">{description}</p>
          </div>

          <div className="space-y-3">
            <Button size="lg" asChild>
              <a
                href="https://buy.polar.sh/polar_cl_yyXJesVM9pFVfAPIplspbfCukgVgXzXjXIc2N0I8WcL"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                Unlock Premium Features
              </a>
            </Button>

            <p className="text-sm text-muted-foreground">
              One-time purchase • $9.99 • Lifetime access
            </p>
          </div>
        </div>
      </div>
    </>
  )
}