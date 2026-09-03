import React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme, Theme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  variant?: "button" | "dropdown" | "segmented";
  className?: string;
}

export function ThemeToggle({ variant = "dropdown", className }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  if (variant === "button") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className={cn(
          "text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors",
          className
        )}
        title={`Current: ${resolvedTheme === "dark" ? "Dark mode" : "Light mode"}. Click to switch.`}
        aria-label="Toggle theme"
      >
        {resolvedTheme === "dark" ? (
          <Sun className="size-4 text-amber-400 transition-transform" />
        ) : (
          <Moon className="size-4 text-slate-700 transition-transform" />
        )}
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  if (variant === "segmented") {
    const options: { value: Theme; label: string; icon: React.ElementType }[] = [
      { value: "light", label: "Light", icon: Sun },
      { value: "dark", label: "Dark", icon: Moon },
      { value: "system", label: "System", icon: Monitor },
    ];

    return (
      <div className={`inline-flex rounded-lg border bg-muted p-1 ${className || ""}`}>
        {options.map(({ value, label, icon: Icon }) => {
          const isActive = theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={cn("size-3.5", value === "light" && isActive ? "text-amber-500" : value === "dark" && isActive ? "text-blue-400" : "")} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Default dropdown variant
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-9 w-9 rounded-xl text-foreground/85 hover:text-foreground hover:bg-muted/60 transition-colors focus-visible:ring-1 focus-visible:ring-ring",
            className
          )}
          title="Toggle Light / Dark mode"
          aria-label="Toggle Light / Dark mode"
        >
          <Sun className="size-4 rotate-0 scale-100 transition-all text-amber-500 dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-4 rotate-90 scale-0 transition-all text-slate-700 dark:rotate-0 dark:scale-100 dark:text-blue-400" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => setTheme("light")} className="gap-2 cursor-pointer">
          <Sun className="size-4 text-amber-500" />
          <span>Light Mode</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")} className="gap-2 cursor-pointer">
          <Moon className="size-4 text-blue-400" />
          <span>Dark Mode</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")} className="gap-2 cursor-pointer">
          <Monitor className="size-4 text-muted-foreground" />
          <span>System Default</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
