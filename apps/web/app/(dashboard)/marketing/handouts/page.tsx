"use client";

import { useState } from "react";
import { Copy, Plus, FileText, Check, Globe, Lock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

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
          <h1 className="text-2xl font-bold">{t("marketing.handouts.title", "Edukačné letáky")}</h1>
          <p className="text-muted-foreground">
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="h-40 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-40 w-full animate-pulse rounded-md bg-muted" />
        </div>
      ) : listQuery.data?.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {t("marketing.handouts.noHandouts", "Žiadne letáky.")}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listQuery.data?.map((handout: any) => (
            <div key={handout.id} className="rounded-xl border bg-card p-5 shadow-sm space-y-4 flex flex-col">
              <div>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-sm line-clamp-2">{handout.title}</h3>
                  {handout.isPublic ? (
                    <Globe className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {handout.species?.map((s: string) => (
                    <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                  ))}
                  {handout.tags?.map((t: string) => (
                    <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              </div>
              
              <div className="mt-auto pt-4 flex flex-col gap-2">
                <div className="text-xs font-mono text-muted-foreground bg-muted p-2 rounded-md truncate">
                  /h/{handout.slug}
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full gap-2"
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
                      <span>Kopírovať odkaz</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

