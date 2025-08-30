/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { createFileRoute } from "@tanstack/react-router"
import { TQMPage } from "@/pages/TQM"

export const Route = createFileRoute("/_authenticated/tqm")({
  component: TQMPage,
})