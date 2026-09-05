"use client";

import { useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScreenShareButton } from "@/components/support/ScreenShareButton";
import { SupportSessionControls } from "@/components/support/SupportSessionControls";
import { Monitor, ClipboardCopy, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function SupportPage() {
  const { t } = useI18n();
  const [session, setSession] = useState<{ id: string; code: string } | null>(null);
  const [started, setStarted] = useState(false);

  const utils = trpc.useUtils();
  const createSession = trpc.extensions.support.createSession.useMutation({
    onSuccess: (data) => {
      setSession({ id: data.sessionId, code: data.sessionCode });
      toast.success("Support session vytvorený");
    },
    onError: () => {
      toast.error("Nepodarilo sa vytvoriť support session");
    },
  });

  const startSession = trpc.extensions.support.startSession.useMutation({
    onSuccess: () => {
      setStarted(true);
      toast.success("Zdieľanie spustené");
    },
  });

  const endSession = trpc.extensions.support.endSession.useMutation({
    onSuccess: () => {
      setSession(null);
      setStarted(false);
      toast.info("Session ukončená");
    },
  });

  const handleCreate = useCallback(() => {
    createSession.mutate(undefined);
  }, [createSession]);

  const handleStart = useCallback(() => {
    if (!session) return;
    startSession.mutate({ sessionId: session.id });
  }, [session, startSession]);

  const handleEnd = useCallback(() => {
    if (!session) return;
    endSession.mutate({ sessionId: session.id });
  }, [session, endSession]);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            {t("title", "Vzdialená podpora")}
          </CardTitle>
          <CardDescription>
            {t("description", "Zdieľajte obrazovku s technickou podporou pre rýchlejšie riešenie problémov.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!session && (
            <div className="space-y-4">
              <p className="text-sm text-stone-600">
                Kliknutím nižšie vytvoríte session a získate 6-miestny kód,
                ktorý oznámite agentovi podpory.
              </p>
              <Button onClick={handleCreate} disabled={createSession.isPending}>
                {createSession.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Vytváranie...
                  </>
                ) : (
                  "Vytvoriť support session"
                )}
              </Button>
            </div>
          )}

          {session && !started && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-stone-50 rounded-lg">
                <ClipboardCopy className="w-4 h-4 text-stone-500" />
                <span className="text-2xl font-mono font-bold tracking-widest">
                  {session.code}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(session.code);
                    toast.success("Kód skopírovaný");
                  }}
                >
                  Kopírovať
                </Button>
              </div>
              <p className="text-sm text-stone-500">
                Oznámte tento kód agentovi podpory. Session sa aktivuje po pripojení agenta.
              </p>
              <Button onClick={handleStart} disabled={startSession.isPending}>
                {startSession.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Spúšťanie...
                  </>
                ) : (
                  "Spustiť zdieľanie"
                )}
              </Button>
            </div>
          )}

          {started && session && (
            <div className="space-y-4">
              <ScreenShareButton
                sessionId={session.id}
                role="customer"
                onSessionEnd={handleEnd}
              />
              <SupportSessionControls
                sessionCode={session.code}
                onEnd={handleEnd}
                isActive
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
