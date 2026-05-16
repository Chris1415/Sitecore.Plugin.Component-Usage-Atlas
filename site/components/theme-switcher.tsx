"use client";

/**
 * ThemeSwitcher — env-gated 3-state (Light / Dark / System) theme toggle.
 *
 * Renders nothing when NEXT_PUBLIC_ATLAS_THEME_SWITCHER !== "true". The
 * ThemeProvider (mounted in app/layout.tsx) keeps following the user's OS
 * preference regardless — this component only controls the visible affordance.
 *
 * Ported from Redirect Manager's reference implementation (the framework's
 * dark+light+system default policy). Inline button — parent surface decides
 * placement; designed to fit into existing chrome (toolbar action rows,
 * card title rows) as a ghost icon-button.
 *
 * The `d` keyboard hotkey (toggle dark ↔ light) is wired in theme-provider.tsx
 * regardless of this component's visibility.
 */

import { Icon } from "@/lib/icon";
import {
  mdiCheck,
  mdiMonitor,
  mdiWeatherNight,
  mdiWhiteBalanceSunny,
} from "@mdi/js";
import { useTheme } from "next-themes";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isThemeSwitcherEnabled } from "@/lib/env-flags";
import { cn } from "@/lib/utils";

type ThemeChoice = "light" | "dark" | "system";

const CHOICES: ReadonlyArray<{
  value: ThemeChoice;
  label: string;
  iconPath: string;
}> = [
  { value: "light", label: "Light", iconPath: mdiWhiteBalanceSunny },
  { value: "dark", label: "Dark", iconPath: mdiWeatherNight },
  { value: "system", label: "System", iconPath: mdiMonitor },
];

interface ThemeSwitcherProps {
  className?: string;
}

function ThemeSwitcher({ className }: ThemeSwitcherProps = {}) {
  const [mounted, setMounted] = React.useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  // next-themes mount-gate — resolvedTheme is undefined on the server, known
  // on the client. Without the gate, the trigger icon would flicker on hydration.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!isThemeSwitcherEnabled()) {
    return null;
  }

  if (!mounted) {
    return null;
  }

  const currentChoice: ThemeChoice =
    theme === "light" || theme === "dark" || theme === "system"
      ? theme
      : "system";

  const triggerIcon =
    resolvedTheme === "dark" ? mdiWeatherNight : mdiWhiteBalanceSunny;

  return (
    <div
      data-slot="theme-switcher"
      data-theme-switcher-enabled="true"
      className={cn("inline-flex", className)}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Theme"
            title="Theme"
            className="text-muted-foreground hover:text-foreground"
          >
            <Icon path={triggerIcon} className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {CHOICES.map((choice) => (
            <DropdownMenuItem
              key={choice.value}
              onSelect={() => setTheme(choice.value)}
              data-theme-choice={choice.value}
              aria-checked={choice.value === currentChoice}
              role="menuitemradio"
            >
              <Icon path={choice.iconPath} className="mr-2 h-4 w-4" />
              <span>{choice.label}</span>
              {choice.value === currentChoice ? (
                <Icon path={mdiCheck} className="ml-auto h-4 w-4" />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export { ThemeSwitcher };
