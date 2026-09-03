import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type = "text", id, name, autoComplete, "aria-label": ariaLabel, placeholder, ...props }, ref) => {
    const generatedId = React.useId();
    const finalId = id || name || `input-${generatedId.replace(/:/g, "")}`;
    const finalName = name || id || finalId;

    // Sensible autocomplete fallback to satisfy browser autofill audits
    let finalAutoComplete = autoComplete;
    if (!finalAutoComplete) {
      if (type === "email") finalAutoComplete = "email";
      else if (type === "password") finalAutoComplete = "current-password";
      else if (type === "tel") finalAutoComplete = "tel";
      else if (type === "search") finalAutoComplete = "off";
      else finalAutoComplete = "off";
    }

    const finalAriaLabel = ariaLabel || (typeof placeholder === "string" && placeholder ? placeholder : undefined);

    return (
      <input
        type={type}
        id={finalId}
        name={finalName}
        autoComplete={finalAutoComplete}
        aria-label={finalAriaLabel}
        placeholder={placeholder}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
