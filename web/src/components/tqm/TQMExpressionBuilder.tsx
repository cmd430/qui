/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { COMMON_TQM_EXPRESSIONS } from "@/types"

interface TQMExpressionBuilderProps {
  instanceId: number
  value: string
  onChange: (expression: string) => void
}

export function TQMExpressionBuilder({
  value,
  onChange,
}: TQMExpressionBuilderProps) {
  // Common torrent fields available in expressions
  const torrentFields = [
    { name: "Seeds", description: "Number of seeders", example: "Seeds <= 3" },
    { name: "Leechers", description: "Number of leechers", example: "Leechers > 0" },
    { name: "Ratio", description: "Upload/download ratio", example: "Ratio >= 2.0" },
    { name: "Size", description: "Torrent size in bytes", example: "Size > 1024*1024*1024" },
    { name: "State", description: "Torrent state", example: "State == \"seeding\"" },
    { name: "SeedingDays", description: "Days spent seeding", example: "SeedingDays >= 7" },
    { name: "AddedDays", description: "Days since added", example: "AddedDays > 30" },
    { name: "TrackerName", description: "Tracker domain", example: "TrackerName == \"example.com\"" },
    { name: "Tags", description: "Torrent tags array", example: "\"public\" in Tags" },
    { name: "Name", description: "Torrent name", example: "Name contains \"movie\"" },
    { name: "Label", description: "Torrent label/category", example: "Label == \"sonarr-imported\"" },
    { name: "Downloaded", description: "Whether torrent is completed", example: "Downloaded == false" },
    { name: "IsPrivate", description: "Private torrent flag", example: "IsPrivate == true" },
    { name: "FreeSpaceSet", description: "Whether free space data is available", example: "FreeSpaceSet == true" },
  ]

  // Helper functions available in expressions
  const helperFunctions = [
    {
      name: "IsUnregistered()",
      description: "Check if torrent is unregistered with tracker",
      example: "IsUnregistered()",
    },
    {
      name: "IsTrackerDown()",
      description: "Check if tracker is down or unreachable",
      example: "IsTrackerDown()",
    },
    {
      name: "HasAllTags(...tags)",
      description: "Check if torrent has all specified tags",
      example: "HasAllTags(\"public\", \"movie\")",
    },
    {
      name: "HasAnyTag(...tags)",
      description: "Check if torrent has any of the specified tags",
      example: "HasAnyTag(\"remove-me\", \"gross\")",
    },
    {
      name: "HasMissingFiles()",
      description: "Check if any torrent files are missing from disk",
      example: "HasMissingFiles()",
    },
    {
      name: "RegexMatch(pattern)",
      description: "Match torrent name against regex pattern",
      example: "RegexMatch(\"(?i)\\\\b720p\\\\b\")",
    },
    {
      name: "RegexMatchAny(patterns)",
      description: "Match any of comma-separated regex patterns",
      example: "RegexMatchAny(\"(?i)\\\\b720p\\\\b, (?i)\\\\b1080p\\\\b\")",
    },
    {
      name: "RegexMatchAll(patterns)",
      description: "Match all of comma-separated regex patterns",
      example: "RegexMatchAll(\"pattern1, pattern2\")",
    },
    {
      name: "FreeSpaceGB()",
      description: "Get available free space in gigabytes",
      example: "FreeSpaceGB() < 100",
    },
  ]

  // Operators and logical connectors
  const operators = [
    { symbol: "==", description: "Equal to" },
    { symbol: "!=", description: "Not equal to" },
    { symbol: ">", description: "Greater than" },
    { symbol: ">=", description: "Greater than or equal" },
    { symbol: "<", description: "Less than" },
    { symbol: "<=", description: "Less than or equal" },
    { symbol: "&&", description: "Logical AND" },
    { symbol: "||", description: "Logical OR" },
    { symbol: "!", description: "Logical NOT" },
    { symbol: "in", description: "Contains in array" },
    { symbol: "contains", description: "String contains" },
  ]

  const insertExpression = (expression: string) => {
    const newExpression = value ? `${value} ${expression}` : expression
    onChange(newExpression)
  }

  const insertCommonExpression = (key: keyof typeof COMMON_TQM_EXPRESSIONS) => {
    insertExpression(COMMON_TQM_EXPRESSIONS[key])
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Expression Builder</CardTitle>
          <CardDescription>
            Build complex expressions using torrent fields, operators, and helper functions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Common Expressions */}
          <div>
            <h4 className="text-sm font-medium mb-2">Common Expressions</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(COMMON_TQM_EXPRESSIONS).map(([key, expression]) => (
                <Badge
                  key={key}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10"
                  onClick={() => insertCommonExpression(key as keyof typeof COMMON_TQM_EXPRESSIONS)}
                >
                  {expression}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Torrent Fields */}
          <div>
            <h4 className="text-sm font-medium mb-2">Torrent Fields</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {torrentFields.map((field) => (
                <div
                  key={field.name}
                  className="p-2 border rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => insertExpression(field.name)}
                >
                  <div className="font-medium text-sm">{field.name}</div>
                  <div className="text-xs text-muted-foreground mb-1">
                    {field.description}
                  </div>
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                    {field.example}
                  </code>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Helper Functions */}
          <div>
            <h4 className="text-sm font-medium mb-2">Helper Functions</h4>
            <div className="grid grid-cols-1 gap-2">
              {helperFunctions.map((func) => (
                <div
                  key={func.name}
                  className="p-2 border rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => insertExpression(func.name)}
                >
                  <div className="font-medium text-sm font-mono">{func.name}</div>
                  <div className="text-xs text-muted-foreground mb-1">
                    {func.description}
                  </div>
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                    {func.example}
                  </code>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Operators */}
          <div>
            <h4 className="text-sm font-medium mb-2">Operators</h4>
            <div className="flex flex-wrap gap-2">
              {operators.map((op) => (
                <Badge
                  key={op.symbol}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10"
                  onClick={() => insertExpression(op.symbol)}
                  title={op.description}
                >
                  {op.symbol}
                </Badge>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex justify-end space-x-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange("")}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Example Expressions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Example Expressions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-xs space-y-1">
            <div>
              <code className="bg-muted px-2 py-1 rounded text-xs block">
                {"IsUnregistered()"}
              </code>
              <span className="text-muted-foreground">
                Remove torrents no longer registered on their tracker
              </span>
            </div>
            <div>
              <code className="bg-muted px-2 py-1 rounded text-xs block">
                {"Label == \"sonarr-imported\" && (Ratio >= 3.0 || SeedingDays >= 14)"}
              </code>
              <span className="text-muted-foreground">
                Remove Sonarr imports after reaching seeding goals
              </span>
            </div>
            <div>
              <code className="bg-muted px-2 py-1 rounded text-xs block">
                {"Seeds <= 5 && IsPrivate == true"}
              </code>
              <span className="text-muted-foreground">
                Tag private torrents with few seeders for priority seeding
              </span>
            </div>
            <div>
              <code className="bg-muted px-2 py-1 rounded text-xs block">
                {"Downloaded == false && AddedDays > 7"}
              </code>
              <span className="text-muted-foreground">
                Pause incomplete torrents stuck downloading for over a week
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}