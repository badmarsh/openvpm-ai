import { useRef, useState, useEffect } from "react";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTimeLocalToDisplay } from "@/lib/date-display";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface DateTimePickerProps {
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
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "dd.mm.yyyy --:--",
  className,
  disabled,
  id,
  name,
  required,
  min,
  max,
}: DateTimePickerProps) {
  const nativeRef = useRef<HTMLInputElement>(null);
  const [display, setDisplay] = useState(() => formatDateTimeLocalToDisplay(value));

  useEffect(() => {
    setDisplay(formatDateTimeLocalToDisplay(value));
  }, [value]);

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setDisplay(formatDateTimeLocalToDisplay(nextValue));
  };

  return (
    <div
      className={cn(
        "relative flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      <input
        ref={nativeRef}
        type="datetime-local"
        value={value ?? ""}
        onChange={(e) => handleSelect(e.target.value)}
        disabled={disabled}
        name={name}
        id={id}
        required={required}
        min={min}
        max={max}
        className="sr-only"
        aria-hidden="true"
      />
      <Input
        type="text"
        value={display}
        placeholder={placeholder}
        readOnly
        disabled={disabled}
        className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 h-auto text-sm"
        onClick={() => nativeRef.current?.showPicker?.()}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => nativeRef.current?.showPicker?.()}
        aria-label="Otvoriť výber dátumu a času"
      >
        <CalendarIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
