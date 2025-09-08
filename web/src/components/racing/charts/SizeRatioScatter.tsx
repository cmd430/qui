/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { RacingTorrent } from "@/types"
import { useMemo } from "react"
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from "recharts"

interface SizeRatioScatterProps {
  data: RacingTorrent[]
}

export function SizeRatioScatter({ data }: SizeRatioScatterProps) {
  const chartData = useMemo(() => {
    return data
      .filter(t => t.size && t.ratio !== undefined)
      .map(torrent => ({
        name: torrent.name,
        size: Number((torrent.size / 1073741824).toFixed(2)), // Convert to GB
        ratio: Number(torrent.ratio.toFixed(2)),
        completionTime: torrent.completionTime ? Math.round(torrent.completionTime / 60) : null, // Convert to minutes
        tracker: torrent.tracker,
      }))
      .filter(d => d.ratio <= 20) // Filter out extreme outliers for better visualization
      .slice(0, 200) // Limit to 200 points for performance
  }, [data])

  const formatSize = (value: number) => `${value} GB`
  const formatRatio = (value: number) => `${value}x`

  const chartConfig = {
    scatter: {
      label: "Torrents",
      color: "var(--chart-1)",
    },
  }

  // Color based on ratio performance
  const getColor = (ratio: number) => {
    if (ratio >= 5) return "var(--chart-2)" // Excellent performance
    if (ratio >= 2) return "var(--chart-1)" // Good performance
    if (ratio >= 1) return "var(--chart-4)" // Average performance
    return "var(--chart-3)" // Poor performance
  }

  // Size of dot based on completion time (faster = bigger)
  const getSize = (completionTime: number | null) => {
    if (!completionTime) return 5
    if (completionTime < 5) return 10 // Very fast (< 5 min)
    if (completionTime < 30) return 8 // Fast (< 30 min)
    if (completionTime < 120) return 6 // Medium (< 2 hours)
    return 4 // Slow (> 2 hours)
  }

  return (
    <ChartContainer config={chartConfig} className="h-[350px] w-full">
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="size"
          name="Size"
          unit=" GB"
          className="text-xs"
          tick={{ fill: "var(--muted-foreground)" }}
          tickFormatter={formatSize}
          domain={[0, "dataMax + 5"]}
          label={{ value: "Torrent Size (GB)", position: "insideBottom", offset: -5, style: { fill: "var(--muted-foreground)", fontSize: 11 } }}
        />
        <YAxis
          dataKey="ratio"
          name="Ratio"
          className="text-xs"
          tick={{ fill: "var(--muted-foreground)" }}
          tickFormatter={formatRatio}
          domain={[0, "dataMax + 1"]}
          label={{ value: "Upload Ratio", angle: -90, position: "insideLeft", style: { fill: "var(--muted-foreground)", fontSize: 11 } }}
        />
        <ZAxis dataKey="completionTime" range={[30, 300]} />
        <ChartTooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={
            <ChartTooltipContent
              formatter={(_value, _name, item) => {
                const payload = item.payload as any
                return (
                  <div className="space-y-1">
                    <div className="font-semibold text-xs truncate max-w-[200px]">
                      {payload.name}
                    </div>
                    <div className="text-xs space-y-0.5">
                      <div>Size: {payload.size} GB</div>
                      <div>Ratio: {payload.ratio}x</div>
                      {payload.completionTime && (
                        <div>Completion: {payload.completionTime < 60 ? `${payload.completionTime}m` : `${Math.floor(payload.completionTime / 60)}h ${payload.completionTime % 60}m`}</div>
                      )}
                      <div className="text-muted-foreground truncate max-w-[200px]">
                        {payload.tracker}
                      </div>
                    </div>
                  </div>
                )
              }}
            />
          }
        />
        <Scatter
          name="Torrents"
          data={chartData}
          fill="var(--chart-1)"
          shape={(props: any) => {
            const { cx, cy, payload } = props
            return (
              <circle
                cx={cx}
                cy={cy}
                r={getSize(payload.completionTime)}
                fill={getColor(payload.ratio)}
                fillOpacity={0.7}
                stroke={getColor(payload.ratio)}
                strokeWidth={1}
              />
            )
          }}
        />
      </ScatterChart>
    </ChartContainer>
  )
}