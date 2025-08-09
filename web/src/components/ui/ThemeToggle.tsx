import { useState, useEffect, useCallback } from "react";
import {
  getCurrentThemeMode,
  getCurrentTheme,
  setTheme,
  setThemeMode,
  type ThemeMode,
} from "@/utils/theme";
import { getAllThemes, isThemePremium, isThemeCustom, refreshThemesList } from "@/config/themes";
import { Sun, Moon, Monitor, Check, Palette, Sparkles, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useHasPremiumAccess } from "@/hooks/useThemeLicense";
import { useQuery } from "@tanstack/react-query";
import { ColorCustomizer } from "@/components/themes/ColorCustomizerStable";

// Constants
const THEME_CHANGE_EVENT = "themechange";

// Helper to extract primary color from theme
function getThemePrimaryColor(theme: ReturnType<typeof getAllThemes>[0]) {
  // Check if dark mode is active by looking at the document element
  const isDark = document.documentElement.classList.contains('dark');
  const cssVars = isDark ? theme.cssVars.dark : theme.cssVars.light;
  
  // Extract the primary color value from the theme
  return cssVars['--primary'] || '';
}

// Custom hook for theme change detection
const useThemeChange = () => {
  const [currentMode, setCurrentMode] = useState<ThemeMode>(getCurrentThemeMode());
  const [currentTheme, setCurrentTheme] = useState(getCurrentTheme());

  const checkTheme = useCallback(() => {
    setCurrentMode(getCurrentThemeMode());
    setCurrentTheme(getCurrentTheme());
  }, []);

  useEffect(() => {
    const handleThemeChange = () => {
      checkTheme();
    };

    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    };
  }, [checkTheme]);

  return { currentMode, currentTheme };
};

export const ThemeToggle: React.FC = () => {
  const { currentMode, currentTheme } = useThemeChange();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showColorCustomizer, setShowColorCustomizer] = useState(false);
  const { hasPremiumAccess } = useHasPremiumAccess();
  
  // Refresh themes list when dropdown opens
  useQuery({
    queryKey: ['refresh-themes'],
    queryFn: async () => {
      await refreshThemesList();
      return true;
    },
    staleTime: 30000, // Refresh every 30 seconds at most
  });
  
  const themes = getAllThemes();

  const handleModeSelect = useCallback(async (mode: ThemeMode) => {
    setIsTransitioning(true);
    await setThemeMode(mode);
    setTimeout(() => setIsTransitioning(false), 400);
    
    const modeNames = { light: 'Light', dark: 'Dark', auto: 'System' };
    toast.success(`Switched to ${modeNames[mode]} mode`);
  }, []);

  const handleThemeSelect = useCallback(async (themeId: string) => {
    const isPremium = isThemePremium(themeId);
    const isCustom = isThemeCustom(themeId);
    
    // Custom themes require premium access
    if ((isPremium || isCustom) && !hasPremiumAccess) {
      toast.error("This is a premium feature. Please purchase a license to use it.");
      return;
    }

    setIsTransitioning(true);
    await setTheme(themeId);
    setTimeout(() => setIsTransitioning(false), 400);
    
    const theme = themes.find(t => t.id === themeId);
    toast.success(`Switched to ${theme?.name || themeId} theme`);
  }, [hasPremiumAccess, themes]);

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "text-muted-foreground hover:text-foreground transition-transform duration-300",
            isTransitioning && "animate-spin-slow"
          )}
        >
          <Palette className={cn(
            "h-5 w-5 transition-transform duration-200",
            isTransitioning && "scale-110"
          )} />
          <span className="sr-only">Change theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Mode Selection */}
        <div className="px-2 py-1.5 text-sm font-medium">Mode</div>
        <DropdownMenuItem
          onClick={() => handleModeSelect("light")}
          className="flex items-center gap-2"
        >
          <Sun className="h-4 w-4" />
          <span className="flex-1">Light</span>
          {currentMode === "light" && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleModeSelect("dark")}
          className="flex items-center gap-2"
        >
          <Moon className="h-4 w-4" />
          <span className="flex-1">Dark</span>
          {currentMode === "dark" && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleModeSelect("auto")}
          className="flex items-center gap-2"
        >
          <Monitor className="h-4 w-4" />
          <span className="flex-1">System</span>
          {currentMode === "auto" && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Theme Selection */}
        <div className="px-2 py-1.5 text-sm font-medium">Theme</div>
        {themes
          .sort((a, b) => {
            // Sort order: regular themes first, then premium, then custom
            const aIsCustom = isThemeCustom(a.id);
            const bIsCustom = isThemeCustom(b.id);
            const aIsPremium = isThemePremium(a.id);
            const bIsPremium = isThemePremium(b.id);
            
            if (aIsCustom !== bIsCustom) return aIsCustom ? 1 : -1;
            if (aIsPremium !== bIsPremium) return aIsPremium ? 1 : -1;
            return 0;
          })
          .map((theme) => {
          const isPremium = isThemePremium(theme.id);
          const isCustom = isThemeCustom(theme.id);
          const isLocked = (isPremium || isCustom) && !hasPremiumAccess;
          
          return (
            <DropdownMenuItem
              key={theme.id}
              onClick={() => handleThemeSelect(theme.id)}
              className={cn(
                "flex items-center gap-2",
                isLocked && "opacity-60"
              )}
              disabled={isLocked}
            >
              <div className="flex items-center gap-2 flex-1">
                <div
                  className="h-4 w-4 rounded-full ring-1 ring-black/10 dark:ring-white/10 transition-all duration-300 ease-out"
                  style={{ 
                    backgroundColor: getThemePrimaryColor(theme),
                    backgroundImage: 'none',
                    background: getThemePrimaryColor(theme) + ' !important'
                  }}
                />
                <div className="flex items-center gap-1.5 flex-1">
                  <span>{theme.name}</span>
                  {isCustom && (
                    <Sparkles className="h-3 w-3 text-primary" />
                  )}
                  {isPremium && !isCustom && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-medium">
                      Premium
                    </span>
                  )}
                </div>
              </div>
              {currentTheme.id === theme.id && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          );
        })}
        
        {/* Color Customization - Premium Feature */}
        {hasPremiumAccess && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setShowColorCustomizer(true)}
              className="flex items-center gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="flex-1">Customize Colors</span>
              <Sparkles className="h-3 w-3 text-primary" />
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    
    {/* Color Customizer Dialog */}
    <ColorCustomizer 
      open={showColorCustomizer}
      onOpenChange={setShowColorCustomizer}
      mode="dialog"
    />
    </>
  );
};