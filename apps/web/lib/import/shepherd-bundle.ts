import { normalizeKey } from "@/lib/csv/parse";

/**
 * Public, PHI-free Shepherd export contract.
 *
 * A Shepherd full export contains hundreds of relational CSV tables. File
 * names are not stable enough to be an identity, so the operator importer
 * recognizes tables from their normalized header contract and fails closed
 * when a table is missing or ambiguous. No clinic values belong here.
 */
export type ShepherdTableKind =
  | "client"
  | "client_address"
  | "client_phone"
  | "client_patient"
  | "client_coowner"
  | "client_coowner_phone"
  | "patient"
  | "species"
  | "breed"
  | "sex"
  | "patient_status"
  | "appointment"
  | "appointment_status"
  | "appointment_type"
  | "appointment_patient"
  | "soap"
  | "soap_status"
  | "soap_subjective"
  | "soap_assessment"
  | "soap_plan"
  | "soap_vitals"
  | "soap_treatment"
  | "vaccination"
  | "reminder"
  | "reminder_setting"
  | "prescription"
  | "refill"
  | "product"
  | "product_type"
  | "product_category"
  | "clinic_product"
  | "inventory_lot"
  | "media"
  | "patient_media"
  | "vaccination_media"
  | "soap_media"
  | "lab_order"
  | "lab_media"
  | "invoice"
  | "invoice_item"
  | "payment"
  | "payment_allocation";

interface ShepherdTableSignature {
  kind: ShepherdTableKind;
  required: readonly string[];
  forbidden?: readonly string[];
}

const SIGNATURES: readonly ShepherdTableSignature[] = [
  {
    kind: "client",
    required: ["id", "firstname", "lastname", "clientstatusid", "deleted"],
    forbidden: ["patientid"],
  },
  {
    kind: "client_address",
    required: ["clientid", "address", "city", "zipcode", "state"],
  },
  {
    kind: "client_phone",
    required: ["id", "clientid", "phonenumber", "phonetypeid", "isprimary"],
  },
  {
    kind: "client_patient",
    required: ["id", "clientid", "patientid", "clinicid", "groupid"],
    forbidden: ["datecreatedby"],
  },
  {
    kind: "client_coowner",
    required: ["clientid", "firstname", "lastname", "email"],
    forbidden: ["patientid", "appointmentid"],
  },
  {
    kind: "client_coowner_phone",
    required: [
      "id",
      "clientcoownerid",
      "phonenumber",
      "phonetypeid",
      "isprimary",
    ],
  },
  {
    kind: "patient",
    required: [
      "id",
      "name",
      "sexid",
      "dateofbirth",
      "breedid",
      "microchipnumber",
      "isdeceased",
    ],
  },
  {
    kind: "species",
    required: ["id", "name", "abrv", "hasbreeds", "allbreedslegacy"],
  },
  {
    kind: "breed",
    required: ["id", "name", "abrv", "speciesid", "legacyremoved"],
  },
  {
    kind: "sex",
    required: ["id", "description", "sortorder", "abrv", "name"],
    forbidden: ["appointmentid", "soapid"],
  },
  {
    kind: "patient_status",
    required: ["id", "description", "sortorder", "abrv", "name"],
    forbidden: ["appointmentid", "soapid", "previousappointmentstatusid"],
  },
  {
    kind: "appointment",
    required: [
      "id",
      "clientid",
      "providerid",
      "appointmenttypeid",
      "appointmentstatusid",
      "visitreason",
      "startdate",
      "enddate",
    ],
  },
  {
    kind: "appointment_status",
    required: ["id", "description", "sortorder", "abrv", "name"],
    forbidden: ["patientstatusid", "soapstatusid"],
  },
  {
    kind: "appointment_type",
    required: ["id", "clinicid", "name", "duration", "isdeleted"],
  },
  {
    kind: "appointment_patient",
    required: ["id", "appointmentid", "patientid", "soapid"],
  },
  {
    kind: "soap",
    required: [
      "id",
      "createdbyuserid",
      "soapstatusid",
      "patientid",
      "title",
      "datelocked",
    ],
  },
  {
    kind: "soap_status",
    required: ["id", "description", "sortorder", "abrv", "name"],
    forbidden: ["appointmentid", "patientid"],
  },
  {
    kind: "soap_subjective",
    required: [
      "soapid",
      "initialcomplaint",
      "currentmedicationinfo",
      "history",
    ],
  },
  {
    kind: "soap_assessment",
    required: ["soapid", "description", "prognosislowid", "prognosishighid"],
  },
  {
    kind: "soap_plan",
    required: ["soapid", "recommendation", "keywords"],
  },
  {
    kind: "soap_vitals",
    required: [
      "id",
      "soapobjectiveid",
      "pulse",
      "respiratoryrate",
      "weight",
      "temperature",
    ],
  },
  {
    kind: "soap_treatment",
    required: [
      "id",
      "soapplanid",
      "productid",
      "name",
      "additionalinstruction",
      "quantity",
      "dose",
      "isdeclined",
    ],
  },
  {
    kind: "vaccination",
    required: [
      "id",
      "patientid",
      "productid",
      "vaccinename",
      "administrationdate",
      "duedate",
      "lotnumber",
    ],
  },
  {
    kind: "reminder",
    required: [
      "id",
      "clientid",
      "patientid",
      "remindersettingid",
      "iscompleted",
      "datedue",
    ],
  },
  {
    kind: "reminder_setting",
    required: ["id", "triggerproductid", "name", "duedate", "timeunitid"],
  },
  {
    kind: "prescription",
    required: [
      "id",
      "prescribingdoctorid",
      "patientid",
      "productid",
      "quantity",
      "direction",
      "iscanceled",
      "ischronicmedication",
    ],
  },
  {
    kind: "refill",
    required: [
      "id",
      "refillid",
      "prescriptionid",
      "refillstatusid",
      "quantitydispensed",
      "datefilled",
    ],
  },
  {
    kind: "product",
    required: [
      "id",
      "name",
      "productcategoryid",
      "producttypeid",
      "clinicid",
      "price",
      "isactive",
      "isdeleted",
    ],
  },
  {
    kind: "product_type",
    required: ["id", "description", "sortorder", "abrv", "name"],
    forbidden: ["patientid", "appointmentid", "soapid"],
  },
  {
    kind: "product_category",
    required: ["id", "name", "isactive", "isdeleted", "parentid"],
  },
  {
    kind: "clinic_product",
    required: [
      "id",
      "productid",
      "clinicid",
      "price",
      "includedinmedicalrecord",
      "inventoryproductsettingid",
    ],
  },
  {
    kind: "inventory_lot",
    required: [
      "id",
      "inventoryproductsettingid",
      "currentquantity",
      "lotnumber",
      "lotexpirationdate",
    ],
  },
  {
    kind: "media",
    required: [
      "id",
      "filename",
      "fileextension",
      "relativepath",
      "filesize",
      "vfsprovidertype",
    ],
    forbidden: ["mediavaultentryid"],
  },
  {
    kind: "patient_media",
    required: ["id", "patientid", "mediavaultentryid", "isdeleted"],
  },
  {
    kind: "vaccination_media",
    required: ["id", "patientid", "patientvaccineid", "mediavaultentryid"],
  },
  {
    kind: "soap_media",
    required: [
      "id",
      "soapassessmentid",
      "mediavaultentryid",
      "soapassessmenttype",
    ],
  },
  {
    kind: "lab_order",
    required: [
      "id",
      "orderid",
      "patientid",
      "soapid",
      "labintegrationorderstatusid",
    ],
  },
  {
    kind: "lab_media",
    required: [
      "id",
      "labintegrationid",
      "mediavaultentryid",
      "labintegrationorderid",
    ],
  },
  {
    kind: "invoice",
    required: [
      "id",
      "clientid",
      "statusid",
      "invoiceNumber",
      "subtotal",
      "total",
      "balance",
      "isfullysettled",
    ].map(normalizeKey),
  },
  {
    kind: "invoice_item",
    required: [
      "id",
      "invoiceid",
      "productid",
      "productquantity",
      "patientid",
      "subtotal",
      "total",
    ],
  },
  {
    kind: "payment",
    required: [
      "id",
      "clientid",
      "amount",
      "paymentmethodid",
      "paymentstatusid",
      "paymentdate",
    ],
  },
  {
    kind: "payment_allocation",
    required: [
      "id",
      "invoiceid",
      "paymentid",
      "closedamount",
      "closeddate",
    ],
  },
];

export type ShepherdClassification =
  | { status: "matched"; kind: ShepherdTableKind }
  | { status: "unknown" }
  | { status: "ambiguous"; kinds: ShepherdTableKind[] };

export type ShepherdRawRow = Readonly<Record<string, string | undefined>>;

export function classifyShepherdHeaders(
  rawHeaders: readonly string[],
): ShepherdClassification {
  const headers = new Set(rawHeaders.map(normalizeKey));
  const matches = SIGNATURES.filter(
    (signature) =>
      signature.required.every((column) => headers.has(normalizeKey(column))) &&
      !signature.forbidden?.some((column) => headers.has(normalizeKey(column))),
  ).map((signature) => signature.kind);

  const unique = [...new Set(matches)];
  if (unique.length === 0) return { status: "unknown" };
  if (unique.length > 1) return { status: "ambiguous", kinds: unique };
  return { status: "matched", kind: unique[0]! };
}

const DICTIONARY_VALUE_PROFILES: Readonly<
  Partial<Record<ShepherdTableKind, ReadonlySet<string>>>
> = {
  sex: new Set([
    "altered_other",
    "f",
    "fs",
    "fs_oss",
    "gelding",
    "intersex",
    "m",
    "mare",
    "mn",
    "mn_vas",
    "stallion",
    "u",
  ]),
  patient_status: new Set(["active", "deceased", "inactive"]),
  appointment_status: new Set([
    "canceled",
    "checked_in",
    "checked_out",
    "confirmed",
    "late",
    "no_show",
    "pending_client_approval",
    "pending_confirmation",
    "upcoming",
  ]),
  soap_status: new Set([
    "active",
    "boarding",
    "in_review",
    "lab_pending",
    "locked",
  ]),
  product_type: new Set([
    "injection",
    "medication",
    "product",
    "service",
    "vaccine",
  ]),
};

function normalizedDictionaryValue(row: ShepherdRawRow): string | undefined {
  const normalized = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeKey(key), value]),
  );
  const value = normalized.name ?? normalized.description ?? normalized.abrv;
  const result = value
    ? value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
    : "";
  return result || undefined;
}

/**
 * Shepherd lookup tables intentionally share the same five-column shape.
 * Resolve only against a complete, allowlisted value vocabulary. Unknown or
 * overlapping vocabularies remain ambiguous instead of being guessed.
 */
export function classifyShepherdDictionaryRows(
  rows: readonly ShepherdRawRow[],
): ShepherdClassification {
  const values = new Set(
    rows
      .map(normalizedDictionaryValue)
      .filter((value): value is string => !!value),
  );
  if (values.size === 0) return { status: "unknown" };

  const matches = Object.entries(DICTIONARY_VALUE_PROFILES)
    .filter(
      ([, allowed]) =>
        allowed && [...values].every((value) => allowed.has(value)),
    )
    .map(([kind]) => kind as ShepherdTableKind);
  if (matches.length === 0) return { status: "unknown" };
  if (matches.length > 1) return { status: "ambiguous", kinds: matches };
  return { status: "matched", kind: matches[0]! };
}

export type MigrationSupportDisposition =
  | "import_now"
  | "build_generic_support"
  | "reference_only"
  | "manual_review"
  | "exclude";

export interface MigrationDomainPolicy {
  domain: string;
  disposition: MigrationSupportDisposition;
  reasonCode: string;
  reusableForOtherClinics: boolean;
}

/**
 * Product policy, not clinic-specific data. This is the reviewed boundary for
 * every Shepherd bundle. A private dry run supplies counts beside it.
 */
export const SHEPHERD_MIGRATION_POLICY: readonly MigrationDomainPolicy[] = [
  {
    domain: "clients",
    disposition: "import_now",
    reasonCode: "stable_owner_identity",
    reusableForOtherClinics: true,
  },
  {
    domain: "patients",
    disposition: "import_now",
    reasonCode: "stable_patient_owner_identity",
    reusableForOtherClinics: true,
  },
  {
    domain: "locked_soap_history",
    disposition: "import_now",
    reasonCode: "final_clinical_history",
    reusableForOtherClinics: true,
  },
  {
    domain: "vaccinations",
    disposition: "import_now",
    reasonCode: "dated_patient_history",
    reusableForOtherClinics: true,
  },
  {
    domain: "care_reminders",
    disposition: "build_generic_support",
    reasonCode: "no_general_reminder_model",
    reusableForOtherClinics: true,
  },
  {
    domain: "active_prescriptions",
    disposition: "build_generic_support",
    reasonCode: "requires_import_identity_and_direction_review",
    reusableForOtherClinics: true,
  },
  {
    domain: "catalog",
    disposition: "build_generic_support",
    reasonCode: "inventory_unknown_must_not_block_billing",
    reusableForOtherClinics: true,
  },
  {
    domain: "inventory_lots",
    disposition: "build_generic_support",
    reasonCode: "decimal_multi_lot_inventory_not_representable",
    reusableForOtherClinics: true,
  },
  {
    domain: "typed_documents",
    disposition: "build_generic_support",
    reasonCode: "requires_checksum_storage_and_exact_entity_link",
    reusableForOtherClinics: true,
  },
  {
    domain: "stale_appointments",
    disposition: "manual_review",
    reasonCode: "export_schedule_is_not_current",
    reusableForOtherClinics: true,
  },
  {
    domain: "structured_lab_panels",
    disposition: "reference_only",
    reasonCode: "source_panel_shape_exceeds_scalar_result_model",
    reusableForOtherClinics: true,
  },
  {
    domain: "financial_history",
    disposition: "reference_only",
    reasonCode: "must_not_change_live_ar_or_inventory",
    reusableForOtherClinics: true,
  },
  {
    domain: "open_balances",
    disposition: "manual_review",
    reasonCode: "requires_clinic_attested_opening_balance",
    reusableForOtherClinics: true,
  },
  {
    domain: "communications_history",
    disposition: "reference_only",
    reasonCode: "must_not_replay_provider_or_consent_state",
    reusableForOtherClinics: true,
  },
  {
    domain: "staff_accounts",
    disposition: "exclude",
    reasonCode: "never_create_login_or_attribute_clinical_work",
    reusableForOtherClinics: true,
  },
  {
    domain: "platform_configuration",
    disposition: "exclude",
    reasonCode: "contains_vendor_credentials_and_runtime_settings",
    reusableForOtherClinics: true,
  },
  {
    domain: "audit_and_auth_tables",
    disposition: "exclude",
    reasonCode: "source_security_evidence_is_not_portable",
    reusableForOtherClinics: true,
  },
] as const;

export interface ShepherdTableCount {
  kind: ShepherdTableKind;
  rows: number;
}

export function summarizeShepherdTableCounts(
  tables: readonly ShepherdTableCount[],
): Readonly<Record<ShepherdTableKind, number>> {
  const result = Object.fromEntries(
    SIGNATURES.map(({ kind }) => [kind, 0]),
  ) as Record<ShepherdTableKind, number>;
  for (const table of tables) {
    if (!Number.isSafeInteger(table.rows) || table.rows < 0) {
      throw new Error(
        "Shepherd table row counts must be non-negative integers.",
      );
    }
    result[table.kind] += table.rows;
  }
  return result;
}
