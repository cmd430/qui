/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useState, useEffect } from "react"
import { useForm } from "@tanstack/react-form"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { TQMExpressionBuilder } from "./TQMExpressionBuilder"
import {
  useCreateTQMFilter,
  useUpdateTQMFilter,
  useTQMFilterTemplates,
  useValidateTQMExpression
} from "@/hooks/useTQM"
import type { TQMTagRule, TQMFilterTemplate } from "@/types"
import { TQM_TAG_MODES, TQM_FILTER_CATEGORIES } from "@/types"
import { toast } from "sonner"
import { Check, X, Loader2, Wand2 } from "lucide-react"

interface TQMFilterDialogProps {
  instanceId: number
  filter?: TQMTagRule
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TQMFilterDialog({
  instanceId,
  filter,
  open,
  onOpenChange,
}: TQMFilterDialogProps) {
  const [showExpressionBuilder, setShowExpressionBuilder] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<TQMFilterTemplate | null>(null)
  const [expressionValidation, setExpressionValidation] = useState<{
    valid: boolean
    error?: string
    fields?: string[]
  } | null>(null)

  const isEditing = !!filter?.id
  const { data: templates } = useTQMFilterTemplates(instanceId)
  const { mutate: createFilter, isPending: isCreating } = useCreateTQMFilter(instanceId)
  const { mutate: updateFilter, isPending: isUpdating } = useUpdateTQMFilter(instanceId)
  const { mutate: validateExpression, isPending: isValidating } = useValidateTQMExpression(instanceId)

  const form = useForm({
    defaultValues: {
      name: filter?.name ?? "",
      mode: (filter?.mode as keyof typeof TQM_TAG_MODES) ?? "full" as const,
      expression: filter?.expression ?? "",
      uploadKb: filter?.uploadKb ?? undefined,
      enabled: filter?.enabled ?? true,
    },
    onSubmit: async ({ value }) => {
      const filterData = {
        name: value.name,
        mode: value.mode,
        expression: value.expression,
        uploadKb: value.uploadKb || undefined,
        enabled: value.enabled,
      }

      if (isEditing && filter.id) {
        updateFilter(
          { filterId: filter.id, filter: filterData },
          {
            onSuccess: () => {
              toast.success(`Filter "${value.name}" updated successfully`)
              onOpenChange(false)
            },
            onError: (error) => {
              toast.error(`Failed to update filter: ${error.message}`)
            },
          }
        )
      } else {
        createFilter(filterData, {
          onSuccess: () => {
            toast.success(`Filter "${value.name}" created successfully`)
            onOpenChange(false)
          },
          onError: (error) => {
            toast.error(`Failed to create filter: ${error.message}`)
          },
        })
      }
    },
  })

  // Reset form when dialog opens/closes or filter changes
  useEffect(() => {
    if (open) {
      form.setFieldValue("name", filter?.name ?? "")
      form.setFieldValue("mode", (filter?.mode as keyof typeof TQM_TAG_MODES) ?? "full")
      form.setFieldValue("expression", filter?.expression ?? "")
      form.setFieldValue("uploadKb", filter?.uploadKb ?? undefined)
      form.setFieldValue("enabled", filter?.enabled ?? true)
      setSelectedTemplate(null)
      setExpressionValidation(null)
    }
  }, [open, filter, form])

  // Validate expression when it changes
  const handleExpressionChange = (expression: string) => {
    form.setFieldValue("expression", expression)

    if (expression.trim()) {
      validateExpression(
        { expression },
        {
          onSuccess: (result) => {
            setExpressionValidation(result)
          },
          onError: () => {
            setExpressionValidation({
              valid: false,
              error: "Failed to validate expression",
            })
          },
        }
      )
    } else {
      setExpressionValidation(null)
    }
  }

  const handleTemplateSelect = (template: TQMFilterTemplate) => {
    setSelectedTemplate(template)
    form.setFieldValue("name", template.name)
    form.setFieldValue("mode", template.mode)
    form.setFieldValue("expression", template.expression)
    form.setFieldValue("uploadKb", template.uploadKb)
    handleExpressionChange(template.expression)
  }

  const groupTemplatesByCategory = (templates: TQMFilterTemplate[]) => {
    const grouped: Record<string, TQMFilterTemplate[]> = {}
    templates.forEach((template) => {
      if (!grouped[template.category]) {
        grouped[template.category] = []
      }
      grouped[template.category].push(template)
    })
    return grouped
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Filter" : "Create New Filter"}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-6"
        >
          {/* Template Selection */}
          {!isEditing && templates && templates.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Filter Templates</CardTitle>
                <CardDescription>
                  Start with a predefined template or create from scratch
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(groupTemplatesByCategory(templates)).map(([category, categoryTemplates]) => (
                    <div key={category}>
                      <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                        {TQM_FILTER_CATEGORIES[category as keyof typeof TQM_FILTER_CATEGORIES] ?? category}
                      </h4>
                      <div className="grid grid-cols-1 gap-2">
                        {categoryTemplates.map((template) => (
                          <div
                            key={template.id}
                            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                              selectedTemplate?.id === template.id? "border-primary bg-primary/5": "border-border hover:border-primary/50"
                            }`}
                            onClick={() => handleTemplateSelect(template)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <div className="font-medium text-sm">{template.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {template.description}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Badge variant="outline" className="text-xs">
                                  {TQM_TAG_MODES[template.mode]}
                                </Badge>
                                {selectedTemplate?.id === template.id && (
                                  <Check className="h-4 w-4 text-primary" />
                                )}
                              </div>
                            </div>
                            <code className="text-xs bg-muted px-2 py-1 rounded mt-2 block">
                              {template.expression}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Basic Filter Configuration */}
          <div className="space-y-4">
            <form.Field
              name="name"
              children={(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Filter Name *</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Enter filter name"
                  />
                </div>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <form.Field
                name="mode"
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Tag Mode *</Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value as keyof typeof TQM_TAG_MODES)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TQM_TAG_MODES).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />

              <form.Field
                name="uploadKb"
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Upload Limit (KB/s)</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="number"
                      min="0"
                      value={field.state.value ?? ""}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        const value = e.target.value
                        field.handleChange(value ? parseInt(value) : undefined)
                      }}
                      placeholder="Optional upload limit"
                    />
                  </div>
                )}
              />
            </div>

            <form.Field
              name="enabled"
              children={(field) => (
                <div className="flex items-center space-x-2">
                  <Switch
                    id={field.name}
                    checked={field.state.value}
                    onCheckedChange={field.handleChange}
                  />
                  <Label htmlFor={field.name}>Enable this filter</Label>
                </div>
              )}
            />
          </div>

          <Separator />

          {/* Expression Configuration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Filter Expression *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowExpressionBuilder(!showExpressionBuilder)}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                {showExpressionBuilder ? "Hide Builder" : "Expression Builder"}
              </Button>
            </div>

            {showExpressionBuilder && (
              <TQMExpressionBuilder
                instanceId={instanceId}
                value={form.getFieldValue("expression")}
                onChange={handleExpressionChange}
              />
            )}

            <form.Field
              name="expression"
              children={(field) => (
                <div className="space-y-2">
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => handleExpressionChange(e.target.value)}
                    placeholder="Enter TQM expression (e.g., Seeds <= 3 && !IsUnregistered())"
                    rows={3}
                    className="font-mono text-sm"
                  />
                  {isValidating && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Validating expression...
                    </div>
                  )}
                  {expressionValidation && (
                    <div className={`flex items-center text-sm ${
                      expressionValidation.valid ? "text-green-600" : "text-destructive"
                    }`}>
                      {expressionValidation.valid ? (
                        <Check className="h-4 w-4 mr-2" />
                      ) : (
                        <X className="h-4 w-4 mr-2" />
                      )}
                      {expressionValidation.valid ? "Valid expression" : expressionValidation.error}
                    </div>
                  )}
                  {expressionValidation?.fields && expressionValidation.fields.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Referenced fields: {expressionValidation.fields.join(", ")}
                    </div>
                  )}
                </div>
              )}
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating || isUpdating || !expressionValidation?.valid}
            >
              {isCreating || isUpdating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {isEditing ? "Update Filter" : "Create Filter"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}