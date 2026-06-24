"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

function VerifyEmailInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"verifying" | "ok" | "error">("verifying");
  const ran = useRef(false);

  const verify = trpc.auth.verifyEmail.useMutation({
    onSuccess: () => setStatus("ok"),
    onError: () => setStatus("error"),
  });

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) {
      setStatus("error");
      return;
    }
    verify.mutate({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 text-center">
        <h1 className="font-heading text-2xl font-bold text-foreground">OpenVPM</h1>
        {status === "verifying" && (
          <p className="mt-3 text-sm text-muted-foreground">Verifying your email…</p>
        )}
        {status === "ok" && (
          <>
            <p className="mt-3 text-sm text-foreground">
              Your email is verified. You can now sign in and start your free trial.
            </p>
            <Link
              href="/login?next=/onboarding"
              className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Sign in and continue setup
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <p className="mt-3 text-sm text-destructive">
              This verification link is invalid or has expired.
            </p>
            <Link href="/login" className="mt-6 inline-block text-sm text-primary hover:underline">
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}
