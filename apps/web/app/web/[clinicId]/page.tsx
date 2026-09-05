"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import {
  PawPrint,
  Phone,
  Mail,
  MapPin,
  Clock,
  CalendarCheck2,
  Star,
  FileText,
  Users,
  ShieldCheck,
  AlertCircle,
  Loader2,
  ExternalLink,
  ChevronRight,
  Heart,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function PublicClinicWebsitePage() {
  const params = useParams();
  const clinicId = (params.clinicId as string) ?? "";

  const { data, isLoading, error } = trpc.extensions.marketing.getPublicWebsiteData.useQuery(
    { clinicId },
    { enabled: !!clinicId, refetchOnWindowFocus: false }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm font-medium text-muted-foreground">Načítavam stránku kliniky...</p>
      </div>
    );
  }

  if (error || !data || !data.practice) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold">Klinika nebola nájdená</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Skontrolujte zadanú webovú adresu alebo kontaktujte veterinárnu ambulanciu priamo telefonicky.
        </p>
      </div>
    );
  }

  const { practice, isPublished, team, handouts, reviews } = data;
  const bookingUrl = `/book/${practice.id}?utm_source=klinika_web&utm_medium=site`;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Draft notice banner if not published */}
      {!isPublished && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-center text-xs font-semibold text-amber-800 dark:text-amber-300">
          ⚠️ Náhľad kliniky: Táto webstránka je v režime konceptu a zatiaľ nie je verejne indexovaná.
        </div>
      )}

      {/* Hero Section */}
      <header className="relative bg-gradient-to-br from-primary/95 via-primary/85 to-primary/70 text-primary-foreground py-16 px-4 sm:px-6 lg:px-8 shadow-md">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs font-semibold tracking-wide">
              <PawPrint className="h-4 w-4" />
              <span>Veterinárna starostlivosť na najvyššej úrovni</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              {practice.name}
            </h1>
            <p className="text-base sm:text-lg text-primary-foreground/90 font-medium leading-relaxed">
              Poskytujeme komplexnú odbornú diagnostiku, modernú chirurgiu a preventívnu starostlivosť pre vaše domáce zvieratá s dôrazom na bezstresový prístup.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href={bookingUrl}>
                <Button size="lg" variant="secondary" className="gap-2 font-bold shadow-md hover:scale-105 transition-transform">
                  <CalendarCheck2 className="h-5 w-5" />
                  Objednať sa online
                </Button>
              </Link>
              {practice.phone && (
                <a href={`tel:${practice.phone}`}>
                  <Button size="lg" variant="outline" className="bg-white/10 hover:bg-white/20 border-white/30 text-white gap-2 font-semibold">
                    <Phone className="h-4 w-4" />
                    {practice.phone}
                  </Button>
                </a>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 backdrop-blur-md p-6 border border-white/20 space-y-4 w-full md:w-80 shrink-0 text-sm">
            <h3 className="font-bold flex items-center gap-2 border-b border-white/20 pb-2">
              <Clock className="h-4 w-4 text-amber-300" />
              Kontaktné informácie
            </h3>
            {practice.address && (
              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-white/80 shrink-0 mt-0.5" />
                <span>{practice.address}</span>
              </div>
            )}
            {practice.phone && (
              <div className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-white/80 shrink-0" />
                <span>{practice.phone}</span>
              </div>
            )}
            {practice.email && (
              <div className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-white/80 shrink-0" />
                <span className="truncate">{practice.email}</span>
              </div>
            )}
            <div className="pt-2 border-t border-white/15">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2 animate-pulse" />
              <span className="font-semibold text-xs">Prijímame nových pacientov</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Sections */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16 flex-1">
        {/* Team Section */}
        {team && team.length > 0 && (
          <section className="space-y-6">
            <div className="text-center max-w-xl mx-auto space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Náš veterinárny tím</h2>
              <p className="text-sm text-muted-foreground">
                Tím skúsených lekárov a sestier, pre ktorých je zdravie vašich zvierat na prvom mieste.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {team.map((member) => (
                <div
                  key={member.id}
                  className="rounded-2xl border border-border bg-card p-5 text-center space-y-3 shadow-xs hover:border-primary/40 transition-colors"
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center font-bold text-xl">
                    {member.name ? member.name.charAt(0) : "V"}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{member.name}</h3>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">
                      {member.role === "veterinarian"
                        ? "Veterinárny lekár"
                        : member.role === "technician"
                        ? "Veterinárny asistent"
                        : "Vedenie kliniky"}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-semibold bg-primary/5">
                    Fear-Free Certifikácia
                  </Badge>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Handouts & Patient Education */}
        {handouts && handouts.length > 0 && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2 border-b border-border pb-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Rady pre chovateľov & letáky</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Odborné návody, domáca starostlivosť a odpovede na najčastejšie otázky.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {handouts.map((h) => (
                <Link
                  key={h.id}
                  href={`/h/${h.slug}`}
                  className="group rounded-xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-sm transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-primary text-xs font-semibold">
                      <FileText className="h-4 w-4 shrink-0" />
                      <span>Edukačný návod</span>
                    </div>
                    <h3 className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                      {h.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                      {h.body.replace(/[#*`_]/g, "").slice(0, 140)}...
                    </p>
                  </div>

                  <div className="pt-4 mt-2 flex items-center justify-between text-xs font-medium text-primary">
                    <span>Prečítať celý leták</span>
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Reviews Section */}
        {reviews && reviews.length > 0 && (
          <section className="space-y-6">
            <div className="text-center max-w-xl mx-auto space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Čo hovoria naši klienti</h2>
              <p className="text-sm text-muted-foreground">
                Reálne overené hodnotenia z Google a Facebooku od majiteľov pacientov.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reviews.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-amber-500">
                      {Array.from({ length: r.rating ?? 5 }).map((_, idx) => (
                        <Star key={idx} className="h-4 w-4 fill-amber-500" />
                      ))}
                    </div>
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {r.platform}
                    </span>
                  </div>

                  <p className="text-sm text-foreground italic leading-relaxed">
                    "{r.reviewText}"
                  </p>

                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{r.reviewerName || "Overený chovateľ"}</span>
                    {r.receivedAt && (
                      <span>{new Date(r.receivedAt).toLocaleDateString("sk-SK")}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Online Booking Call-to-Action */}
        <section className="rounded-3xl bg-primary/10 border border-primary/20 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground mx-auto flex items-center justify-center">
            <CalendarCheck2 className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            Potrebujete vyšetriť psíka, mačku alebo iné zviera?
          </h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Zarezervujte si presný čas návštevy online bez čakania v čakárni. Pri akútnych stavoch volajte priamo na našu pohotovosť.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href={bookingUrl}>
              <Button size="lg" className="gap-2 font-bold shadow-md">
                <CalendarCheck2 className="h-5 w-5" />
                Rezervovať termín online
              </Button>
            </Link>
            {practice.phone && (
              <a href={`tel:${practice.phone}`}>
                <Button size="lg" variant="outline" className="gap-2 font-semibold">
                  <Phone className="h-4 w-4" />
                  Volať na kliniku
                </Button>
              </a>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30 py-8 px-4 sm:px-6 lg:px-8 text-center text-xs text-muted-foreground space-y-2">
        <p className="font-semibold text-foreground">{practice.name}</p>
        <p>
          {practice.address && `${practice.address} · `}
          {practice.phone && `Tel: ${practice.phone}`}
        </p>
        <p className="text-[11px] text-muted-foreground/70 pt-2">
          Poháňané systémom <span className="font-bold text-foreground">OpenVPM AI</span> · Veterinárna klinická správa & marketing
        </p>
      </footer>
    </div>
  );
}
