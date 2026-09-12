export const CONTROLLED_SUBSTANCE_DRUG_NAME_MAX_LENGTH = 255;
export const CONTROLLED_SUBSTANCE_UNIT_MAX_LENGTH = 32;
export const CONTROLLED_SUBSTANCE_LOT_NUMBER_MAX_LENGTH = 64;
export const CONTROLLED_SUBSTANCE_NOTES_MAX_LENGTH = 2000;
export const CONTROLLED_SUBSTANCE_QUANTITY_MIN = 0.001;
export const CONTROLLED_SUBSTANCE_QUANTITY_MAX = 9999999.999;
export const CONTROLLED_SUBSTANCE_QUANTITY_STEP = 0.001;
export const CONTROLLED_SUBSTANCE_QUANTITY_PATTERN =
  /^\d{1,7}(?:\.\d{1,3})?$/;

export function isControlledSubstanceQuantityInputValid(
  value: string
): boolean {
  const trimmed = value.trim();
  const quantity = Number(trimmed);
  return (
    CONTROLLED_SUBSTANCE_QUANTITY_PATTERN.test(trimmed) &&
    Number.isFinite(quantity) &&
    quantity > 0 &&
    quantity <= CONTROLLED_SUBSTANCE_QUANTITY_MAX
  );
}

export function isControlledSubstanceRequiredTextInputValid(
  value: string,
  maxLength: number
): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength;
}

export function isControlledSubstanceOptionalTextInputValid(
  value: string,
  maxLength: number
): boolean {
  return value.trim().length <= maxLength;
}

/**
 * Svedok pri výdaji omamných a psychotropných látok (Zákon č. 139/1998 Z. z.
 * a vyhláška MZ SR). Pri akciách `administered` a `wasted` je povinný druhý
 * kvalifikovaný pracovník (technik / lekár). Vracia null, ak je postup OK,
 * inak chybové hlásenie.
 */
export function controlledSubstanceWitnessError(params: {
  action: "received" | "administered" | "wasted" | "returned";
  witnessedBy: string | null | undefined;
}): string | null {
  const requiresWitness =
    params.action === "administered" || params.action === "wasted";
  if (requiresWitness && !params.witnessedBy) {
    return "Pri podaní / likvidácii omamnej látky je povinný svedok (technik alebo lekár).";
  }
  return null;
}

export interface ControlledSubstanceEntry {
  action: "received" | "administered" | "wasted" | "returned";
  quantity: number;
}

/**
 * Stav trezoru = prijaté − podané − zlikvidované + vrátené. Slúži na odpočet
 * z trezoru pri každej manipulácii a na kontrolu, že stav nikdy neklesne pod 0.
 */
export function computeControlledSubstanceBalance(
  entries: ControlledSubstanceEntry[]
): number {
  let balance = 0;
  for (const entry of entries) {
    if (entry.action === "received" || entry.action === "returned") {
      balance += entry.quantity;
    } else {
      balance -= entry.quantity;
    }
  }
  return Math.round(balance * 1000) / 1000;
}
