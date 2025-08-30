/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TQMConfigurationForm } from "./TQMConfigurationForm"
import { TQMFilterManager } from "./TQMFilterManager"
import { useTQMConfig } from "@/hooks/useTQM"
import { Loader2 } from "lucide-react"

interface TQMSettingsDialogProps {
  instanceId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TQMSettingsDialog({
  instanceId,
  open,
  onOpenChange,
}: TQMSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState("configuration")
  const { data: config, isLoading } = useTQMConfig(instanceId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-w-[calc(100%-2rem)] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>TQM Settings</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading TQM configuration...</span>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="configuration">Configuration</TabsTrigger>
              <TabsTrigger value="filters">Filter Management</TabsTrigger>
            </TabsList>

            <TabsContent value="configuration" className="flex-1">
              <TQMConfigurationForm
                instanceId={instanceId}
                config={config}
                onClose={() => onOpenChange(false)}
              />
            </TabsContent>

            <TabsContent value="filters" className="flex-1">
              <TQMFilterManager
                instanceId={instanceId}
                config={config}
                onClose={() => onOpenChange(false)}
              />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}