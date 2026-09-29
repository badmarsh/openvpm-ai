import { useRef, useState, useEffect } from "react";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateYmdToDisplay, parseDisplayToDateYmd } from "@/lib/date-display";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface DatePickerProps {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  required?: boolean;
  min?: string;
  max?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "dd.mm.yyyy",
  className,
  disabled,
  id,
  name,
  required,
  min,
  max,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: DatePickerProps) {
  const nativeRef = useRef<HTMLInputElement>(null);
  const [display, setDisplay] = useState(() => formatDateYmdToDisplay(value));

  useEffect(() => {
    setDisplay(formatDateYmdToDisplay(value));
  }, [value]);

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setDisplay(formatDateYmdToDisplay(nextValue));
  };

  return (
    <div
      className={cn(
        "relative flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      <input
        ref={nativeRef}
        type="date"
        value={value ?? ""}
        onChange={(e) => handleSelect(e.target.value)}
        disabled={disabled}
        name={name}
        id={id ? `${id}-native` : undefined}
        required={required}
        min={min}
        max={max}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <Input
        id={id}
        type="text"
        value={display}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 h-auto text-inherit min-w-0 flex-1"
        onChange={(e) => {
          const text = e.target.value;
          setDisplay(text);
          const parsed = parseDisplayToDateYmd(text);
          if (parsed) {
            onChange(parsed);
          } else if (text.trim() === "") {
            onChange("");
          }
        }}
        onClick={() => {
          if (!display) {
            nativeRef.current?.showPicker?.();
          }
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-foreground"
        onClick={() => nativeRef.current?.showPicker?.()}
        aria-label="Otvoriť kalendár"
      >
        <CalendarIcon className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
