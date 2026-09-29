"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { hexToHslString } from "@/lib/utils";

/**
 * Applies the practice's accent color to the app's CSS variables at runtime, so
 * the brand color a clinic picks shows up across the whole site. Renders nothing.
 */
export function BrandTheme() {
  const { status } = useSession();
  const { data } = trpc.settings.getBranding.useQuery(undefined, {
    enabled: status === "authenticated",
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    try {
      const activeGuiTheme = localStorage.getItem("openvpm_gui_theme");
      if (activeGuiTheme && activeGuiTheme !== "openvpm") {
        return;
      }
    } catch {}

    const root = document.documentElement;
    const hsl = data?.brandColor ? hexToHslString(data.brandColor) : null;
    if (hsl) {
      root.style.setProperty("--primary", hsl);
      root.style.setProperty("--ring", hsl);
    } else {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--ring");
    }
  }, [data?.brandColor]);

  return null;
}
