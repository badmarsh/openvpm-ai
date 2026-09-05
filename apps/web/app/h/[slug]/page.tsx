"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import {
  PawPrint,
  Printer,
  Phone,
  Mail,
  MapPin,
  Clock,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/common/empty-state";
import { getHandoutThematicImage } from "@/lib/marketing/handout-themes";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSimpleMarkdown(md: string): string {
  const lines = escapeHtml(md).split("\n");
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^###\s+/.test(line)) {
      closeList();
      const content = line.replace(/^###\s+/, "");
      out.push(`<h3 class="text-base font-bold text-foreground mt-4 mb-2">${inline(content)}</h3>`);
    } else if (/^##\s+/.test(line)) {
      closeList();
      const content = line.replace(/^##\s+/, "");
      out.push(`<h2 class="text-lg font-bold text-foreground mt-6 mb-2 border-b pb-1">${inline(content)}</h2>`);
    } else if (/^#\s+/.test(line)) {
      closeList();
      const content = line.replace(/^#\s+/, "");
      out.push(`<h1 class="text-xl font-bold text-foreground mt-6 mb-3">${inline(content)}</h1>`);
    } else if (/^[-•*]\s+/.test(line)) {
      if (!inList) {
        out.push('<ul class="list-disc list-inside space-y-1 my-2 text-foreground/90">');
        inList = true;
      }
      const content = line.replace(/^[-•*]\s+/, "");
      out.push(`<li>${inline(content)}</li>`);
    } else if (line.trim() === "") {
      closeList();
    } else {
      closeList();
      out.push(`<p class="leading-relaxed mb-3 text-foreground/90">${inline(line)}</p>`);
    }
  }

  closeList();
  return out.join("\n");
}

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

export default function PublicHandoutPage() {
  const params = useParams();
  const slug = (params.slug as string) ?? "";

  const { data: handout, isLoading, error } = trpc.extensions.marketing.getPublicHandout.useQuery(
    { slug },
    { enabled: !!slug, retry: false }
  );

  const readingTimeMinutes = useMemo(() => {
    if (!handout?.body) return 1;
    const wordCount = handout.body.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(wordCount / 180));
  }, [handout?.body]);

  const renderedHtml = useMemo(() => {
    if (!handout?.body) return "";
    return renderSimpleMarkdown(handout.body);
  }, [handout?.body]);

  const thematicImage = useMemo(() => {
    return getHandoutThematicImage({
      slug: handout?.slug ?? "",
      title: handout?.title ?? "",
      tags: handout?.tags,
      species: handout?.species,
    });
  }, [handout?.slug, handout?.title, handout?.tags, handout?.species]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Načítavam pokyny...</p>
        </div>
      </div>
    );
  }

  if (error || !handout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center">
          <EmptyState
            icon={FileText}
            title="Dokument nebol nájdený"
            description="Požadovaný edukačný materiál alebo pokyny pre starostlivosť neexistujú, alebo už nie sú verejne prístupné."
          />
        </div>
      </div>
    );
  }

  const practice = handout.practice;

  return (
    <div className="min-h-screen bg-muted/20 py-8 px-4 sm:px-6 lg:px-8 print:bg-white print:p-0">
      <div className="max-w-3xl mx-auto bg-card border rounded-2xl shadow-sm overflow-hidden print:border-none print:shadow-none">
        {/* Top Header */}
        <header className="p-6 sm:p-8 border-b bg-muted/40 print:bg-white print:border-b-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                <PawPrint className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground leading-tight">
                  {practice?.name ?? "Veterinárna klinika"}
                </h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                  {practice?.phone && (
                    <a
                      href={`tel:${practice.phone.replace(/\s/g, "")}`}
                      className="inline-flex items-center gap-1 hover:underline text-primary font-medium"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {practice.phone}
                    </a>
                  )}
                  {practice?.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />
                      {practice.email}
                    </span>
                  )}
                  {practice?.address && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {practice.address}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="print:hidden inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border rounded-lg hover:bg-muted/80 transition-colors self-start sm:self-center"
            >
              <Printer className="w-4 h-4" />
              Tlačiť pokyny
            </button>
          </div>
        </header>

        {/* Thematic Illustrative Hero Banner */}
        {thematicImage && (
          <div className="relative h-56 sm:h-64 w-full overflow-hidden bg-muted border-b print:hidden">
            <img
              src={thematicImage.src}
              alt={thematicImage.alt}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-6 sm:left-8">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-background/90 text-foreground backdrop-blur-md border border-border/70 shadow-sm">
                {thematicImage.category}
              </span>
            </div>
          </div>
        )}

        {/* Content Body */}
        <main className="p-6 sm:p-8 space-y-6">
          <div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
              <span className="inline-flex items-center gap-1 bg-muted px-2.5 py-0.5 rounded-full font-medium">
                <Clock className="w-3 h-3" />
                ~{readingTimeMinutes} min čítania
              </span>
              {handout.createdAt && (
                <span>
                  Aktualizované: {new Date(handout.createdAt).toLocaleDateString("sk-SK")}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              {handout.title}
            </h1>

            {handout.species && handout.species.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {handout.species.map((sp: string) => (
                  <span
                    key={sp}
                    className="text-xs font-semibold px-2 py-0.5 bg-primary/10 text-primary rounded-md"
                  >
                    {sp}
                  </span>
                ))}
              </div>
            )}
          </div>

          <article
            className="prose prose-sm max-w-none text-foreground/90"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />

          {/* Clinical Disclaimer */}
          <section className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-950 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-900 dark:text-amber-100">
                  Dôležité klinické upozornenie
                </p>
                <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                  Informácie v tomto materiáli slúžia na informačné účely pre majiteľa pacienta a
                  nenahrádzajú priame veterinárne vyšetrenie ani individuálne posúdenie stavu
                  ošetrujúcim lekárom. V prípade zhoršenia zdravotného stavu, apatie, zvracania alebo
                  komplikácií bezodkladne kontaktujte našu kliniku.
                </p>
                {practice?.phone && (
                  <div className="pt-2">
                    <a
                      href={`tel:${practice.phone.replace(/\s/g, "")}`}
                      className="inline-flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-100 underline hover:no-underline text-xs"
                    >
                      <Phone className="w-3.5 h-3.5" /> Pohotovosť / Kontakt: {practice.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="p-6 border-t bg-muted/20 text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} {practice?.name ?? "Veterinárna klinika"}. Všetky práva vyhradené.</p>
        </footer>
      </div>
    </div>
  );
}
