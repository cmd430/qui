/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useEffect } from "react"
import { useForm } from "@tanstack/react-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useUpdateTQMConfig } from "@/hooks/useTQM"
import { RetagButton } from "./RetagButton"
import { TQMStatusIndicator } from "./TQMStatusIndicator"
import type { TQMConfigResponse } from "@/types"
import { toast } from "sonner"

interface TQMConfigurationFormProps {
  instanceId: number
  config?: TQMConfigResponse
  onClose: () => void
}

export function TQMConfigurationForm({
  instanceId,
  config,
  onClose,
}: TQMConfigurationFormProps) {
  const { mutate: updateConfig, isPending } = useUpdateTQMConfig(instanceId)

  const form = useForm({
    defaultValues: {
      name: config?.config.name ?? "Default Configuration",
      enabled: config?.config.enabled ?? true,
    },
    onSubmit: async ({ value }) => {
      updateConfig(
        {
          name: value.name,
          enabled: value.enabled,
          filters: config?.tagRules ?? [],
        },
        {
          onSuccess: () => {
            toast.success("TQM configuration updated successfully")
          },
          onError: (error) => {
            toast.error(`Failed to update TQM configuration: ${error.message}`)
          },
        }
      )
    },
  })

  // Update form values when config changes (following CLAUDE.md best practices)
  useEffect(() => {
    if (config?.config) {
      form.setFieldValue("name", config.config.name ?? "Default Configuration")
      form.setFieldValue("enabled", config.config.enabled ?? true)
    }
  }, [config?.config.name, config?.config.enabled, form])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Configuration</CardTitle>
          <CardDescription>
            Configure basic TQM settings for this instance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              form.handleSubmit()
            }}
          >
            <div className="grid gap-4">
              <form.Field
                name="name"
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Configuration Name</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Enter configuration name"
                    />
                  </div>
                )}
              />

              <form.Field
                name="enabled"
                children={(field) => (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={field.name}
                      checked={field.state.value}
                      onCheckedChange={field.handleChange}
                    />
                    <Label htmlFor={field.name}>Enable TQM for this instance</Label>
                  </div>
                )}
              />

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : "Save Configuration"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status & Operations</CardTitle>
          <CardDescription>
            Current TQM status and available operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="text-sm font-medium">Current Status</div>
              <TQMStatusIndicator instanceId={instanceId} />
            </div>

            <div className="flex items-center space-x-2">
              <RetagButton
                instanceId={instanceId}
                variant="button"
                size="default"
                disabled={!config?.config.enabled}
              />
              <div className="text-sm text-muted-foreground">
                Retag Torrents
              </div>
            </div>
          </div>

          {config?.lastRun && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Last Operation</div>
              <div className="text-sm text-muted-foreground">
                <div>
                  Status: <span className="capitalize">{config.lastRun.status}</span>
                </div>
                <div>
                  Processed: {config.lastRun.torrentsProcessed} torrents, {config.lastRun.tagsApplied} tags applied
                </div>
                <div>
                  Started: {new Date(config.lastRun.startedAt).toLocaleString()}
                </div>
                {config.lastRun.completedAt && (
                  <div>
                    Completed: {new Date(config.lastRun.completedAt).toLocaleString()}
                  </div>
                )}
                {config.lastRun.errorMessage && (
                  <div className="text-destructive">
                    Error: {config.lastRun.errorMessage}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}