"use client";

import {
  buildCloudSignupUrl,
  cloudSignupAppOrigin,
  FUNNEL_EVENTS,
  funnelToolFromPath,
  isDemoMode,
} from "@/lib/funnel-analytics";
import { trackFunnelEvent } from "@/lib/track-funnel-event";
import { useFunnelVisitorId } from "@/lib/funnel-visitor";
import { usePathname } from "next/navigation";
import { DemoRoleSwitcher } from "@/components/demo/demo-role-switcher";
import { useI18n } from "@/lib/i18n";

/**
 * Persistent demo → Cloud signup bridge. Job language on purpose: we sell a
 * workflow they just tried, not a full PIMS rip-replace.
 */
export function DemoConversionBar() {
  return null;
  const pathname = usePathname();
  const visitorId = useFunnelVisitorId();
  const { t } = useI18n();
  if (!isDemoMode()) return null;

  const tool = funnelToolFromPath(pathname);
  const href = buildCloudSignupUrl({
    appOrigin: cloudSignupAppOrigin(),
    tool,
    source: "demo",
    medium: "product",
    campaign: `demo_${tool}`,
    visitorId,
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/20 bg-primary/5 px-3 py-2 sm:px-6">
      <p className="text-sm text-foreground">
        <span className="font-medium">
          {t("demo.banner.title", "Páči sa vám tento workflow?")}
        </span>{" "}
        <span className="text-muted-foreground">
          {t(
            "demo.banner.subtitle",
            "Spustite si bezplatnú skúšobnú verziu s vlastnými údajmi kliniky.",
          )}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <DemoRoleSwitcher />
        <a
          href={href}
          onClick={() =>
            trackFunnelEvent(FUNNEL_EVENTS.demoCtaStartClinic, {
              tool,
              path: pathname,
            })
          }
          className="inline-flex h-8 shrink-0 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("demo.banner.startClinic", "Spustiť moju kliniku")}
        </a>
      </div>
    </div>
  );
}
