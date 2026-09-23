/** Stable, client-safe tokens; server details must not leak into toast copy. */
export const IMPORT_ERRORS = {
  password: "PDF_PASSWORD_PROTECTED",
  corrupted: "PDF_CORRUPTED",
  noText: "PDF_NO_TEXT",
  tooLarge: "IMPORT_TOO_LARGE",
  noItems: "IMPORT_NO_ITEMS",
  controlled: "CONTROLLED_IMPORT_BLOCKED",
} as const;
export function importErrorKey(message: string): string {
  const entry = Object.entries(IMPORT_ERRORS).find(([, token]) => message === token);
  return entry ? `inventory.wholesalerImport.errors.${entry[0]}` : "inventory.wholesalerImport.parseError";
}
