import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const documentImportSource = readFileSync(
  new URL("../historical-document-import.ts", import.meta.url),
  "utf8",
);
const productImportSource = readFileSync(
  new URL("../product-import.ts", import.meta.url),
  "utf8",
);
const inventoryRouterSource = readFileSync(
  new URL("../../../server/routers/inventory.ts", import.meta.url),
  "utf8",
);

describe("reviewed Shepherd migration safety", () => {
  it("commits the document reservation before object I/O and links only after verification", () => {
    const reserve = documentImportSource.indexOf(
      "const reservation = await withSystem",
    );
    const providerWrite = documentImportSource.indexOf(
      "await putAndVerifyManagedUpload",
    );
    const finalize = documentImportSource.indexOf(
      "await finalizeManagedUploadManifest",
    );
    const link = documentImportSource.indexOf(".insert(historicalDocuments)");

    expect(reserve).toBeGreaterThan(-1);
    expect(providerWrite).toBeGreaterThan(reserve);
    expect(finalize).toBeGreaterThan(providerWrite);
    expect(link).toBeGreaterThan(finalize);
    expect(documentImportSource).toContain('linkStatus: "needs_review"');
    expect(documentImportSource).toContain('entityType: "practice"');
    expect(documentImportSource).not.toContain("patientId: input.patientId");
  });

  it("accepts only bounded allowlisted document bodies and opaque identities", () => {
    expect(documentImportSource).toContain('"application/pdf"');
    expect(documentImportSource).toContain('"image/jpeg"');
    expect(documentImportSource).toContain('"image/png"');
    expect(documentImportSource).toContain('"text/plain"');
    expect(documentImportSource).toContain("UPLOAD_FILE_MAX_BYTES");
    expect(documentImportSource).toContain("/^[0-9a-f]{64}$/");
    expect(documentImportSource).toContain(
      "/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/",
    );
    expect(documentImportSource).toContain("checksumSha256Hex(input.body)");
  });

  it("imports products as untracked and requires an explicit opening count", () => {
    expect(productImportSource).toContain("inventoryTracked: false");
    expect(productImportSource).toContain("stockQuantity: 0");
    expect(productImportSource).toContain("reorderPoint: null");
    expect(productImportSource).toContain("if (!practice.recoveryHold)");
    expect(inventoryRouterSource).toContain("startTracking:");
    expect(inventoryRouterSource).toContain(
      "Start stock tracking with a reviewed opening quantity",
    );
    expect(inventoryRouterSource).toContain(
      "eq(products.inventoryTracked, true)",
    );
  });
});
