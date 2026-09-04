import { createRouter } from "../../trpc";
import { ekasaRouter } from "./ekasa";
import { v2ImportRouter } from "./v2-import";
import { imagingRouter } from "./imaging";

/**
 * Root router for all OpenVPM custom extensions.
 * Keeps extensions fully isolated from vanilla routers.
 */
export const extensionsRouter = createRouter({
  ekasa: ekasaRouter,
  v2Import: v2ImportRouter,
  imaging: imagingRouter,
});

export { ekasaRouter, v2ImportRouter, imagingRouter };
