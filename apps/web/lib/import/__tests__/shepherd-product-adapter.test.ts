import { describe, expect, it } from "vitest";
import { adaptShepherdProducts } from "../shepherd-product-adapter";

const types = [
  { ID: "type-product", Name: "Product" },
  { ID: "type-medication", Name: "Medication" },
  { ID: "type-vaccine", Name: "Vaccine" },
  { ID: "type-service", Name: "Service" },
];

const categories = [{ ID: "category-1", Name: "Clinic supplies" }];

function product(overrides: Record<string, string> = {}) {
  return {
    ID: "product-1",
    Name: "Synthetic catalog item",
    ProductCategoryID: "category-1",
    ProductTypeID: "type-product",
    ClinicID: "clinic-1",
    Price: "12.5",
    IsActive: "true",
    IsDeleted: "false",
    IsTaxable: "true",
    CustomID: "SKU-1",
    ...overrides,
  };
}

describe("Shepherd product adapter", () => {
  it("imports stock-bearing catalog entries without inventing inventory", () => {
    const result = adaptShepherdProducts({
      product: [
        product(),
        product({
          ID: "med-1",
          Name: "Synthetic medication",
          ProductTypeID: "type-medication",
          CustomID: "MED-1",
        }),
        product({
          ID: "vax-1",
          Name: "Synthetic vaccine",
          ProductTypeID: "type-vaccine",
          CustomID: "VAX-1",
        }),
      ],
      product_type: types,
      product_category: categories,
    });

    expect(result.coverage).toEqual({
      sourceRows: 3,
      plannedRows: 3,
      deferredRows: 0,
      excludedRows: 0,
      errorRows: 0,
    });
    expect(result.products).toEqual([
      expect.objectContaining({
        externalProductId: "product-1",
        sourceType: "product",
        category: "Clinic supplies",
        unitPrice: "12.50",
      }),
      expect.objectContaining({ sourceType: "medication" }),
      expect.objectContaining({ sourceType: "vaccine" }),
    ]);
  });

  it("excludes services and inactive/deleted rows", () => {
    const result = adaptShepherdProducts({
      product: [
        product({ ID: "service-1", ProductTypeID: "type-service" }),
        product({ ID: "inactive-1", IsActive: "false" }),
        product({ ID: "deleted-1", IsDeleted: "true" }),
      ],
      product_type: types,
      product_category: categories,
    });

    expect(result.products).toHaveLength(0);
    expect(result.coverage).toEqual({
      sourceRows: 3,
      plannedRows: 0,
      deferredRows: 0,
      excludedRows: 3,
      errorRows: 0,
    });
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "service_excluded",
      "inactive_product_excluded",
      "deleted_product_excluded",
    ]);
  });

  it("defers duplicate catalog identities and fails malformed values", () => {
    const result = adaptShepherdProducts({
      product: [
        product(),
        product({ ID: "product-2", CustomID: "SKU-2" }),
        product({ ID: "bad-price", Name: "Bad price", Price: "not-money" }),
      ],
      product_type: types,
      product_category: categories,
    });

    expect(result.products).toHaveLength(0);
    expect(result.coverage).toEqual({
      sourceRows: 3,
      plannedRows: 0,
      deferredRows: 2,
      excludedRows: 0,
      errorRows: 1,
    });
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "conflicting_product_identity" }),
        expect.objectContaining({ code: "invalid_product_price" }),
      ]),
    );
  });
});
