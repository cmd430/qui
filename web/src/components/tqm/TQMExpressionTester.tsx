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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTestTQMExpression } from "@/hooks/useTQM"
import { Check, X, Loader2, Play, Info } from "lucide-react"
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
  const [testLimit, setTestLimit] = useState(10)
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
        limit: testLimit,
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

  const getResultColor = (matched: boolean, hasError: boolean) => {
    if (hasError) return "text-destructive"
    return matched ? "text-green-600" : "text-muted-foreground"
  }

  const getResultIcon = (matched: boolean, hasError: boolean) => {
    if (hasError) return <X className="h-4 w-4" />
    return matched ? <Check className="h-4 w-4" /> : null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Test Expression</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 flex flex-col min-h-0">
          {/* Test Configuration */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="test-expression">Expression to Test</Label>
              <Textarea
                id="test-expression"
                value={testExpression}
                onChange={(e) => setTestExpression(e.target.value)}
                placeholder="Enter TQM expression to test"
                rows={3}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Label htmlFor="test-limit">Test Against (Max Torrents)</Label>
                <Input
                  id="test-limit"
                  type="number"
                  min="1"
                  max="100"
                  value={testLimit}
                  onChange={(e) => setTestLimit(parseInt(e.target.value) || 10)}
                />
              </div>
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

          {/* Test Results Summary */}
          {testResults && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Test Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold">{testResults.totalTested}</div>
                    <div className="text-sm text-muted-foreground">Torrents Tested</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {testResults.matchedCount}
                    </div>
                    <div className="text-sm text-muted-foreground">Matched</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-destructive">
                      {testResults.errorCount}
                    </div>
                    <div className="text-sm text-muted-foreground">Errors</div>
                  </div>
                </div>

                {testResults.totalTested > 0 && (
                  <div className="mt-4">
                    <div className="text-sm text-muted-foreground mb-2">
                      Match Rate: {Math.round((testResults.matchedCount / testResults.totalTested) * 100)}%
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(testResults.matchedCount / testResults.totalTested) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Detailed Results */}
          {testResults && testResults.results.length > 0 && (
            <Card className="flex-1 flex flex-col min-h-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Detailed Results</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 min-h-0">
                <ScrollArea className="h-full">
                  <div className="space-y-2">
                    {testResults.results.map((result) => (
                      <div
                        key={result.torrentHash}
                        className={`p-3 border rounded-lg ${
                          result.error? "border-destructive/50 bg-destructive/5": result.matched? "border-green-500/50 bg-green-500/5": "border-border"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <div
                                className={getResultColor(result.matched, !!result.error)}
                              >
                                {getResultIcon(result.matched, !!result.error)}
                              </div>
                              <div className="font-medium text-sm truncate">
                                {result.torrentName}
                              </div>
                              <Badge
                                variant={
                                  result.error? "destructive": result.matched? "default": "secondary"
                                }
                                className="text-xs"
                              >
                                {result.error? "Error": result.matched? "Match": "No Match"}
                              </Badge>
                            </div>

                            <div className="text-xs text-muted-foreground mb-1">
                              Hash: {result.torrentHash}
                            </div>

                            {result.error && (
                              <div className="text-xs text-destructive">
                                Error: {result.error}
                              </div>
                            )}

                            {result.evaluatedTo !== undefined && !result.error && (
                              <div className="text-xs text-muted-foreground">
                                Evaluated to:{" "}
                                <code className="bg-muted px-1 py-0.5 rounded">
                                  {JSON.stringify(result.evaluatedTo)}
                                </code>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
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