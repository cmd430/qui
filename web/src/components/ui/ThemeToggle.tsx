import { useState, useEffect, useCallback } from "react";
import { getCurrentThemeMode, getCurrentTheme, setTheme, setThemeMode, type ThemeMode } from "@/utils/theme";
import { getAllThemes, isThemePremium, isThemeCustom, refreshThemesList } from "@/config/themes";
import { Sun, Moon, Monitor, Palette, SlidersHorizontal } from "lucide-react";
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
import { ColorCustomizer } from "@/components/themes/ColorCustomizer";

const THEME_CHANGE_EVENT = "themechange";
const MODE_ICONS = { light: Sun, dark: Moon, auto: Monitor };
const MODE_LABELS = { light: 'Light', dark: 'Dark', auto: 'System' };

const getThemePrimaryColor = (theme: ReturnType<typeof getAllThemes>[0]) => {
  const isDark = document.documentElement.classList.contains('dark');
  return (isDark ? theme.cssVars.dark : theme.cssVars.light)['--primary'] || '';
};

const useThemeChange = () => {
  const [currentMode, setCurrentMode] = useState<ThemeMode>(getCurrentThemeMode());
  const [currentTheme, setCurrentTheme] = useState(getCurrentTheme());

  useEffect(() => {
    const checkTheme = () => {
      setCurrentMode(getCurrentThemeMode());
      setCurrentTheme(getCurrentTheme());
    };
    checkTheme();
    window.addEventListener(THEME_CHANGE_EVENT, checkTheme);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, checkTheme);
  }, []);

  return { currentMode, currentTheme };
};

export const ThemeToggle: React.FC = () => {
  const { currentMode, currentTheme } = useThemeChange();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showColorCustomizer, setShowColorCustomizer] = useState(false);
  const { hasPremiumAccess } = useHasPremiumAccess();
  
  useQuery({
    queryKey: ['refresh-themes'],
    queryFn: async () => { await refreshThemesList(); return true; },
    staleTime: 30000,
  });
  
  const themes = getAllThemes();

  const handleModeSelect = useCallback(async (mode: ThemeMode) => {
    setIsTransitioning(true);
    await setThemeMode(mode);
    setTimeout(() => setIsTransitioning(false), 400);
    toast.success(`Switched to ${MODE_LABELS[mode]} mode`);
  }, []);

  const handleThemeSelect = useCallback(async (themeId: string) => {
    const isPremium = isThemePremium(themeId);
    const isCustom = isThemeCustom(themeId);
    
    if ((isPremium || isCustom) && !hasPremiumAccess) {
      toast.error("This is a premium feature. Please purchase a license to use it.");
      return;
    }

    setIsTransitioning(true);
    await setTheme(themeId);
    setTimeout(() => setIsTransitioning(false), 400);
    toast.success(`Switched to ${themes.find(t => t.id === themeId)?.name || themeId} theme`);
  }, [hasPremiumAccess, themes]);

  const ModeItem = ({ mode }: { mode: ThemeMode }) => {
    const Icon = MODE_ICONS[mode];
    const isActive = currentMode === mode;
    return (
      <DropdownMenuItem 
        onClick={() => handleModeSelect(mode)} 
        className={cn(
          "flex items-center gap-2",
          isActive && "bg-accent"
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{MODE_LABELS[mode]}</span>
      </DropdownMenuItem>
    );
  };

  const ThemeItem = ({ theme }: { theme: ReturnType<typeof getAllThemes>[0] }) => {
    const isPremium = isThemePremium(theme.id);
    const isCustom = isThemeCustom(theme.id);
    const isLocked = (isPremium || isCustom) && !hasPremiumAccess;
    const isActive = currentTheme.id === theme.id;
    
    return (
      <DropdownMenuItem
        onClick={() => handleThemeSelect(theme.id)}
        className={cn(
          "flex items-center gap-2",
          isActive && "bg-accent",
          isLocked && "opacity-60"
        )}
        disabled={isLocked}
      >
        <div
          className="h-4 w-4 rounded-full ring-1 ring-black/10 dark:ring-white/10"
          style={{ backgroundColor: getThemePrimaryColor(theme) }}
        />
        <span className="flex-1">{theme.name}</span>
        {isCustom && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-medium">
            Custom
          </span>
        )}
        {isPremium && !isCustom && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-medium">
            Premium
          </span>
        )}
      </DropdownMenuItem>
    );
  };

  const sortedThemes = themes.sort((a, b) => {
    const aScore = (isThemeCustom(a.id) ? 2 : 0) + (isThemePremium(a.id) ? 1 : 0);
    const bScore = (isThemeCustom(b.id) ? 2 : 0) + (isThemePremium(b.id) ? 1 : 0);
    return aScore - bScore;
  });

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
            <Palette className={cn("h-5 w-5", isTransitioning && "scale-110")} />
            <span className="sr-only">Change theme</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <div className="px-2 py-1.5 text-sm font-medium">Mode</div>
          {(['light', 'dark', 'auto'] as ThemeMode[]).map(mode => (
            <ModeItem key={mode} mode={mode} />
          ))}
          
          <DropdownMenuSeparator />
          
          <div className="px-2 py-1.5 text-sm font-medium">Theme</div>
          {sortedThemes.map(theme => (
            <ThemeItem key={theme.id} theme={theme} />
          ))}
          
          {hasPremiumAccess && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowColorCustomizer(true)} className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                <span>Customize Colors</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      
      <ColorCustomizer open={showColorCustomizer} onOpenChange={setShowColorCustomizer} mode="dialog" />
    </>
  );
};