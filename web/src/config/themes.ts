/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: MIT
 */

import { loadThemes } from '@/utils/themeLoader';
import type { CustomTheme } from '@/types';

export interface Theme {
  id: string;
  name: string;
  isPremium?: boolean;
  description?: string;
  isCustom?: boolean;
  baseThemeId?: string;
  cssVars: {
    light: Record<string, string>;
    dark: Record<string, string>;
  };
}

// Load built-in themes from the themes directory
const builtInThemes: Theme[] = loadThemes();

// Store for all themes (built-in + custom)
let allThemes: Theme[] = [...builtInThemes];

// Load custom themes from API and merge with built-in themes
export async function loadCustomThemes(): Promise<void> {
  try {
    const { api } = await import('@/lib/api');
    const customThemes = await api.getCustomThemes();
    
    // Convert CustomTheme to Theme format
    const convertedThemes: Theme[] = customThemes.map((ct: CustomTheme) => ({
      id: `custom-${ct.id}`,
      name: ct.name,
      description: ct.description,
      isCustom: true,
      baseThemeId: ct.baseThemeId,
      cssVars: {
        light: ct.cssVarsLight,
        dark: ct.cssVarsDark,
      },
    }));
    
    // Merge with built-in themes
    allThemes = [...builtInThemes, ...convertedThemes];
    
    // Sort themes: minimal first, then built-in, then custom
    allThemes.sort((a, b) => {
      if (a.id === 'minimal') return -1;
      if (b.id === 'minimal') return 1;
      if (!a.isCustom && b.isCustom) return -1;
      if (a.isCustom && !b.isCustom) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    // Silently fail if not authenticated or API error
    console.debug('Could not load custom themes:', error);
  }
}

// Export mutable themes array
export const themes: Theme[] = allThemes;

// Helper functions
export function getThemeById(id: string): Theme | undefined {
  return allThemes.find(theme => theme.id === id);
}

export function getDefaultTheme(): Theme {
  return allThemes.find(theme => theme.id === 'minimal') || allThemes[0];
}

export function isThemePremium(themeId: string): boolean {
  const theme = getThemeById(themeId);
  return theme?.isPremium ?? false;
}

export function isThemeCustom(themeId: string): boolean {
  const theme = getThemeById(themeId);
  return theme?.isCustom ?? false;
}

export function getAllThemes(): Theme[] {
  return allThemes;
}

export function refreshThemesList(): void {
  // Reload custom themes
  loadCustomThemes();
}

export { themes as default };
