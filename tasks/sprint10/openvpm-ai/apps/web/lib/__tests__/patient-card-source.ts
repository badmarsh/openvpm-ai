import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Reads the patient detail page source + all extracted section components
 * as a single concatenated string. Tests that verify patient card features
 * can search across the entire surface.
 */
export function readPatientCardSource(): string {
  const pageSource = readFileSync(
    "app/(dashboard)/patients/[id]/page.tsx",
    "utf8",
  );
  const sectionsDir = "components/patients/sections";
  let sectionSources = "";
  try {
    const files = readdirSync(sectionsDir).filter((f) => f.endsWith(".tsx"));
    for (const file of files) {
      sectionSources += "\n" + readFileSync(join(sectionsDir, file), "utf8");
    }
  } catch {
    // sections directory may not exist in some test setups
  }
  try {
    sectionSources +=
      "\n" +
      readFileSync("components/patients/patient-sticky-rail.tsx", "utf8");
  } catch {
    // optional
  }
  return pageSource + sectionSources;
}

/**
 * Reads only the page.tsx file (for tests checking page-level concerns).
 */
export function readPatientPageSource(): string {
  return readFileSync("app/(dashboard)/patients/[id]/page.tsx", "utf8");
}
