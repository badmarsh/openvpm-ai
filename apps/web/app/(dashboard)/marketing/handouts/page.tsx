"use client";

import { useState } from "react";
import { Copy, Plus, FileText, Check, Globe, Lock, ExternalLink } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { getHandoutThematicImage } from "@/lib/marketing/handout-themes";

export default function HandoutsPage() {
  const { t } = useI18n();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [species, setSpecies] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const listQuery = trpc.extensions.marketing.listHandouts.useQuery();

  const createMutation = trpc.extensions.marketing.createHandout.useMutation({
    onSuccess: () => {
      setIsDialogOpen(false);
      utils.extensions.marketing.listHandouts.invalidate();
      setSlug("");
      setTitle("");
      setBody("");
      setSpecies([]);
      setIsPublic(true);
    },
  });

  const toggleSpecies = (s: string) => {
    setSpecies((prev) => 
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const copyUrl = (handoutSlug: string) => {
    const url = `${window.location.origin}/h/${handoutSlug}`;
    navigator.clipboard.writeText(url);
    setCopied(handoutSlug);
    toast.success("Odkaz skopírovaný");
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="w-7 h-7 text-primary" />
            {t("marketing.handouts.title", "Edukačné letáky")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t("marketing.handouts.description", "Knižnica opakovateľných letákov s QR kódmi pre klientov.")}
          </p>
        </div>
        
        {!isDialogOpen && (
          <div onClick={() => setIsDialogOpen(true)}>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t("marketing.handouts.newHandout", "Nový leták")}
            </Button>
          </div>
        )}
        {isDialogOpen && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
            <div className="fixed z-50 grid w-full max-w-xl gap-4 border bg-background p-6 shadow-lg sm:rounded-lg">
              <div className="flex flex-col space-y-1.5 text-center sm:text-left">
                <h2 className="text-lg font-semibold leading-none tracking-tight">{t("marketing.handouts.newHandout", "Nový leták")}</h2>
              </div>
              
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Napr. Starostlivosť po kastrácii" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">URL Slug</label>
                <Input 
                  value={slug} 
                  onChange={(e) => setSlug(e.target.value)} 
                  placeholder="starostlivost-po-kastraci" 
                  pattern="[a-z0-9-]+"
                />
                <p className="text-xs text-muted-foreground">Len malé písmená, čísla a pomlčky.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Body (Markdown)</label>
                <Textarea 
                  rows={6} 
                  value={body} 
                  onChange={(e) => setBody(e.target.value)} 
                  placeholder="Sem napíšte obsah letáku v Markdown formáte..." 
                />
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium">Species</label>
                <div className="flex items-center gap-6">
                  {['Pes', 'Mačka', 'Iné'].map((s) => (
                    <div key={s} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`species-${s}`} 
                        checked={species.includes(s)} onChange={() => toggleSpecies(s)}
                      />
                      <label htmlFor={`species-${s}`} className="text-sm">{s}</label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <input type="checkbox" id="public-toggle" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="h-4 w-4" />
                <label htmlFor="public-toggle" className="text-sm">Verejný leták (dostupný pre klientov)</label>
              </div>
              <Button 
                className="w-full mt-4" 
                onClick={() => createMutation.mutate({ slug, title, body, species, isPublic })}
                disabled={!slug || !title || !body || createMutation.isPending}
              >
                Create
              </Button>
            </div>
          
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Close</Button>
            </div>
          </div>
        )}

      </div>

      {listQuery.isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <div className="h-64 w-full animate-pulse rounded-2xl bg-muted" />
          <div className="h-64 w-full animate-pulse rounded-2xl bg-muted" />
          <div className="h-64 w-full animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : listQuery.data?.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          {t("marketing.handouts.noHandouts", "Žiadne letáky.")}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {listQuery.data?.map((handout: any) => {
            const theme = getHandoutThematicImage(handout);

            return (
              <div
                key={handout.id}
                className="group rounded-2xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between"
              >
                {/* Thematic Illustrative Image Header */}
                <div className="relative h-44 sm:h-48 w-full overflow-hidden bg-muted border-b border-border/60">
                  <img
                    src={theme.src}
                    alt={theme.alt}
                    className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    loading="lazy"
                  />
                  {/* Thematic Category Badge on top-left */}
                  <div className="absolute top-3 left-3 z-10">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-background/90 text-foreground backdrop-blur-md border border-border/80 shadow-sm">
                      {theme.category}
                    </span>
                  </div>

                  {/* Public / Private Status Badge on top-right */}
                  <div className="absolute top-3 right-3 z-10">
                    {handout.isPublic ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/90 text-white backdrop-blur-md shadow-sm border border-emerald-400/30">
                        <Globe className="h-3 w-3" />
                        {t("marketing.handouts.public", "Verejný")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-background/85 text-muted-foreground backdrop-blur-md border border-border/80 shadow-sm">
                        <Lock className="h-3 w-3" />
                        {t("marketing.handouts.private", "Interný")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Content Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2.5">
                    <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                      {handout.title}
                    </h3>

                    {/* Species and Tags Badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {handout.species?.map((s: string) => (
                        <Badge key={s} variant="secondary" className="text-[10px] capitalize">
                          {s.toLowerCase() === "canine" || s.toLowerCase() === "pes"
                            ? "🐶 Pes"
                            : s.toLowerCase() === "feline" || s.toLowerCase() === "macka"
                            ? "🐱 Mačka"
                            : s}
                        </Badge>
                      ))}
                      {handout.tags?.slice(0, 3).map((t: string) => (
                        <Badge key={t} variant="outline" className="text-[10px]">
                          #{t}
                        </Badge>
                      ))}
                    </div>

                    {/* Markdown Excerpt preview */}
                    {handout.body && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {handout.body.replace(/^#+\s+/gm, "").replace(/[*_`]/g, "").slice(0, 140)}...
                      </p>
                    )}
                  </div>

                  {/* Footer & Quick Actions */}
                  <div className="pt-3 border-t border-border/60 flex flex-col gap-2">
                    <div className="text-xs font-mono text-muted-foreground bg-muted/60 px-2.5 py-1.5 rounded-lg truncate">
                      /h/{handout.slug}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full gap-1.5 text-xs"
                        onClick={() => copyUrl(handout.slug)}
                      >
                        {copied === handout.slug ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-emerald-600">Skopírované</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Kopírovať</span>
                          </>
                        )}
                      </Button>

                      <a
                        href={`/h/${handout.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 text-xs font-medium border rounded-md px-3 py-1.5 bg-background hover:bg-muted/80 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Otvoriť</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

