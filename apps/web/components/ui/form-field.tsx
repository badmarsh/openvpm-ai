import * as React from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  error?: string | null;
  description?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Label + control + (description | error) in consistent spacing. Pairs with the
 * `Input` primitive. When `error` is set it replaces the description.
 */
export function FormField({
  label,
  htmlFor,
  error,
  description,
  required,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="block text-sm font-medium text-foreground"
        >
          {label}
          {required ? <span className="ml-0.5 text-destructive">*</span> : null}
        </label>
      ) : null}
      {children}
      {description && !error ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
