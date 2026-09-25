/**
 * Sprint 27 — Schema Validation Middleware.
 *
 * Master catalog of VPM input contracts, vendored 1:1 from the
 * `openvpm/schemas` master registry (`REGISTRY_SOURCE`). Contract ids,
 * versions and schema bodies must stay aligned with that registry; local
 * divergence is a defect. When the remote registry gains a new revision,
 * bump `version` and replace the schema body here.
 *
 * All schemas are JSON Schema draft-07, compiled with Ajv (`validator.ts`).
 */

import type { ContractDescriptor, SchemaContractId } from "./types";

export const REGISTRY_SOURCE = "openvpm/schemas@master";

export const SCHEMA_DIALECT = "http://json-schema.org/draft-07/schema#";

const UUID_PATTERN =
  "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";

const PHONE_PATTERN = "^\\+?[0-9][0-9 ]{7,15}$";

const ORIGIN_BLOCK = {
  type: "object",
  description: "Provenance of the payload (who or what produced it).",
  properties: {
    source: {
      type: "string",
      enum: ["manual", "ai", "ai-prefill", "import", "integration"],
    },
    createdBy: { type: "string", pattern: UUID_PATTERN },
  },
  required: ["source"],
  additionalProperties: false,
} as const;

export const CONTRACTS: Record<SchemaContractId, ContractDescriptor> = {
  "openvpm.client-registration": {
    id: "openvpm.client-registration",
    version: "1.0.0",
    title: "Client registration",
    description:
      "Owner (client) registration intake contract used by the front desk and portal onboarding.",
    source: REGISTRY_SOURCE,
    riskClass: "low",
    guardrails: [],
    schema: {
      $schema: SCHEMA_DIALECT,
      $id: "openvpm.client-registration@1.0.0",
      type: "object",
      properties: {
        firstName: { type: "string", minLength: 1, maxLength: 120 },
        lastName: { type: "string", minLength: 1, maxLength: 120 },
        email: { type: "string", format: "email", maxLength: 254 },
        phone: { type: "string", pattern: PHONE_PATTERN },
        address: {
          type: "object",
          properties: {
            street: { type: "string", maxLength: 200 },
            city: { type: "string", maxLength: 120 },
            zip: { type: "string", pattern: "^[0-9]{3} ?[0-9]{2}$" },
          },
          additionalProperties: false,
        },
        marketingConsent: { type: "boolean" },
        origin: ORIGIN_BLOCK,
      },
      required: ["firstName", "lastName", "email", "phone"],
      additionalProperties: false,
    },
  },

  "openvpm.patient-registration": {
    id: "openvpm.patient-registration",
    version: "1.0.0",
    title: "Patient registration",
    description:
      "Patient (animal) chart creation contract, including identity, species and lifecycle status.",
    source: REGISTRY_SOURCE,
    riskClass: "low",
    guardrails: [],
    schema: {
      $schema: SCHEMA_DIALECT,
      $id: "openvpm.patient-registration@1.0.0",
      type: "object",
      properties: {
        clientId: { type: "string", pattern: UUID_PATTERN },
        name: { type: "string", minLength: 1, maxLength: 120 },
        species: {
          type: "string",
          enum: [
            "dog",
            "cat",
            "rabbit",
            "rodent",
            "bird",
            "reptile",
            "horse",
            "farm",
            "exotic",
            "other",
          ],
        },
        breed: { type: "string", maxLength: 120 },
        sex: { type: "string", enum: ["male", "female", "unknown"] },
        dateOfBirth: { type: "string", format: "date" },
        weightKg: { type: "number", exclusiveMinimum: 0, maximum: 2000 },
        chipNumber: { type: "string", maxLength: 64 },
        status: {
          type: "string",
          enum: ["active", "deceased", "transferred"],
        },
        origin: ORIGIN_BLOCK,
      },
      required: ["clientId", "name", "species"],
      additionalProperties: false,
    },
  },

  "openvpm.vaccination-record": {
    id: "openvpm.vaccination-record",
    version: "1.0.0",
    title: "Vaccination record",
    description:
      "Preventive care vaccination entry, including rabies tag evidence for statutory reporting.",
    source: REGISTRY_SOURCE,
    riskClass: "low",
    guardrails: [],
    schema: {
      $schema: SCHEMA_DIALECT,
      $id: "openvpm.vaccination-record@1.0.0",
      type: "object",
      properties: {
        patientId: { type: "string", pattern: UUID_PATTERN },
        vaccineName: { type: "string", minLength: 1, maxLength: 200 },
        productName: { type: "string", maxLength: 200 },
        dateAdministered: { type: "string", format: "date" },
        nextDue: { type: "string", format: "date" },
        lotNumber: { type: "string", maxLength: 64 },
        manufacturer: { type: "string", maxLength: 120 },
        rabiesTagNumber: { type: "string", maxLength: 64 },
        administeredBy: { type: "string", pattern: UUID_PATTERN },
        origin: ORIGIN_BLOCK,
      },
      required: ["patientId", "vaccineName", "dateAdministered"],
      additionalProperties: false,
    },
  },

  "openvpm.prescription-order": {
    id: "openvpm.prescription-order",
    version: "1.0.0",
    title: "Prescription order",
    description:
      "Medication prescription input contract. AI-assisted prescriptions must stay draft until a veterinarian signs them (Zákon 39/2007 Z. z.) and narcotic-class substances are never AI-prefilled (Zákon 139/1998 Z. z.).",
    source: REGISTRY_SOURCE,
    riskClass: "low",
    legalBasis: "Zákon 39/2007 Z. z.; Zákon 139/1998 Z. z.",
    guardrails: ["ai-draft-only", "narcotic-zero-ai-prefill"],
    schema: {
      $schema: SCHEMA_DIALECT,
      $id: "openvpm.prescription-order@1.0.0",
      type: "object",
      properties: {
        patientId: { type: "string", pattern: UUID_PATTERN },
        medication: { type: "string", minLength: 1, maxLength: 200 },
        dosage: { type: "string", minLength: 1, maxLength: 200 },
        frequency: { type: "string", minLength: 1, maxLength: 200 },
        quantity: { type: "number", exclusiveMinimum: 0, maximum: 100000 },
        refills: { type: "integer", minimum: 0, maximum: 12 },
        instructions: { type: "string", maxLength: 2000 },
        status: {
          type: "string",
          enum: ["draft", "active", "completed", "cancelled"],
        },
        patientStatus: {
          type: "string",
          enum: ["active", "deceased", "transferred"],
        },
        origin: ORIGIN_BLOCK,
      },
      required: ["patientId", "medication", "dosage", "frequency", "quantity"],
      additionalProperties: false,
    },
  },

  "openvpm.controlled-substance-record": {
    id: "openvpm.controlled-substance-record",
    version: "1.0.0",
    title: "Controlled substance record",
    description:
      "Narcotic and controlled substance administration entry (Zákon 139/1998 Z. z.). Ketamine, opioids and propofol accept manual entry only — AI prefill is rejected outright.",
    source: REGISTRY_SOURCE,
    riskClass: "low",
    legalBasis: "Zákon 139/1998 Z. z.",
    guardrails: ["narcotic-zero-ai-prefill"],
    schema: {
      $schema: SCHEMA_DIALECT,
      $id: "openvpm.controlled-substance-record@1.0.0",
      type: "object",
      properties: {
        patientId: { type: "string", pattern: UUID_PATTERN },
        encounterId: { type: "string", pattern: UUID_PATTERN },
        substance: { type: "string", minLength: 1, maxLength: 200 },
        quantity: { type: "number", exclusiveMinimum: 0, maximum: 100000 },
        unit: {
          type: "string",
          enum: ["mg", "ml", "ug", "mcg", "g", "ks", "patch"],
        },
        reason: { type: "string", minLength: 1, maxLength: 1000 },
        recordedBy: { type: "string", pattern: UUID_PATTERN },
        administeredAt: { type: "string", format: "date-time" },
        origin: ORIGIN_BLOCK,
      },
      required: ["patientId", "substance", "quantity", "unit", "reason", "recordedBy"],
      additionalProperties: false,
    },
  },

  "openvpm.lab-result-import": {
    id: "openvpm.lab-result-import",
    version: "1.0.0",
    title: "Lab result import",
    description:
      "External laboratory result import contract (HL7/CSV gateway output) before chart attachment.",
    source: REGISTRY_SOURCE,
    riskClass: "low",
    guardrails: [],
    schema: {
      $schema: SCHEMA_DIALECT,
      $id: "openvpm.lab-result-import@1.0.0",
      type: "object",
      properties: {
        patientId: { type: "string", pattern: UUID_PATTERN },
        sourceLab: { type: "string", minLength: 1, maxLength: 200 },
        collectedAt: { type: "string", format: "date-time" },
        externalId: { type: "string", maxLength: 120 },
        results: {
          type: "array",
          minItems: 1,
          maxItems: 500,
          items: {
            type: "object",
            properties: {
              testName: { type: "string", minLength: 1, maxLength: 200 },
              value: { type: ["string", "number"] },
              unit: { type: "string", maxLength: 60 },
              refRangeLow: { type: "number" },
              refRangeHigh: { type: "number" },
              status: {
                type: "string",
                enum: ["normal", "abnormal", "critical", "unknown"],
              },
            },
            required: ["testName", "value"],
            additionalProperties: false,
          },
        },
        origin: ORIGIN_BLOCK,
      },
      required: ["patientId", "sourceLab", "results"],
      additionalProperties: false,
    },
  },

  "openvpm.care-reminder": {
    id: "openvpm.care-reminder",
    version: "1.0.0",
    title: "Care reminder",
    description:
      "Care reminder scheduling contract. The Sympathy Gate suppresses all automated outreach for deceased patients.",
    source: REGISTRY_SOURCE,
    riskClass: "low",
    guardrails: ["sympathy-gate"],
    schema: {
      $schema: SCHEMA_DIALECT,
      $id: "openvpm.care-reminder@1.0.0",
      type: "object",
      properties: {
        patientId: { type: "string", pattern: UUID_PATTERN },
        title: { type: "string", minLength: 1, maxLength: 200 },
        dueDate: { type: "string", format: "date" },
        notes: { type: "string", maxLength: 2000 },
        automated: { type: "boolean" },
        channels: {
          type: "array",
          maxItems: 2,
          items: { type: "string", enum: ["email", "sms"] },
        },
        patientStatus: {
          type: "string",
          enum: ["active", "deceased", "transferred"],
        },
        origin: ORIGIN_BLOCK,
      },
      required: ["patientId", "title", "dueDate"],
      additionalProperties: false,
    },
  },

  "openvpm.ai-clinical-suggestion": {
    id: "openvpm.ai-clinical-suggestion",
    version: "1.0.0",
    title: "AI clinical suggestion",
    description:
      "AI-generated clinical content envelope. Status is locked to `draft` by schema (Zákon 39/2007 Z. z.) — a veterinarian must review and sign before anything leaves draft.",
    source: REGISTRY_SOURCE,
    riskClass: "low",
    legalBasis: "Zákon 39/2007 Z. z.",
    guardrails: ["ai-draft-only", "sympathy-gate"],
    schema: {
      $schema: SCHEMA_DIALECT,
      $id: "openvpm.ai-clinical-suggestion@1.0.0",
      type: "object",
      properties: {
        patientId: { type: "string", pattern: UUID_PATTERN },
        suggestionType: {
          type: "string",
          enum: [
            "diagnosis",
            "treatment_plan",
            "prescription",
            "care_reminder",
            "discharge_summary",
          ],
        },
        content: { type: "string", minLength: 1, maxLength: 20000 },
        status: { type: "string", enum: ["draft"] },
        signature: { type: "null" },
        modelId: { type: "string", maxLength: 120 },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        patientStatus: {
          type: "string",
          enum: ["active", "deceased", "transferred"],
        },
        origin: ORIGIN_BLOCK,
      },
      required: ["patientId", "suggestionType", "content", "status"],
      additionalProperties: false,
    },
  },
};

export const CONTRACT_IDS = Object.keys(CONTRACTS) as SchemaContractId[];
