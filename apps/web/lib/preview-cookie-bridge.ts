/**
 * Preview-only cookie bridge (shared constants).
 *
 * Some sandbox preview proxies drop the request `Cookie` header, so the
 * browser keeps our NextAuth cookies but the server never sees them. With
 * `PREVIEW_COOKIE_BRIDGE=true`:
 *
 * 1. the root layout injects {@link PREVIEW_FETCH_SHIM}, which patches
 *    `window.fetch` to re-send `document.cookie` as `x-preview-cookie` on
 *    same-origin requests (client navigations, tRPC, NextAuth, server actions);
 * 2. `middleware.ts` copies that header back into `cookie` for the
 *    downstream request, so NextAuth, `cookies()` and route handlers work;
 * 3. `previewCookieOptions()` in lib/auth.ts makes the auth cookies readable
 *    from JavaScript, and `<PreviewCookieBridge />` resumes a session after a
 *    cookie-less full document load bounced the user to `/login`.
 *
 * Never enable this outside a disposable preview environment.
 */

export const PREVIEW_COOKIE_HEADER = "x-preview-cookie";

export function isPreviewCookieBridgeEnabled(): boolean {
  return process.env.PREVIEW_COOKIE_BRIDGE === "true";
}

export const PREVIEW_FETCH_SHIM = `(function(){
  if (window.__previewCookieBridge) return;
  window.__previewCookieBridge = true;
  var original = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      var raw = typeof input === "string" || input instanceof URL ? String(input) : input.url;
      var url = new URL(raw, window.location.href);
      if (url.origin === window.location.origin && document.cookie) {
        var headers = new Headers(
          (init && init.headers) || (input instanceof Request ? input.headers : undefined)
        );
        headers.set(${JSON.stringify(PREVIEW_COOKIE_HEADER)}, document.cookie);
        return original(input, Object.assign({}, init, { headers: headers }));
      }
    } catch (_) {}
    return original(input, init);
  };
})();`;
