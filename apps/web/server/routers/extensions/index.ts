import { createRouter } from "../../trpc";
import { ekasaRouter } from "./ekasa";
import { v2ImportRouter } from "./v2-import";
import { imagingRouter } from "./imaging";
import { crszRouter } from "./crsz";
import { accountingRouter } from "./accounting";
import { labImportRouter } from "./lab-import";
import { voiceRouter } from "./voice";
import { marketingRouter } from "./marketing";
import { dischargeRouter } from "./discharge";
import { supportRouter } from "./support";
import { statutoryRouter } from "./statutory";
import { kvepisRouter } from "./kvepis";
import { auditExportRouter } from "./audit-export";
import { insuranceRouter } from "./insurance";
import { dentalRouter } from "./dental";
import { wholesalerImportRouter } from "./wholesaler-import";

/**
 * Root router for all VET.IS custom extensions.
 * Keeps extensions fully isolated from vanilla routers.
 */
export const extensionsRouter = createRouter({
  ekasa: ekasaRouter,
  v2Import: v2ImportRouter,
  imaging: imagingRouter,
  crsz: crszRouter,
  accounting: accountingRouter,
  labImport: labImportRouter,
  voice: voiceRouter,
  marketing: marketingRouter,
  discharge: dischargeRouter,
  support: supportRouter,
  statutory: statutoryRouter,
  kvepis: kvepisRouter,
  auditExport: auditExportRouter,
  insurance: insuranceRouter,
  dental: dentalRouter,
  wholesalerImport: wholesalerImportRouter,
});

export {
  ekasaRouter,
  v2ImportRouter,
  imagingRouter,
  crszRouter,
  accountingRouter,
  labImportRouter,
  voiceRouter,
  marketingRouter,
  dischargeRouter,
  supportRouter,
  statutoryRouter,
  kvepisRouter,
  auditExportRouter,
  insuranceRouter,
  dentalRouter,
  wholesalerImportRouter,
};

