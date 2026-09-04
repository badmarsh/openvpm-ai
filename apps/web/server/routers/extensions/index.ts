import { createRouter } from "../../trpc";
import { ekasaRouter } from "./ekasa";
import { v2ImportRouter } from "./v2-import";

/**
 * Root router for all OpenVPM custom extensions.
 * Keeps extensions fully isolated from vanilla routers.
 */
export const extensionsRouter = createRouter({
  ekasa: ekasaRouter,
  v2Import: v2ImportRouter,
});

export { ekasaRouter, v2ImportRouter };
