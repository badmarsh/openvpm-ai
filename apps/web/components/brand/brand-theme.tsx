"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { brandThemeVariables } from "@/lib/theme/contrast";

/**
 * Applies the practice's accent color to the app's CSS variables at runtime, so
 * the brand color a clinic picks shows up across the whole site. Renders nothing.
 *
 * The picked hex is unbounded input, so `brandThemeVariables` also derives a
 * label colour and a focus-ring colour that stay AA-readable on it — a clinic
 * must not be able to pick a brand colour that makes its own buttons illegible.
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
    const vars = brandThemeVariables(data?.brandColor);
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        root.style.setProperty(name, value);
      }
    } else {
      for (const name of ["--primary", "--primary-foreground", "--ring"]) {
        root.style.removeProperty(name);
      }
    }
  }, [data?.brandColor]);

  return null;
}
