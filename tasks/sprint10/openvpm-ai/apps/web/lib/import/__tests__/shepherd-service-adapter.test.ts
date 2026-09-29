import { describe, expect, it } from "vitest";
import { adaptShepherdServices } from "../shepherd-service-adapter";

describe("Shepherd service adapter", () => {
  it("imports only unambiguous active services and accounts for every row", () => {
    const result = adaptShepherdServices({
      product_type: [
        { ID: "service", Name: "Service" },
        { ID: "product", Name: "Product" },
      ],
      product_category: [{ ID: "exam", Name: "Exams" }],
      product: [
        {
          ID: "svc-1",
          Name: "Wellness exam",
          ProductTypeID: "service",
          ProductCategoryID: "exam",
          Price: "75",
          IsActive: "true",
          IsTaxable: "false",
        },
        {
          ID: "svc-2",
          Name: "Duplicate service",
          ProductTypeID: "service",
          ProductCategoryID: "exam",
          Price: "10.00",
          IsActive: "true",
        },
        {
          ID: "svc-3",
          Name: "duplicate  service",
          ProductTypeID: "service",
          ProductCategoryID: "exam",
          Price: "20.00",
          IsActive: "true",
        },
        {
          ID: "product-1",
          Name: "Stock item",
          ProductTypeID: "product",
          Price: "5.00",
          IsActive: "true",
        },
        {
          ID: "svc-4",
          Name: "Inactive service",
          ProductTypeID: "service",
          Price: "5.00",
          IsActive: "false",
        },
        {
          ID: "svc-5",
          Name: "Deleted service",
          ProductTypeID: "service",
          Price: "5.00",
          IsActive: "true",
          IsDeleted: "true",
        },
        {
          ID: "svc-6",
          Name: "Invalid price",
          ProductTypeID: "service",
          Price: "unknown",
          IsActive: "true",
        },
      ],
    });

    expect(result.services).toEqual([
      {
        externalServiceId: "svc-1",
        name: "Wellness exam",
        code: undefined,
        category: "Exams",
        defaultPrice: "75.00",
        taxable: false,
      },
    ]);
    expect(result.coverage).toEqual({
      sourceRows: 7,
      plannedRows: 1,
      deferredRows: 2,
      excludedRows: 3,
      errorRows: 1,
    });
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "conflicting_service_identity",
      "conflicting_service_identity",
      "non_service_catalog_item_excluded",
      "inactive_service_excluded",
      "deleted_service_excluded",
      "invalid_service_price",
    ]);
  });

  it("rejects an unrepresentable price instead of rounding it", () => {
    const result = adaptShepherdServices({
      product_type: [{ ID: "service", Name: "Service" }],
      product: [
        {
          ID: "svc-1",
          Name: "Synthetic service",
          ProductTypeID: "service",
          Price: "12.345",
          IsActive: "true",
        },
      ],
    });

    expect(result.services).toEqual([]);
    expect(result.coverage.errorRows).toBe(1);
    expect(result.issues[0]?.code).toBe("invalid_service_price");
  });
});
