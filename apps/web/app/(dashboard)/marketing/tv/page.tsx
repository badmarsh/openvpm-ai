"use client";

import { useState } from "react";
import { Plus, Tv, Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WaitingRoomTv } from "@/components/waiting-room/waiting-room-tv";

export default function TvSlidesPage() {
  const { t } = useI18n();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(12);
  const [sortOrder, setSortOrder] = useState(0);

  const utils = trpc.useUtils();
  const listQuery = trpc.extensions.marketing.listTvSlides.useQuery();

  const createMutation = trpc.extensions.marketing.createTvSlide.useMutation({
    onSuccess: () => {
      setIsDialogOpen(false);
      utils.extensions.marketing.listTvSlides.invalidate();
      setTitle("");
      setBody("");
      setDurationSeconds(12);
      setSortOrder(0);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Tv className="h-6 w-6" />
          {t("marketing.tv.title", "Čakáreň TV – Slajdy")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("marketing.tv.description", "Spravujte slajdy zobrazované na TV obrazovke v čakárni a sledujte živý náhľad.")}
        </p>
      </div>

      <Tabs defaultValue="slides">
        <TabsList>
          <TabsTrigger value="slides" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {t("marketing.tv.tabSlides", "Slajdy")}
          </TabsTrigger>
          <TabsTrigger value="live" className="gap-1.5">
            <Tv className="h-3.5 w-3.5" />
            {t("marketing.tv.tabLive", "TV Naživo")}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Správa slajdov ── */}
        <TabsContent value="slides">
          <div className="flex items-center justify-end gap-2 pt-2">
            {!isDialogOpen && (
              <Button
                onClick={() => setIsDialogOpen(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {t("marketing.tv.newSlide", "Nový slajd")}
              </Button>
            )}
          </div>

          {isDialogOpen && (
            <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
              <div className="fixed z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg sm:rounded-lg">
                <div className="flex flex-col space-y-1.5 text-center sm:text-left">
                  <h2 className="text-lg font-semibold leading-none tracking-tight">
                    {t("marketing.tv.newSlide", "Nový slajd")}
                  </h2>
                </div>

                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Title</label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Body (optional)
                    </label>
                    <Textarea
                      rows={3}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Duration (sec)
                      </label>
                      <Input
                        type="number"
                        min={5}
                        max={60}
                        value={durationSeconds}
                        onChange={(e) =>
                          setDurationSeconds(parseInt(e.target.value) || 12)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Sort Order</label>
                      <Input
                        type="number"
                        value={sortOrder}
                        onChange={(e) =>
                          setSortOrder(parseInt(e.target.value) || 0)
                        }
                      />
                    </div>
                  </div>
                  <Button
                    className="w-full mt-2"
                    onClick={() =>
                      createMutation.mutate({
                        title,
                        body,
                        durationSeconds,
                        sortOrder,
                      })
                    }
                    disabled={!title || createMutation.isPending}
                  >
                    Create
                  </Button>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-xl border bg-card overflow-hidden mt-4">
            {listQuery.isLoading ? (
              <div className="p-4 space-y-4">
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
              </div>
            ) : listQuery.data?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground border-dashed">
                {t(
                  "marketing.tv.noSlides",
                  "Žiadne slajdy. Pridajte prvý slajd alebo prepnite na TV Naživo pre náhľad čakárne.",
                )}
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Content</th>
                    <th className="px-4 py-3 font-medium">Duration</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {listQuery.data?.map((slide: any) => (
                    <tr key={slide.id} className="border-b border-border">
                      <td className="px-4 py-3">{slide.sortOrder}</td>
                      <td className="px-4 py-3">{slide.title}</td>
                      <td className="px-4 py-3">
                        {slide.body || (
                          <span className="italic text-muted-foreground/50">
                            No content
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{slide.durationSeconds}s</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {slide.isActive ? (
                          <Badge
                            variant="default"
                            className="bg-emerald-500 hover:bg-emerald-600"
                          >
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* ── Tab: TV Naživo (embedded waiting room display) ── */}
        <TabsContent value="live">
          <WaitingRoomTv embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
