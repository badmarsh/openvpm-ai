"use client";

import { useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScreenViewer } from "@/components/support/ScreenViewer";
import { AgentJoinForm, SupportSessionControls } from "@/components/support/SupportSessionControls";
import { Monitor, Shield } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function AdminSupportPage() {
  const { t } = useI18n();
  const [session, setSession] = useState<{ id: string; code: string } | null>(null);

  const getSession = trpc.extensions.support.getSessionByCode.useQuery(
    { code: "" },
    { enabled: false }
  );

  const endSession = trpc.extensions.support.endSession.useMutation({
    onSuccess: () => {
      setSession(null);
      toast.info("Session ukončená");
    },
  });

  const handleJoin = useCallback(
    async (code: string) => {
      const result = await trpc.extensions.support.getSessionByCode.fetch({ code });
      if (!result.data?.found) {
        toast.error("Session s týmto kódom nebola nájdená");
        return;
      }
      setSession({ id: result.data.session!.id, code });
      toast.success("Pripojené k session");
    },
    [getSession]
  );

  const handleEnd = useCallback(() => {
    if (!session) return;
    endSession.mutate(
      { sessionId: session.id },
      {
        onSuccess: () => {
          setSession(null);
          toast.info("Session ukončená");
        },
      }
    );
  }, [session, endSession]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            {t("title", "Admin podpora")}
          </CardTitle>
          <CardDescription>
            {t("description", "Pripojte sa k obrazovke zákazníka cez 6-miestny kód session.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!session ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <Monitor className="w-4 h-4 shrink-0" />
                <p>
                  Vyžiadajte si od zákazníka 6-miestny kód z jeho support stránky.
                </p>
              </div>
              <AgentJoinForm onJoin={handleJoin} />
            </div>
          ) : (
            <div className="space-y-4">
              <SupportSessionControls
                sessionCode={session.code}
                onEnd={handleEnd}
                isActive
              />
              <ScreenViewer
                sessionId={session.id}
                role="agent"
                onEnd={handleEnd}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
