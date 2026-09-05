"use client";

import { useState } from "react";
import { Plus, Tv, Clock, Pencil, Trash2, CheckCircle2, XCircle, ExternalLink, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WaitingRoomTv } from "@/components/waiting-room/waiting-room-tv";

interface SlideItem {
  id: string;
  practiceId: string;
  title: string;
  body: string | null;
  durationSeconds: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string | Date;
}

export default function TvSlidesPage() {
  const { t } = useI18n();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<SlideItem | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(12);
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const utils = trpc.useUtils();
  const listQuery = trpc.extensions.marketing.listTvSlides.useQuery();
  const practiceQuery = trpc.settings.getPractice.useQuery(undefined, { retry: false });

  const practiceId = practiceQuery.data?.id ?? (listQuery.data?.[0] as any)?.practiceId;

  const resetForm = () => {
    setTitle("");
    setBody("");
    setDurationSeconds(12);
    setSortOrder(0);
    setIsActive(true);
    setEditingSlide(null);
  };

  const openCreateDialog = () => {
    resetForm();
    // Default sort order to after the last item
    const maxOrder = listQuery.data?.reduce((max: number, item: any) => Math.max(max, item.sortOrder ?? 0), 0) ?? 0;
    setSortOrder(maxOrder + 10);
    setIsDialogOpen(true);
  };

  const openEditDialog = (slide: SlideItem) => {
    setEditingSlide(slide);
    setTitle(slide.title);
    setBody(slide.body ?? "");
    setDurationSeconds(slide.durationSeconds ?? 12);
    setSortOrder(slide.sortOrder ?? 0);
    setIsActive(slide.isActive ?? true);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const createMutation = trpc.extensions.marketing.createTvSlide.useMutation({
    onSuccess: () => {
      closeDialog();
      utils.extensions.marketing.listTvSlides.invalidate();
    },
  });

  const updateMutation = trpc.extensions.marketing.updateTvSlide.useMutation({
    onSuccess: () => {
      closeDialog();
      utils.extensions.marketing.listTvSlides.invalidate();
    },
  });

  const deleteMutation = trpc.extensions.marketing.deleteTvSlide.useMutation({
    onSuccess: () => {
      utils.extensions.marketing.listTvSlides.invalidate();
    },
  });

  const handleSave = () => {
    if (!title.trim()) return;
    if (editingSlide) {
      updateMutation.mutate({
        id: editingSlide.id,
        title: title.trim(),
        body: body.trim() || null,
        durationSeconds,
        sortOrder,
        isActive,
      });
    } else {
      createMutation.mutate({
        title: title.trim(),
        body: body.trim() || undefined,
        durationSeconds,
        sortOrder,
      });
    }
  };

  const handleToggleActive = (slide: SlideItem) => {
    updateMutation.mutate({
      id: slide.id,
      isActive: !slide.isActive,
    });
  };

  const handleDelete = (slide: SlideItem) => {
    if (window.confirm(t("marketing.tv.deleteConfirm", `Naozaj chcete vymazať slajd "${slide.title}"?`))) {
      deleteMutation.mutate({ id: slide.id });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Tv className="w-7 h-7 text-primary" />
            {t("marketing.tv.title", "Čakáreň TV – Slajdy")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t("marketing.tv.description", "Spravujte slajdy zobrazované na TV obrazovke v čakárni, upravujte ich poradie, trvanie a sledujte živý náhľad.")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {practiceId && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => window.open(`/tv/${practiceId}`, "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
              {t("marketing.tv.openPublicScreen", "Otvoriť TV obrazovku")}
            </Button>
          )}
          <Button
            onClick={openCreateDialog}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {t("marketing.tv.newSlide", "Nový slajd")}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="slides">
        <TabsList>
          <TabsTrigger value="slides" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {t("marketing.tv.tabSlides", "Zoznam slajdov")}
          </TabsTrigger>
          <TabsTrigger value="live" className="gap-1.5">
            <Tv className="h-3.5 w-3.5" />
            {t("marketing.tv.tabLive", "TV Naživo v čakárni")}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Správa slajdov ── */}
        <TabsContent value="slides" className="mt-4">
          {/* Edit / Create Dialog Modal */}
          {isDialogOpen && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-lg rounded-xl border bg-background p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between border-b pb-3">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {editingSlide
                      ? t("marketing.tv.editSlideTitle", "Upraviť slajd")
                      : t("marketing.tv.newSlideTitle", "Pridať nový slajd")}
                  </h2>
                  <Button variant="ghost" size="sm" onClick={closeDialog} className="h-8 w-8 p-0">
                    ✕
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      {t("marketing.tv.fieldTitle", "Názov slajdu")} <span className="text-destructive">*</span>
                    </label>
                    <Input
                      placeholder="napr. Sezónna ochrana pred parazitmi"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      {t("marketing.tv.fieldBody", "Podrobný text správy")}
                    </label>
                    <Textarea
                      rows={4}
                      placeholder="Krátky text, ktorý si klienti v čakárni ľahko prečítajú..."
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">
                        {t("marketing.tv.fieldDuration", "Doba zobrazenia (sekundy)")}
                      </label>
                      <Input
                        type="number"
                        min={5}
                        max={60}
                        value={durationSeconds}
                        onChange={(e) =>
                          setDurationSeconds(Math.max(5, Math.min(60, parseInt(e.target.value) || 12)))
                        }
                      />
                      <span className="text-xs text-muted-foreground">Minimálne 5s, max 60s</span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">
                        {t("marketing.tv.fieldSortOrder", "Poradie zobrazenia")}
                      </label>
                      <Input
                        type="number"
                        value={sortOrder}
                        onChange={(e) =>
                          setSortOrder(parseInt(e.target.value) || 0)
                        }
                      />
                      <span className="text-xs text-muted-foreground">Nižšie číslo = skôr</span>
                    </div>
                  </div>

                  {editingSlide && (
                    <div className="flex items-center gap-3 pt-2">
                      <input
                        type="checkbox"
                        id="slide-active"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <label htmlFor="slide-active" className="text-sm font-medium cursor-pointer">
                        {t("marketing.tv.fieldActive", "Aktívny na TV obrazovke")}
                      </label>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={closeDialog}
                    disabled={isPending}
                  >
                    {t("common.cancel", "Zrušiť")}
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={!title.trim() || isPending}
                  >
                    {isPending ? (
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        {t("common.saving", "Ukladám...")}
                      </span>
                    ) : editingSlide ? (
                      t("common.saveChanges", "Uložiť zmeny")
                    ) : (
                      t("marketing.tv.createSlide", "Vytvoriť slajd")
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Slides Data Table */}
          <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
            {listQuery.isLoading ? (
              <div className="p-8 space-y-4">
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
              </div>
            ) : listQuery.data?.length === 0 ? (
              <div className="p-12 text-center border-dashed">
                <Tv className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-foreground">Žiadne vlastné slajdy</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  {t(
                    "marketing.tv.noSlides",
                    "Zatiaľ nemáte vytvorené vlastné slajdy. TV obrazovka automaticky rotuje predvolené veterinárne oznamy. Kliknite na 'Nový slajd' a pridajte prvý vlastný oznam.",
                  )}
                </p>
                <Button onClick={openCreateDialog} className="mt-4 gap-2">
                  <Plus className="h-4 w-4" />
                  {t("marketing.tv.newSlide", "Nový slajd")}
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3 font-medium w-16 text-center">{t("marketing.tv.colOrder", "Poradie")}</th>
                      <th className="px-4 py-3 font-medium">{t("marketing.tv.colTitle", "Názov oznamu")}</th>
                      <th className="px-4 py-3 font-medium">{t("marketing.tv.colContent", "Obsah / Text")}</th>
                      <th className="px-4 py-3 font-medium w-28">{t("marketing.tv.colDuration", "Trvanie")}</th>
                      <th className="px-4 py-3 font-medium w-28 text-center">{t("marketing.tv.colStatus", "Stav")}</th>
                      <th className="px-4 py-3 font-medium w-28 text-right">{t("marketing.tv.colActions", "Akcie")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {listQuery.data?.map((slide: any) => (
                      <tr key={slide.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3.5 text-center font-mono text-xs text-muted-foreground">
                          {slide.sortOrder}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-semibold text-foreground">{slide.title}</span>
                        </td>
                        <td className="px-4 py-3.5 max-w-md">
                          {slide.body ? (
                            <p className="line-clamp-2 text-muted-foreground text-xs">{slide.body}</p>
                          ) : (
                            <span className="italic text-muted-foreground/40 text-xs">
                              {t("marketing.tv.noContent", "Iba hlavný nadpis")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5 text-primary" />
                            <span>{slide.durationSeconds} sekúnd</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(slide)}
                            title={slide.isActive ? "Kliknutím deaktivujete" : "Kliknutím aktivujete"}
                            className="cursor-pointer transition-transform hover:scale-105"
                          >
                            {slide.isActive ? (
                              <Badge
                                variant="default"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                {t("marketing.tv.active", "Aktívny")}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1 text-muted-foreground">
                                <XCircle className="h-3 w-3" />
                                {t("marketing.tv.inactive", "Vypnutý")}
                              </Badge>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              title={t("common.edit", "Upraviť")}
                              onClick={() => openEditDialog(slide)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              title={t("common.delete", "Odstrániť")}
                              onClick={() => handleDelete(slide)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Tab: TV Naživo (embedded waiting room display) ── */}
        <TabsContent value="live" className="mt-4">
          <div className="rounded-xl border bg-card p-1 overflow-hidden shadow-sm">
            <WaitingRoomTv embedded />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
