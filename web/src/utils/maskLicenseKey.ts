/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: MIT
 */

/**
 * Masks a license key showing only the last 4 characters
 * Example: "ABCD-EFGH-IJKL-MNOP" becomes "****-****-****-MNOP"
 */
export function maskLicenseKey(key: string): string {
  if (!key || key.length < 4) return key
  const last4 = key.slice(-4)
  return key.slice(0, -4).replace(/[^-]/g, '*') + last4
}
