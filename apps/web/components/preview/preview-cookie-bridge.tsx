"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

/**
 * Preview-only cookie bridge — sets preview cookies on mount if present in URL.
 * Used for sandbox live previews to inherit auth state without login.
 */
export function PreviewCookieBridge() {
  const pathname = usePathname();

  React.useEffect(() => {
    // Only run in preview mode (URL contains ?preview=)
    if (!pathname.includes("?preview=")) return;

    try {
      // Extract preview token from URL
      const urlParams = new URLSearchParams(window.location.search);
      const previewToken = urlParams.get("preview");
      
      if (previewToken) {
        // Set as cookie for backend to read
        document.cookie = `preview_token=${previewToken}; path=/; max-age=3600; SameSite=Strict${window.location.protocol === "https:" ? "; Secure" : ""}`;
        
        // Clean up URL
        window.history.replaceState(null, "", pathname);
      }
    } catch (error) {
      console.error("Preview cookie bridge failed:", error);
      toast.error("Preview session could not be established");
    }
  }, [pathname]);

  return null;
}