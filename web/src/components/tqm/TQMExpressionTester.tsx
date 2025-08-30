/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTestTQMExpression } from "@/hooks/useTQM"
import { Check, X, Loader2, Play, Copy } from "lucide-react"
import type { TQMExpressionTestResponse } from "@/types"

interface TQMExpressionTesterProps {
  instanceId: number
  expression: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TQMExpressionTester({
  instanceId,
  expression,
  open,
  onOpenChange,
}: TQMExpressionTesterProps) {
  const [testExpression, setTestExpression] = useState("")
  const [testResults, setTestResults] = useState<TQMExpressionTestResponse | null>(null)

  const { mutate: testExpressionMutation, isPending: isTesting } = useTestTQMExpression(instanceId)

  // Set initial expression when dialog opens
  useEffect(() => {
    if (open && expression) {
      setTestExpression(expression)
    }
  }, [open, expression])

  const handleTest = () => {
    if (!testExpression.trim()) return

    testExpressionMutation(
      {
        expression: testExpression,
        // Backend will use default limit (10) for performance
      },
      {
        onSuccess: (result) => {
          setTestResults(result)
        },
        onError: () => {
          setTestResults({
            results: [],
            totalTested: 0,
            matchedCount: 0,
            errorCount: 1,
          })
        },
      }
    )
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Test Expression (Dry Run)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Test Configuration */}
          <div className="space-y-4">
            <div>
              <div className="space-y-2">
                <Label htmlFor="test-expression">Expression to Test</Label>
                <p className="text-sm text-muted-foreground">
                  Test your TQM expression against sample torrents from this instance. No tags will be applied.
                </p>
                <Textarea
                  id="test-expression"
                  value={testExpression}
                  onChange={(e) => setTestExpression(e.target.value)}
                  placeholder="Enter TQM expression to test (e.g., Seeds <= 3 && !IsUnregistered())"
                  rows={3}
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleTest}
                disabled={!testExpression.trim() || isTesting}
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {isTesting ? "Testing..." : "Test Expression"}
              </Button>
            </div>
          </div>


          {/* Detailed Results */}
          {testResults && testResults.results.filter(result => result.matched).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Matched Torrents ({testResults.results.filter(result => result.matched).length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {testResults.results.filter(result => result.matched).map((result) => (
                    <div
                      key={result.torrentHash}
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs px-2 py-0 h-5 bg-green-50 text-green-700 border-green-200">
                            ✓ Match
                          </Badge>
                        </div>

                        <div className="font-medium text-sm mb-1 break-words">
                          {result.torrentName}
                        </div>

                        <div className="text-xs text-muted-foreground font-mono mb-1">
                          {result.torrentHash.slice(0, 20)}...{result.torrentHash.slice(-12)}
                        </div>

                        {result.evaluatedTo !== undefined && (
                          <div className="text-xs text-muted-foreground">
                            Result: <code className="bg-muted px-1 py-0.5 rounded">{JSON.stringify(result.evaluatedTo)}</code>
                          </div>
                        )}
                      </div>

                      <div className="flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => navigator.clipboard.writeText(result.torrentHash)}
                          title="Copy full hash"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No Results State */}
          {testResults && testResults.results.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <div className="text-muted-foreground">
                  No torrents found to test against. Make sure the instance has torrents.
                </div>
              </CardContent>
            </Card>
          )}

          {/* No Matches State */}
          {testResults && testResults.results.length > 0 && testResults.results.filter(result => result.matched).length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <div className="text-muted-foreground mb-2">
                  <X className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  No torrents matched your expression
                </div>
                <p className="text-xs text-muted-foreground">
                  Try adjusting your expression or check that your instance has torrents that meet the criteria.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Dialog Actions */}
        <div className="flex justify-end pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}