import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, id, name, autoComplete = "off", "aria-label": ariaLabel, placeholder, ...props }, ref) => {
    const generatedId = React.useId();
    const finalId = id || name || `txt-${generatedId.replace(/:/g, "")}`;
    const finalName = name || id || finalId;
    const finalAriaLabel = ariaLabel || (typeof placeholder === "string" && placeholder ? placeholder : undefined);

    return (
      <textarea
        id={finalId}
        name={finalName}
        autoComplete={autoComplete}
        aria-label={finalAriaLabel}
        placeholder={placeholder}
        className={cn(
          "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
