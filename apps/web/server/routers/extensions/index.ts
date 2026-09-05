import { createRouter } from "../../trpc";
import { ekasaRouter } from "./ekasa";
import { v2ImportRouter } from "./v2-import";
import { imagingRouter } from "./imaging";
import { crszRouter } from "./crsz";
import { accountingRouter } from "./accounting";
import { labImportRouter } from "./lab-import";
import { voiceRouter } from "./voice";
import { marketingRouter } from "./marketing";

/**
 * Root router for all OpenVPM custom extensions.
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
};
