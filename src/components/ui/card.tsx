import * as React from "react";
import { cn } from "@/lib/utils";
import BorderGlow from "./BorderGlow";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean | undefined;
  glowColor?: string | undefined;
  glowIntensity?: number | undefined;
  borderRadius?: number | undefined;
  glowRadius?: number | undefined;
  edgeSensitivity?: number | undefined;
  coneSpread?: number | undefined;
  colors?: string[] | undefined;
  animated?: boolean | undefined;
  backgroundColor?: string | undefined;
  fillOpacity?: number | undefined;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      glow = true,
      glowColor = "40 80 80",
      glowIntensity = 1.0,
      borderRadius = 14,
      glowRadius = 32,
      edgeSensitivity = 30,
      coneSpread = 25,
      colors = ["#c084fc", "#f472b6", "#38bdf8"],
      animated = false,
      backgroundColor,
      fillOpacity = 0.4,
      children,
      ...props
    },
    ref
  ) => {
    if (!glow) {
      return (
        <div
          ref={ref}
          className={cn("rounded-xl border bg-card text-card-foreground shadow-sm", className)}
          {...props}
        >
          {children}
        </div>
      );
    }

    return (
      <BorderGlow
        ref={ref}
        className={cn("text-card-foreground", className)}
        glowColor={glowColor}
        glowIntensity={glowIntensity}
        borderRadius={borderRadius}
        glowRadius={glowRadius}
        edgeSensitivity={edgeSensitivity}
        coneSpread={coneSpread}
        colors={colors}
        animated={animated}
        backgroundColor={backgroundColor}
        fillOpacity={fillOpacity}
        {...props}
      >
        {children}
      </BorderGlow>
    );
  }
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
export default Card;
