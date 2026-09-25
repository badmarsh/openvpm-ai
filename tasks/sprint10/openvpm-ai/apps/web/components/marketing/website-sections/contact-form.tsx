"use client";

import { useState } from "react";
import { Send, CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { contactFormContentSchema, BrandKitData, WebsitePublicData } from "@/lib/marketing/website-builder-types";
import type { z } from "zod";

interface ContactFormSectionProps {
  content: z.infer<typeof contactFormContentSchema>;
  brandKit?: BrandKitData;
  contextData?: WebsitePublicData;
  isEditor?: boolean;
}

export function ContactFormSection({ content, contextData, isEditor }: ContactFormSectionProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = trpc.extensions.marketing.submitWebsiteContactForm.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success(content.successMessage);
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa odoslať správu. Skúste to znova.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (trimmedName.length < 2) {
      toast.error("Zadajte prosím celé meno (aspoň 2 znaky).");
      return;
    }

    if (!trimmedEmail || !trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
      toast.error("Zadajte platnú e-mailovú adresu.");
      return;
    }

    if (trimmedMessage.length < 5) {
      toast.error("Správa musí obsahovať aspoň 5 znakov.");
      return;
    }

    if (isEditor) {
      toast.info("V režime editora je odosielanie správ simulované.");
      setSubmitted(true);
      return;
    }

    if (!contextData?.practice?.id) {
      toast.error("Chýba identifikátor kliniky.");
      return;
    }

    submitMutation.mutate({
      clinicId: contextData.practice.id,
      name: trimmedName,
      email: trimmedEmail,
      phone: content.showPhoneField && phone.trim() ? phone.trim() : undefined,
      message: trimmedMessage,
    });
  };

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
          {content.title}
        </h2>
        {content.subtitle && (
          <p className="text-sm font-medium text-muted-foreground">
            {content.subtitle}
          </p>
        )}
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 md:p-8 shadow-xs">
        {submitted ? (
          <div className="py-10 text-center space-y-3">
            <div
              className="w-12 h-12 rounded-full mx-auto flex items-center justify-center shadow-xs"
              style={{
                backgroundColor: "var(--wb-secondary, #f5f5f4)",
                color: "var(--wb-primary, #0d9488)",
              }}
            >
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Správa bola odoslaná</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {content.successMessage}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSubmitted(false);
                setName("");
                setEmail("");
                setPhone("");
                setMessage("");
              }}
              className="mt-4"
            >
              Odoslať ďalšiu správu
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold text-foreground">Vaše meno *</label>
                <Input
                  required
                  placeholder="napr. Peter Novák"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold text-foreground">E-mailová adresa *</label>
                <Input
                  type="email"
                  required
                  placeholder="peter@example.sk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {content.showPhoneField && (
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold text-foreground">Telefónne číslo (voliteľné)</label>
                <Input
                  type="tel"
                  placeholder="+421 900 123 456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold text-foreground">Vaša správa alebo otázka *</label>
              <Textarea
                required
                minLength={5}
                maxLength={2000}
                rows={4}
                placeholder="Napíšte nám, ako vám môžeme pomôcť..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-0.5">
                <span>Min. 5 znakov</span>
                <span className={message.length > 1900 ? "text-amber-500 font-medium" : ""}>
                  {message.length} / 2000
                </span>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitMutation.isPending}
              className="w-full font-bold gap-2 text-white shadow-xs"
              style={{ backgroundColor: "var(--wb-primary, #0d9488)" }}
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Odoslať správu
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
