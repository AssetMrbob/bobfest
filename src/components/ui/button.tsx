import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none rounded-[10px] cursor-pointer";

    const variantStyles = {
      primary:
        "bg-[#2563EB] text-[#FFFFFF] hover:bg-[#1D4ED8] active:bg-[#1E40AF]",
      secondary:
        "bg-[#FAFAFA] text-[#171717] border border-[#E5E7EB] hover:bg-[#F3F4F6] active:bg-[#E5E7EB]",
      outline:
        "bg-transparent text-[#171717] border border-[#E5E7EB] hover:bg-[#FAFAFA] active:bg-[#F3F4F6]",
      ghost:
        "bg-transparent text-[#737373] hover:text-[#171717] hover:bg-[#FAFAFA]",
      destructive:
        "bg-[#EF4444] text-[#FFFFFF] hover:bg-[#DC2626] active:bg-[#B91C1C]",
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-xs tracking-tight",
      md: "h-10 px-4 text-sm tracking-tight",
      lg: "h-11 px-5 text-base tracking-tight",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
