import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { normalizeE164 } from "@/lib/messaging/phone";

/**
 * Sprint 13 guards for /clients/new, /patients/new and /patients/duplicates:
 * page-kit adoption, double-submit and Enter-key hardening, microchip
 * cleaning, merge-dialog locking, and SK/EN coverage of every key the pages
 * use. Role gates and merge security literals stay pinned by
 * client-patient-form-ui.test.ts and patient-duplicates-ui.test.ts.
 */

const CLIENT_NEW = "app/(dashboard)/clients/new/page.tsx";
const PATIENT_NEW = "app/(dashboard)/patients/new/page.tsx";
const DUPLICATES = "app/(dashboard)/patients/duplicates/page.tsx";
const PAGES = [CLIENT_NEW, PATIENT_NEW, DUPLICATES];

function source(file: string): string {
  return readFileSync(file, "utf8");
}

function importsFrom(src: string, module: string): string {
  const escaped = module.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const match = src.match(
    new RegExp(`import\\s*\\{([\\s\\S]*?)\\}\\s*from "${escaped}"`),
  );
  return match?.[1] ?? "";
}

/**
 * Next.js pages may not export helpers, so pull the named top-level
 * declarations out of the page with the TypeScript AST, strip the types, and
 * evaluate them. Fails loudly if a helper is renamed or removed.
 */
function loadPageHelpers<T>(file: string, names: string[]): T {
  const sourceFile = ts.createSourceFile(
    file,
    source(file),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const wanted = new Set(names);
  const chunks: string[] = [];
  for (const statement of sourceFile.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name &&
      wanted.has(statement.name.text)
    ) {
      chunks.push(statement.getText(sourceFile));
      wanted.delete(statement.name.text);
    } else if (ts.isVariableStatement(statement)) {
      const declared = statement.declarationList.declarations
        .map((declaration) =>
          ts.isIdentifier(declaration.name) ? declaration.name.text : "",
        )
        .filter((name) => wanted.has(name));
      if (declared.length > 0) {
        chunks.push(statement.getText(sourceFile));
        for (const name of declared) wanted.delete(name);
      }
    }
  }
  if (wanted.size > 0) {
    throw new Error(`${file} no longer declares: ${[...wanted].join(", ")}`);
  }
  const { outputText } = ts.transpileModule(chunks.join("\n\n"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.Preserve,
    },
    fileName: "page-helpers.tsx",
  });
  return new Function(`${outputText}\nreturn { ${names.join(", ")} };`)() as T;
}

function lookup(dict: Record<string, unknown>, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      dict,
    );
}

function leafPaths(node: unknown, prefix = ""): string[] {
  if (!node || typeof node !== "object") return [prefix];
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    leafPaths(value, prefix ? `${prefix}.${key}` : key),
  );
}

describe("patient & client intake page-kit adoption", () => {
  it("wraps duplicate review in pageShellClass and the candidates in DataTableFrame", () => {
    const src = source(DUPLICATES);
    const kit = importsFrom(src, "@/components/layout/page-kit");
    for (const name of [
      "pageShellClass",
      "DataTableFrame",
      "PageToolbar",
      "SearchField",
      "filterControlClass",
      "tableHeadClass",
      "tableCellClass",
      "tableRowClass",
    ]) {
      expect(kit, name).toContain(name);
    }
    expect(src).toContain("className={pageShellClass}");
    expect(src).toMatch(/<DataTableFrame>\s*<table className="w-full text-xs">/);
    expect(src).toContain("</DataTableFrame>");
    expect(src).toContain("className={tableHeadClass}");
    expect(src).toContain("className={tableCellClass}");
    expect(src).toMatch(/<PageToolbar>[\s\S]*?<SearchField[\s\S]*?<\/PageToolbar>/);
    // The old per-patient cards are gone in favour of the comparison table.
    expect(src).not.toContain('className="rounded-md border border-border p-3"');
  });

  it("harmonizes headers with PageHeader icons and PageSectionHeader", () => {
    const headerImports = (file: string) =>
      importsFrom(source(file), "@/components/layout/page-header");
    for (const file of PAGES) {
      expect(headerImports(file), file).toContain("PageHeader");
      expect(headerImports(file), file).toContain("PageSectionHeader");
      expect(source(file), file).toContain("<PageSectionHeader");
    }
    expect(source(CLIENT_NEW)).toMatch(/<PageHeader\s+icon=\{UserPlus\}/);
    expect(source(PATIENT_NEW)).toMatch(/<PageHeader\s+icon=\{PawPrint\}/);
    expect(source(DUPLICATES)).toMatch(/<PageHeader\s+icon=\{GitMerge\}/);
    // Back navigation lives in the header actions, not above the title.
    for (const file of PAGES) {
      expect(source(file), file).not.toContain('className="mb-4"');
    }
  });

  it("wraps both intake forms in pageShellClass sections that collapse below 768px", () => {
    for (const file of [CLIENT_NEW, PATIENT_NEW]) {
      const src = source(file);
      expect(importsFrom(src, "@/components/layout/page-kit"), file).toContain(
        "pageShellClass",
      );
      expect(src, file).toContain("className={pageShellClass}");
      expect(src.match(/<PageSectionHeader/g)?.length, file).toBe(3);
      expect(src, file).toContain("md:grid-cols-2");
      expect(src, file).not.toMatch(/\bsm:grid-cols-[23]\b/);
      // No sibling margin stacking inside the shell.
      expect(src, file).not.toMatch(/className="mt-[46]\b/);
    }
    expect(source(CLIENT_NEW)).toContain("md:grid-cols-3");
    expect(source(DUPLICATES)).toContain(
      "md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]",
    );
    expect(source(DUPLICATES)).not.toMatch(/\bsm:grid-cols-\[/);
  });

  it("uses design-system controls with visible focus rings", () => {
    for (const file of [CLIENT_NEW, PATIENT_NEW]) {
      const src = source(file);
      expect(src, file).toContain('from "@/components/ui/label"');
      expect(src, file).toMatch(
        /const formSelectClass =\s*"[^"]*focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2[^"]*"/,
      );
      expect(src, file).not.toMatch(/<select[^>]*className="(?![^"]*focus-visible)/);
    }
    expect(source(CLIENT_NEW).match(/className=\{formSelectClass\}/g)?.length).toBe(1);
    expect(source(PATIENT_NEW).match(/className=\{formSelectClass\}/g)?.length).toBe(2);
    expect(source(DUPLICATES).match(/cn\(filterControlClass, "w-full"\)/g)?.length).toBe(2);
    // Semantic tokens replace hard-coded palette colours (dark-mode safe).
    for (const file of PAGES) {
      expect(source(file), file).not.toMatch(/\b(?:bg|text|border)-(?:amber|emerald)-\d/);
    }
  });

  it("gives the species, breed, microchip and owner inputs programmatic labels", () => {
    const src = source(PATIENT_NEW);
    for (const id of ["clientSearch", "name", "species", "breed", "sex", "dob", "microchipNumber", "color"]) {
      expect(src, id).toContain(`htmlFor="${id}"`);
      expect(src, id).toContain(`id="${id}"`);
    }
    expect(src).toContain('aria-describedby="microchipNumber-hint"');
    expect(src).toContain('id="microchipNumber-hint"');
    expect(src).toContain('aria-label={t("patients.form.changeOwner", "Change owner")}');
    // Owner results stay buttons (e2e selects them by role) and are keyboard reachable.
    expect(src).toContain("data-owner-option");
    expect(src).toContain("handleOwnerOptionKeyDown(event, index)");
  });
});

describe("intake submission hardening", () => {
  it("guards both forms against double submission with a synchronous lock and a locked fieldset", () => {
    const cases = [
      { file: CLIENT_NEW, mutation: "createClient" },
      { file: PATIENT_NEW, mutation: "createPatient" },
    ];
    for (const { file, mutation } of cases) {
      const src = source(file);
      expect(src, file).toContain("const submitLockRef = useRef(false);");
      expect(src, file).toContain("if (submitLockRef.current) return;");
      expect(src, file).toContain("submitLockRef.current = false;");
      const lockAt = src.indexOf("submitLockRef.current = true;");
      expect(lockAt, file).toBeGreaterThan(-1);
      expect(lockAt, file).toBeLessThan(src.indexOf(`${mutation}.mutate(`));
      expect(src, file).toContain(
        `const formLocked = ${mutation}.isPending || ${mutation}.isSuccess;`,
      );
      expect(src, file).toContain(
        '<fieldset disabled={formLocked} className="min-w-0 space-y-6">',
      );
      expect(src, file).toContain("aria-busy={formLocked}");
      expect(src, file).toMatch(
        /\{formLocked \? \(\s*<>\s*<Loader2\s+className="mr-2 h-4 w-4 animate-spin"/,
      );
    }
  });

  it("never submits a multi-field intake form from Enter in a text field", () => {
    for (const file of [CLIENT_NEW, PATIENT_NEW]) {
      const src = source(file);
      expect(src, file).toMatch(
        /<form\s+noValidate\s+onSubmit=\{handleSubmit\}\s+onKeyDown=\{preventImplicitSubmit\}/,
      );
    }
    expect(source(PATIENT_NEW)).toContain(
      "if (clientResults?.length === 1) selectClient(clientResults[0]);",
    );
  });

  it("labels submit buttons with dedicated keys and translates validation copy", () => {
    const client = source(CLIENT_NEW);
    const patient = source(PATIENT_NEW);
    expect(client).toContain('t("clients.form.createClient", "Create Client")');
    expect(patient).toContain('t("patients.form.createPatient", "Create Patient")');
    expect(client).not.toContain('t("clients.new_client"');
    expect(patient).not.toContain('t("patients.form.titleNew", "Create Patient")');
    // Misused shared keys rendered the wrong sentence at runtime.
    for (const file of PAGES) {
      expect(source(file), file).not.toContain('t("common.error_retry"');
      expect(source(file), file).not.toContain('t("common.loading"');
    }
    expect(patient).not.toContain('"Patient name is required."');
    expect(source(DUPLICATES)).not.toContain('t("patients.form.readOnlyDesc"');
    // Server zod issues are shown as a translated message, not raw JSON.
    for (const file of [CLIENT_NEW, PATIENT_NEW]) {
      expect(source(file), file).toContain("err.data?.zodError");
    }
    // Every validation message goes through t(); no bare setError strings.
    for (const file of [CLIENT_NEW, PATIENT_NEW]) {
      expect(source(file), file).not.toMatch(/setError\(\s*"/);
    }
  });

  it("blocks Enter only on text-like inputs outside IME composition", () => {
    class FakeInput {
      constructor(public type: string) {}
    }
    vi.stubGlobal("HTMLInputElement", FakeInput);
    for (const file of [CLIENT_NEW, PATIENT_NEW]) {
      const { preventImplicitSubmit } = loadPageHelpers<{
        preventImplicitSubmit: (event: unknown) => void;
      }>(file, ["IMPLICIT_SUBMIT_SAFE_INPUT_TYPES", "preventImplicitSubmit"]);
      const press = (target: unknown, key = "Enter", isComposing = false) => {
        const preventDefault = vi.fn();
        preventImplicitSubmit({
          key,
          target,
          nativeEvent: { isComposing },
          preventDefault,
        });
        return preventDefault.mock.calls.length;
      };
      for (const type of ["text", "email", "tel", "search", "checkbox"]) {
        expect(press(new FakeInput(type)), `${file} ${type}`).toBe(1);
      }
      for (const type of ["submit", "button", "reset", "image"]) {
        expect(press(new FakeInput(type)), `${file} ${type}`).toBe(0);
      }
      expect(press({ tagName: "BUTTON" }), file).toBe(0);
      expect(press({ tagName: "TEXTAREA" }), file).toBe(0);
      expect(press(new FakeInput("text"), "Enter", true), file).toBe(0);
      expect(press(new FakeInput("text"), "a"), file).toBe(0);
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});

describe("microchip cleaning (ISO 11784/11785)", () => {
  // Loaded per test so a renamed helper fails its own tests, not collection.
  const cleanMicrochipInput = (raw: string) => microchipHelpers().cleanMicrochipInput(raw);
  const describeMicrochip = (raw: string) => microchipHelpers().describeMicrochip(raw);
  const microchipHelpers = () =>
    loadPageHelpers<{
      cleanMicrochipInput: (raw: string) => string;
      describeMicrochip: (raw: string) => { kind: string; count?: number };
    }>(PATIENT_NEW, [
      "MICROCHIP_EDGE_NOISE",
      "MICROCHIP_GROUP_SEPARATORS",
      "ISO_MICROCHIP_PATTERN",
      "DIGITS_ONLY_PATTERN",
      "cleanMicrochipInput",
      "describeMicrochip",
    ]);

  it("strips surrounding whitespace and hyphens and collapses ISO grouping", () => {
    expect(cleanMicrochipInput(" 900 164 000 123 456 ")).toBe("900164000123456");
    expect(cleanMicrochipInput("900-164-000-123-456")).toBe("900164000123456");
    expect(cleanMicrochipInput("--900164000123456--")).toBe("900164000123456");
    expect(cleanMicrochipInput("\t900164000123456\r\n")).toBe("900164000123456");
    expect(cleanMicrochipInput("900\u2013164\u2013000\u2013123\u2013456")).toBe(
      "900164000123456",
    );
    expect(cleanMicrochipInput("   ")).toBe("");
    expect(cleanMicrochipInput(" - ")).toBe("");
  });

  it("never rewrites the inside of non-ISO identifiers", () => {
    expect(cleanMicrochipInput(" AVID*012*345*678 ")).toBe("AVID*012*345*678");
    expect(cleanMicrochipInput("-0A01-3956-2A-")).toBe("0A01-3956-2A");
    expect(cleanMicrochipInput("123-456-789")).toBe("123-456-789");
    expect(cleanMicrochipInput("9001640001234567")).toBe("9001640001234567");
  });

  it("classifies chips for the advisory hint", () => {
    expect(describeMicrochip("")).toEqual({ kind: "empty" });
    expect(describeMicrochip("900 164 000 123 456")).toEqual({ kind: "iso" });
    expect(describeMicrochip("123-456-789")).toEqual({ kind: "digits", count: 9 });
    expect(describeMicrochip("9001640001234567")).toEqual({ kind: "digits", count: 16 });
    expect(describeMicrochip("AVID*012*345*678")).toEqual({ kind: "other" });
  });

  it("saves and duplicate-checks the same cleaned value", () => {
    const src = source(PATIENT_NEW);
    expect(src).toContain(
      "const microchipForDuplicateCheck = cleanMicrochipInput(debouncedMicrochip);",
    );
    expect(src).toContain("{ microchipNumber: microchipForDuplicateCheck }");
    expect(src).toContain("enabled: microchipForDuplicateCheck.length >= 5");
    expect(src).toContain(
      "const microchipNumber = cleanMicrochipInput(form.microchipNumber);",
    );
    expect(src).toContain("microchipNumber: microchipNumber || undefined,");
    // The chip stays optional: no hard ISO requirement blocks legacy chips.
    expect(src).not.toMatch(/canSubmit[^;]*ISO_MICROCHIP_PATTERN/);
  });
});

describe("client contact validation", () => {
  const contactHelpers = () =>
    loadPageHelpers<{
      isClientEmailFormatValid: (value: string) => boolean;
      formatE164ForDisplay: (e164: string) => string;
    }>(CLIENT_NEW, [
      "CLIENT_EMAIL_PATTERN",
      "isClientEmailFormatValid",
      "formatE164ForDisplay",
    ]);
  const isClientEmailFormatValid = (value: string) =>
    contactHelpers().isClientEmailFormatValid(value);
  const formatE164ForDisplay = (e164: string) =>
    contactHelpers().formatE164ForDisplay(e164);

  it("accepts exactly the emails the clients router accepts", () => {
    const serverEmail = z.string().trim().email();
    const samples = [
      "name@example.com",
      " padded@example.com ",
      "first.last+tag@clinic.sk",
      "o'brien@example.ie",
      "user@sub.example.co.uk",
      "user@clinic",
      "a@b.c",
      "name@@example.com",
      ".lead@example.com",
      "trail.@example.com",
      "two..dots@example.com",
      "user@-example.com",
      "ľubo@example.sk",
      "no-at-sign.example.com",
    ];
    for (const sample of samples) {
      expect(isClientEmailFormatValid(sample), sample).toBe(
        serverEmail.safeParse(sample).success,
      );
    }
    expect(isClientEmailFormatValid("")).toBe(true);
    expect(isClientEmailFormatValid("   ")).toBe(true);
  });

  it("shows how national and international numbers will be texted", () => {
    const display = (raw: string) => {
      const e164 = normalizeE164(raw);
      return e164 ? formatE164ForDisplay(e164) : null;
    };
    expect(display("0905 123 456")).toBe("+421 905 123 456");
    expect(display("905123456")).toBe("+421 905 123 456");
    expect(display("00421 905 123 456")).toBe("+421 905 123 456");
    expect(display("+421 905 123 456")).toBe("+421 905 123 456");
    expect(display("02/1234 5678")).toBe("+421212345678");
    expect(display("(415) 555-0142")).toBe("+1 415 555 0142");
    expect(display("+420 602 123 456")).toBe("+420602123456");
    // Too short to text: the form warns but still saves the phone number.
    expect(display("555-0142")).toBeNull();
  });
});

describe("duplicate merge review", () => {
  it("locks the merge dialog and review controls while a merge is running", () => {
    const src = source(DUPLICATES);
    expect(src).toContain(
      "const mergeLocked = mergePatient.isPending || mergePatient.isSuccess;",
    );
    expect(src).toMatch(
      /onEscapeKeyDown=\{\(event\) => \{\s*if \(mergeLocked\) event\.preventDefault\(\);/,
    );
    expect(src).toMatch(
      /onInteractOutside=\{\(event\) => \{\s*if \(mergeLocked\) event\.preventDefault\(\);/,
    );
    expect(src).toMatch(/const closeReview = \(\) => \{\s*if \(mergeLocked\) return;/);
    expect(src).toMatch(/const openReview = \(next: MergeSelection\) => \{\s*if \(mergeLocked\) return;/);
    expect(src).toContain("if (!open) closeReview();");
    expect(src).toContain("locked={mergeLocked}");
    expect(src).toContain("disabled={!canReview || locked}");
    expect(src.match(/disabled=\{mergeLocked\}/g)?.length).toBe(3);
    expect(src).toContain("!mergeLocked;");
  });

  it("redirects to the merged-into chart from the mutation variables", () => {
    const src = source(DUPLICATES);
    expect(src).toContain("onSuccess: async (_merged, variables) => {");
    expect(src).toContain("router.push(`/patients/${variables.keepId}?merged=1`);");
    expect(src).not.toContain("const keepId = selection?.keepId;");
  });

  it("keeps the typed MERGE intent, reason bounds and a single operation token", () => {
    const src = source(DUPLICATES);
    expect(src).toContain("confirmation === MERGE_CONFIRMATION &&");
    expect(src).toContain("trimmedReason.length >= MERGE_REASON_MIN_LENGTH &&");
    expect(src).toContain("trimmedReason.length <= MERGE_REASON_MAX_LENGTH &&");
    expect(src).toContain("minLength={MERGE_REASON_MIN_LENGTH}");
    expect(src).toContain("maxLength={MERGE_REASON_MAX_LENGTH}");
    expect(src.match(/crypto\.randomUUID\(\)/g)?.length).toBe(1);
    expect(src.match(/operationId\.current = null;/g)?.length).toBe(2);
    // The token is only reset by a new selection or a success, never by an error.
    const onError = src.match(/onError: \(error\) => \{([\s\S]*?)\n    \},/)?.[1] ?? "";
    expect(onError).toContain("toast.error(error.message);");
    expect(onError).toContain("mergeRequestLockRef.current = false;");
    expect(onError).not.toContain("operationId.current");
    // A synchronous guard stops a double click from sending the operation twice.
    const submit = src.match(/const submitMerge = \(\) => \{([\s\S]*?)\n  \};/)?.[1] ?? "";
    expect(submit).toContain("if (!selection || !canMerge || mergeRequestLockRef.current) return;");
    expect(submit.indexOf("mergeRequestLockRef.current = true;")).toBeLessThan(
      submit.indexOf("mergePatient.mutate("),
    );
  });

  it("flags conflicting identity evidence without second-guessing the server", () => {
    const { identityMismatches } = loadPageHelpers<{
      identityMismatches: (keep: object, retire: object) => string[];
    }>(DUPLICATES, ["compactIdentifier", "baseSex", "identityMismatches"]);
    const chart = {
      species: "canine",
      sex: "male",
      dob: "2019-04-01",
      microchipNumber: "900164000123456",
      externalSource: "vetis",
      externalId: "A-17",
    };
    expect(identityMismatches(chart, { ...chart })).toEqual([]);
    expect(identityMismatches(chart, { ...chart, sex: "male_neutered" })).toEqual([]);
    expect(
      identityMismatches(chart, { ...chart, microchipNumber: "900 164 000 123 456" }),
    ).toEqual([]);
    expect(identityMismatches(chart, { ...chart, externalSource: "VETIS" })).toEqual([]);
    expect(identityMismatches(chart, { ...chart, dob: null, microchipNumber: null })).toEqual(
      [],
    );
    expect(
      identityMismatches(chart, {
        species: "feline",
        sex: "female_spayed",
        dob: "2020-01-01",
        microchipNumber: "900164000999999",
        externalSource: "vetis",
        externalId: "B-2",
      }),
    ).toEqual(["species", "sex", "dob", "microchip", "externalId"]);
  });

  it("filters candidate groups by owner, patient or microchip, ignoring accents", () => {
    const { groupMatchesFilter } = loadPageHelpers<{
      groupMatchesFilter: (group: object, query: string) => boolean;
    }>(DUPLICATES, ["compactIdentifier", "searchableText", "groupMatchesFilter"]);
    const group = {
      clientFirstName: "Ján",
      clientLastName: "Novák",
      patients: [
        { name: "Micka", microchipNumber: "900164000123456" },
        { name: "Micka", microchipNumber: null },
      ],
    };
    expect(groupMatchesFilter(group, "")).toBe(true);
    expect(groupMatchesFilter(group, "novak")).toBe(true);
    expect(groupMatchesFilter(group, "NOVÁK")).toBe(true);
    expect(groupMatchesFilter(group, "jan nov")).toBe(true);
    expect(groupMatchesFilter(group, "mick")).toBe(true);
    expect(groupMatchesFilter(group, "900 164")).toBe(true);
    expect(groupMatchesFilter(group, "rex")).toBe(false);
  });
});

describe("intake and duplicate i18n coverage", () => {
  const en = JSON.parse(source("messages/en.json")) as Record<string, unknown>;
  const sk = JSON.parse(source("messages/sk.json")) as Record<string, unknown>;

  it("resolves every literal t() key on the three pages in both locales", () => {
    for (const file of PAGES) {
      const keys = [...source(file).matchAll(/\bt\(\s*"([^"]+)"/g)].map(
        (match) => match[1],
      );
      expect(keys.length, file).toBeGreaterThan(20);
      for (const key of keys) {
        expect(typeof lookup(en, key), `${file} en:${key}`).toBe("string");
        expect(typeof lookup(sk, key), `${file} sk:${key}`).toBe("string");
      }
    }
  });

  it("labels every merge check the server can report, symmetrically", () => {
    const router = source("server/routers/patients.ts");
    const fieldsOf = (typeName: string) => {
      const body = router.match(new RegExp(`type ${typeName} = \\{([\\s\\S]*?)\\};`))?.[1];
      expect(body, typeName).toBeTruthy();
      return [...body!.matchAll(/^\s*(\w+):/gm)].map((match) => match[1]);
    };
    const serverKeys = [
      ...fieldsOf("MergeBlockerCounts"),
      ...fieldsOf("MergeMovableCounts"),
    ].sort();
    expect(serverKeys.length).toBeGreaterThan(30);
    expect(Object.keys(lookup(en, "patients.duplicates.counts") as object).sort()).toEqual(
      serverKeys,
    );
    expect(Object.keys(lookup(sk, "patients.duplicates.counts") as object).sort()).toEqual(
      serverKeys,
    );
  });

  it("keeps the new intake and duplicate subtrees leaf-symmetric", () => {
    for (const subtree of [
      "clients.form.sections",
      "clients.form.phoneHint",
      "clients.form.validation",
      "patients.form.sections",
      "patients.form.microchipHint",
      "patients.form.validation",
      "patients.duplicates",
    ]) {
      const enLeaves = leafPaths(lookup(en, subtree)).sort();
      const skLeaves = leafPaths(lookup(sk, subtree)).sort();
      expect(enLeaves.length, subtree).toBeGreaterThan(0);
      expect(skLeaves, subtree).toEqual(enLeaves);
    }
  });
});
