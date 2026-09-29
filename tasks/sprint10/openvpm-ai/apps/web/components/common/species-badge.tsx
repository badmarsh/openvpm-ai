import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

const SPECIES_EMOJI: Record<string, string> = {
  canine: "🐕",
  feline: "🐈",
  avian: "🦜",
  rabbit: "🐇",
  reptile: "🦎",
  equine: "🐎",
  bovine: "🐄",
  ovine: "🐑",
  caprine: "🐐",
  porcine: "🐖",
  poultry: "🐓",
  camelid: "🦙",
  other: "🐾",
};

export interface SpeciesBadgeProps {
  species?: string | null;
  breed?: string | null;
  className?: string;
  showBreed?: boolean;
}

export function SpeciesBadge({ species, breed, className, showBreed = true }: SpeciesBadgeProps) {
  const { t } = useI18n();
  const emoji = SPECIES_EMOJI[species?.toLowerCase() ?? "other"] ?? "🐾";
  const speciesLabel = species
    ? t(`species.${species.toLowerCase()}`, species.charAt(0).toUpperCase() + species.slice(1))
    : null;

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <span aria-hidden="true">{emoji}</span>
      {speciesLabel && <span>{speciesLabel}</span>}
      {showBreed && breed && <span className="text-muted-foreground">· {breed}</span>}
    </span>
  );
}
