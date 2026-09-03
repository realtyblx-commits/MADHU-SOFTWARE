import { useEffect, useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export interface TimeInput12Props {
  value?: string | null;
  onChange: (time24: string) => void;
  disabled?: boolean;
  defaultPeriod?: "AM" | "PM";
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
}

export function parse24To12(time24?: string | null, fallbackPeriod: "AM" | "PM" = "AM") {
  if (!time24 || !time24.trim()) {
    return { timeStr: "", period: fallbackPeriod };
  }
  const parts = time24.split(":");
  let h = parseInt(parts[0] ?? "", 10);
  const m = parts[1] ? parts[1].slice(0, 2) : "00";
  if (isNaN(h)) return { timeStr: "", period: fallbackPeriod };

  let period: "AM" | "PM" = "AM";
  if (h >= 12) {
    period = "PM";
    if (h > 12) h -= 12;
  } else if (h === 0) {
    h = 12;
    period = "AM";
  }

  const hStr = String(h).padStart(2, "0");
  const mStr = String(m).padStart(2, "0");
  return { timeStr: `${hStr}:${mStr}`, period };
}

export function convert12To24(timeStr: string, period: "AM" | "PM"): string {
  if (!timeStr || !timeStr.trim()) return "";
  const cleaned = timeStr.trim().toLowerCase();
  let effectivePeriod = period;
  if (cleaned.includes("pm")) effectivePeriod = "PM";
  if (cleaned.includes("am")) effectivePeriod = "AM";

  const numPart = cleaned.replace(/[^0-9:]/g, "");
  if (!numPart) return "";

  let h: number;
  let m: number;

  if (numPart.includes(":")) {
    const parts = numPart.split(":");
    h = parseInt(parts[0] ?? "", 10);
    m = parts.length > 1 ? parseInt(parts[1] ?? "0", 10) : 0;
  } else if (numPart.length === 3) {
    h = parseInt(numPart.slice(0, 1), 10);
    m = parseInt(numPart.slice(1), 10);
  } else if (numPart.length === 4) {
    h = parseInt(numPart.slice(0, 2), 10);
    m = parseInt(numPart.slice(2), 10);
  } else {
    h = parseInt(numPart, 10);
    m = 0;
  }

  if (isNaN(h)) return "";
  if (h > 12) {
    if (h >= 12) {
      effectivePeriod = "PM";
      if (h > 12) h -= 12;
    }
  }
  if (h < 1) h = 12;

  const safeMinutes = isNaN(m) ? 0 : Math.min(59, Math.max(0, m));
  let h24 = h;
  if (effectivePeriod === "PM") {
    if (h24 < 12) h24 += 12;
  } else {
    if (h24 === 12) h24 = 0;
  }
  return `${String(h24).padStart(2, "0")}:${String(safeMinutes).padStart(2, "0")}`;
}

export function TimeInput12({
  value,
  onChange,
  disabled = false,
  defaultPeriod = "AM",
  placeholder,
  className = "",
  id,
  name,
}: TimeInput12Props) {
  const initial = parse24To12(value, defaultPeriod);
  const [displayTime, setDisplayTime] = useState(initial.timeStr);
  const [period, setPeriod] = useState<"AM" | "PM">(initial.period);
  const isInternalChange = useRef(false);

  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    const updated = parse24To12(value, defaultPeriod);
    setDisplayTime(updated.timeStr);
    setPeriod(updated.period);
  }, [value, defaultPeriod]);

  const commitTime = (timeText: string, targetPeriod: "AM" | "PM") => {
    if (!timeText.trim()) {
      isInternalChange.current = true;
      onChange("");
      return;
    }
    const result24 = convert12To24(timeText, targetPeriod);
    const reformatted12 = parse24To12(result24, targetPeriod);
    setDisplayTime(reformatted12.timeStr);
    setPeriod(reformatted12.period);
    isInternalChange.current = true;
    onChange(result24);
  };

  const handleBlur = () => {
    commitTime(displayTime, period);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "a" || e.key === "A") {
      e.preventDefault();
      setPeriod("AM");
      if (displayTime) commitTime(displayTime, "AM");
    } else if (e.key === "p" || e.key === "P") {
      e.preventDefault();
      setPeriod("PM");
      if (displayTime) commitTime(displayTime, "PM");
    }
  };

  const togglePeriod = () => {
    if (disabled) return;
    const nextPeriod = period === "AM" ? "PM" : "AM";
    setPeriod(nextPeriod);
    if (displayTime) {
      commitTime(displayTime, nextPeriod);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    setDisplayTime("");
    isInternalChange.current = true;
    onChange("");
  };

  return (
    <div className={`relative inline-flex items-center gap-1.5 ${className}`}>
      <div className="relative flex-1 group">
        <Input
          id={id}
          name={name}
          type="text"
          disabled={disabled}
          placeholder={placeholder || (defaultPeriod === "AM" ? "10:30" : "06:30")}
          value={displayTime}
          onChange={(e) => setDisplayTime(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          maxLength={8}
          className="h-9 w-24 text-xs font-mono px-2 text-center bg-card/60 border-input transition-colors focus:border-primary pr-6"
        />
        {displayTime && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            tabIndex={-1}
            aria-label="Clear time"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 size-4 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      <Button
        type="button"
        disabled={disabled}
        variant="outline"
        size="sm"
        onClick={togglePeriod}
        title={`Current: ${period}. Click to switch to ${period === "AM" ? "PM" : "AM"}`}
        className={`h-9 px-2.5 text-xs font-bold transition-all select-none shrink-0 ${
          period === "PM"
            ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/25 shadow-sm"
            : "bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25 shadow-sm"
        }`}
      >
        {period}
      </Button>
    </div>
  );
}
