import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Storage classification for tenant-owned data.
 *
 * These labels describe the minimum handling requirement. They are metadata,
 * not an authorization boundary: tenant isolation, RBAC, and explicit route
 * authorization remain mandatory for every read and write.
 */
export const DATA_SENSITIVITY_LEVELS = [
  "PUBLIC",
  "INTERNAL",
  "CONFIDENTIAL",
  "STRICTLY_CONFIDENTIAL",
] as const;

export type DataSensitivityLevel = (typeof DATA_SENSITIVITY_LEVELS)[number];

export const dataSensitivityLevelEnum = pgEnum(
  "data_sensitivity_level",
  DATA_SENSITIVITY_LEVELS,
);

/**
 * Default classifications for the domain entities covered by the first
 * policy migration. Owners are represented by the `clients` table and an
 * encounter header is represented by `appointments` in the current schema.
 */
export const DEFAULT_DATA_SENSITIVITY_LEVELS = {
  clients: "CONFIDENTIAL",
  patients: "STRICTLY_CONFIDENTIAL",
  appointments: "STRICTLY_CONFIDENTIAL",
  soapNotes: "STRICTLY_CONFIDENTIAL",
} as const satisfies Record<string, DataSensitivityLevel>;
