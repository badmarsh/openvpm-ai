"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Image as ImageIcon, Plus, Trash2, Check, Sparkles } from "lucide-react";
import { WebsiteMediaPickerDialog } from "./website-media-picker-dialog";
import type { WebsiteSection } from "@/lib/marketing/website-builder-types";

interface WebsiteEditorSheetProps {
  section: WebsiteSection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedSection: WebsiteSection) => void;
}

export function WebsiteEditorSheet({
  section,
  open,
  onOpenChange,
  onSave,
}: WebsiteEditorSheetProps) {
  const [draftContent, setDraftContent] = useState<any>({});
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaTargetField, setMediaTargetField] = useState<string>("");

  useEffect(() => {
    if (section) {
      setDraftContent(JSON.parse(JSON.stringify(section.content)));
    }
  }, [section]);

  if (!section) return null;

  const updateField = (field: string, value: any) => {
    setDraftContent((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleMediaSelected = (url: string) => {
    if (mediaTargetField === "gallery") {
      const currentImages = draftContent.images || [];
      updateField("images", [
        ...currentImages,
        { id: `img-${Date.now()}`, url, altText: "Foto kliniky", caption: "" },
      ]);
    } else {
      updateField(mediaTargetField, url);
    }
  };

  const handleSave = () => {
    onSave({
      ...section,
      content: draftContent,
    });
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto flex flex-col gap-6">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Úprava sekcie: <span className="capitalize">{section.type.replace("_", " ")}</span>
            </SheetTitle>
            <SheetDescription>
              Upravte texty a možnosti zobrazenia sekcie. Zmeny sa prejavia v náhľade.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 py-2">
            {/* HERO SECTION */}
            {section.type === "hero" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Odznak v záhlaví</Label>
                  <Input
                    value={draftContent.badge || ""}
                    onChange={(e) => updateField("badge", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Hlavný nadpis kliniky</Label>
                  <Input
                    value={draftContent.title || ""}
                    onChange={(e) => updateField("title", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Podtitul a popis praxe</Label>
                  <Textarea
                    rows={3}
                    value={draftContent.subtitle || ""}
                    onChange={(e) => updateField("subtitle", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Text hlavného tlačidla</Label>
                    <Input
                      value={draftContent.primaryCtaText || ""}
                      onChange={(e) => updateField("primaryCtaText", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Text druhého tlačidla</Label>
                    <Input
                      value={draftContent.secondaryCtaText || ""}
                      onChange={(e) => updateField("secondaryCtaText", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-border">
                  <Label>Obrázok na pozadí (voliteľné)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="https://..."
                      value={draftContent.backgroundImage || ""}
                      onChange={(e) => updateField("backgroundImage", e.target.value || null)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMediaTargetField("backgroundImage");
                        setMediaPickerOpen(true);
                      }}
                      className="shrink-0 gap-1.5"
                    >
                      <ImageIcon className="h-4 w-4" />
                      Knižnica
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Label htmlFor="contact-card-toggle">Zobraziť kontaktnú kartu vpravo</Label>
                  <Switch
                    id="contact-card-toggle"
                    checked={draftContent.showContactCard !== false}
                    onCheckedChange={(c) => updateField("showContactCard", c)}
                  />
                </div>
              </div>
            )}

            {/* ABOUT SECTION */}
            {section.type === "about" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nadpis sekcie</Label>
                  <Input
                    value={draftContent.title || ""}
                    onChange={(e) => updateField("title", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Podtitul</Label>
                  <Input
                    value={draftContent.subtitle || ""}
                    onChange={(e) => updateField("subtitle", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Text príbehu (podporuje bezpečný markdown)</Label>
                  <Textarea
                    rows={6}
                    value={draftContent.story || ""}
                    onChange={(e) => updateField("story", e.target.value)}
                  />
                </div>
                <div className="space-y-2 pt-2 border-t border-border">
                  <Label>Fotografia ambulancie</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="https://..."
                      value={draftContent.imageUrl || ""}
                      onChange={(e) => updateField("imageUrl", e.target.value || null)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMediaTargetField("imageUrl");
                        setMediaPickerOpen(true);
                      }}
                      className="shrink-0 gap-1.5"
                    >
                      <ImageIcon className="h-4 w-4" />
                      Knižnica
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Umiestnenie fotografie</Label>
                  <Select
                    value={draftContent.imagePosition || "right"}
                    onValueChange={(val) => updateField("imagePosition", val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="right">Vpravo</SelectItem>
                      <SelectItem value="left">Vľavo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* SERVICES SECTION */}
            {section.type === "services" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nadpis sekcie</Label>
                  <Input
                    value={draftContent.title || ""}
                    onChange={(e) => updateField("title", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Podtitul</Label>
                  <Input
                    value={draftContent.subtitle || ""}
                    onChange={(e) => updateField("subtitle", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Počet stĺpcov</Label>
                  <Select
                    value={draftContent.columns || "3"}
                    onValueChange={(val) => updateField("columns", val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 stĺpce</SelectItem>
                      <SelectItem value="3">3 stĺpce</SelectItem>
                      <SelectItem value="4">4 stĺpce</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <Label className="font-bold">Zoznam služieb ({draftContent.services?.length || 0})</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const current = draftContent.services || [];
                        updateField("services", [
                          ...current,
                          {
                            id: `srv-${Date.now()}`,
                            icon: "Stethoscope",
                            title: "Nová veterinárna služba",
                            description: "Popis poskytovaného vyšetrenia alebo zákroku.",
                          },
                        ]);
                      }}
                      className="gap-1 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Pridať službu
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {(draftContent.services || []).map((srv: any, idx: number) => (
                      <div key={srv.id} className="rounded-xl border border-border p-3 bg-muted/20 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Input
                            placeholder="Názov služby"
                            value={srv.title}
                            onChange={(e) => {
                              const updated = [...draftContent.services];
                              updated[idx].title = e.target.value;
                              updateField("services", updated);
                            }}
                            className="font-semibold text-xs h-8"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              const updated = draftContent.services.filter((_: any, i: number) => i !== idx);
                              updateField("services", updated);
                            }}
                            className="h-8 w-8 text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Textarea
                          placeholder="Popis služby"
                          rows={2}
                          value={srv.description}
                          onChange={(e) => {
                            const updated = [...draftContent.services];
                            updated[idx].description = e.target.value;
                            updateField("services", updated);
                          }}
                          className="text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* FAQ SECTION */}
            {section.type === "faq" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nadpis sekcie</Label>
                  <Input
                    value={draftContent.title || ""}
                    onChange={(e) => updateField("title", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Podtitul</Label>
                  <Input
                    value={draftContent.subtitle || ""}
                    onChange={(e) => updateField("subtitle", e.target.value)}
                  />
                </div>

                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <Label className="font-bold">Otázky & Odpovede ({draftContent.items?.length || 0})</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const current = draftContent.items || [];
                        updateField("items", [
                          ...current,
                          {
                            id: `faq-${Date.now()}`,
                            question: "Nová otázka?",
                            answer: "Odpoveď na často kladenú otázku klienta.",
                          },
                        ]);
                      }}
                      className="gap-1 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Pridať otázku
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {(draftContent.items || []).map((faq: any, idx: number) => (
                      <div key={faq.id} className="rounded-xl border border-border p-3 bg-muted/20 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Input
                            placeholder="Otázka"
                            value={faq.question}
                            onChange={(e) => {
                              const updated = [...draftContent.items];
                              updated[idx].question = e.target.value;
                              updateField("items", updated);
                            }}
                            className="font-semibold text-xs h-8"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              const updated = draftContent.items.filter((_: any, i: number) => i !== idx);
                              updateField("items", updated);
                            }}
                            className="h-8 w-8 text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Textarea
                          placeholder="Odpoveď"
                          rows={2}
                          value={faq.answer}
                          onChange={(e) => {
                            const updated = [...draftContent.items];
                            updated[idx].answer = e.target.value;
                            updateField("items", updated);
                          }}
                          className="text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* REVIEWS SECTION */}
            {section.type === "reviews" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nadpis sekcie</Label>
                  <Input
                    value={draftContent.title || ""}
                    onChange={(e) => updateField("title", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Rozloženie zobrazenia</Label>
                  <Select
                    value={draftContent.layout || "grid"}
                    onValueChange={(val) => updateField("layout", val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grid">Mriežka (Grid)</SelectItem>
                      <SelectItem value="carousel">Karusel (Slider)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Minimálny počet hviezdičiek</Label>
                  <Select
                    value={String(draftContent.minRating || 4)}
                    onValueChange={(val) => updateField("minRating", Number(val))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4 a 5 hviezdičkové</SelectItem>
                      <SelectItem value="5">Len 5 hviezdičkové</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* GALLERY SECTION */}
            {section.type === "gallery" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nadpis galérie</Label>
                  <Input
                    value={draftContent.title || ""}
                    onChange={(e) => updateField("title", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Rozloženie</Label>
                  <Select
                    value={draftContent.layout || "grid"}
                    onValueChange={(val) => updateField("layout", val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grid">Mriežka (Grid)</SelectItem>
                      <SelectItem value="carousel">Karusel (Slider)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <Label className="font-bold">Fotografie ({draftContent.images?.length || 0})</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMediaTargetField("gallery");
                        setMediaPickerOpen(true);
                      }}
                      className="gap-1.5 text-xs"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      Pridať z knižnice
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto">
                    {(draftContent.images || []).map((img: any, idx: number) => (
                      <div key={img.id} className="relative rounded-lg overflow-hidden border border-border aspect-square group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt="Foto" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = draftContent.images.filter((_: any, i: number) => i !== idx);
                            updateField("images", updated);
                          }}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* EMERGENCY BANNER SECTION */}
            {section.type === "emergency_banner" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Výstražný text</Label>
                  <Input
                    value={draftContent.alertText || ""}
                    onChange={(e) => updateField("alertText", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Doplňujúce inštrukcie</Label>
                  <Textarea
                    rows={2}
                    value={draftContent.subtext || ""}
                    onChange={(e) => updateField("subtext", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Pohotovostné telefónne číslo</Label>
                  <Input
                    value={draftContent.phone || ""}
                    onChange={(e) => updateField("phone", e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <Label htmlFor="dismiss-toggle">Umožniť návštevníkovi skryť banner</Label>
                  <Switch
                    id="dismiss-toggle"
                    checked={draftContent.dismissible !== false}
                    onCheckedChange={(c) => updateField("dismissible", c)}
                  />
                </div>
              </div>
            )}

            {/* VIDEO EMBED SECTION */}
            {section.type === "video_embed" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nadpis sekcie</Label>
                  <Input
                    value={draftContent.title || ""}
                    onChange={(e) => updateField("title", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>URL adresa videa (YouTube alebo Vimeo)</Label>
                  <Input
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={draftContent.videoUrl || ""}
                    onChange={(e) => updateField("videoUrl", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Pomer strán</Label>
                  <Select
                    value={draftContent.aspectRatio || "16:9"}
                    onValueChange={(val) => updateField("aspectRatio", val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9">16:9 (Štandard)</SelectItem>
                      <SelectItem value="4:3">4:3 (Klasický)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Popisok pod videom</Label>
                  <Input
                    value={draftContent.caption || ""}
                    onChange={(e) => updateField("caption", e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* CUSTOM RICH TEXT SECTION */}
            {section.type === "custom_rich_text" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nadpis bloku</Label>
                  <Input
                    value={draftContent.title || ""}
                    onChange={(e) => updateField("title", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Formátovaný text (Markdown)</Label>
                  <Textarea
                    rows={8}
                    value={draftContent.content || ""}
                    onChange={(e) => updateField("content", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Zarovnanie</Label>
                  <Select
                    value={draftContent.alignment || "left"}
                    onValueChange={(val) => updateField("alignment", val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Vľavo</SelectItem>
                      <SelectItem value="center">Na stred</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* STATS SECTION */}
            {section.type === "stats" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nadpis sekcie</Label>
                  <Input
                    value={draftContent.title || ""}
                    onChange={(e) => updateField("title", e.target.value)}
                  />
                </div>
                <div className="space-y-3 pt-2">
                  <Label className="font-bold">Hodnoty & Popisky</Label>
                  {(draftContent.items || []).map((item: any, idx: number) => (
                    <div key={item.id} className="grid grid-cols-2 gap-2 p-2 border border-border rounded-lg bg-muted/20">
                      <Input
                        placeholder="Hodnota (napr. 15+)"
                        value={item.value}
                        onChange={(e) => {
                          const updated = [...draftContent.items];
                          updated[idx].value = e.target.value;
                          updateField("items", updated);
                        }}
                        className="text-xs h-8"
                      />
                      <Input
                        placeholder="Popis (napr. Rokov praxe)"
                        value={item.label}
                        onChange={(e) => {
                          const updated = [...draftContent.items];
                          updated[idx].label = e.target.value;
                          updateField("items", updated);
                        }}
                        className="text-xs h-8"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CONTACT FORM SECTION */}
            {section.type === "contact_form" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nadpis formulára</Label>
                  <Input
                    value={draftContent.title || ""}
                    onChange={(e) => updateField("title", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Podtitul</Label>
                  <Input
                    value={draftContent.subtitle || ""}
                    onChange={(e) => updateField("subtitle", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Správa po úspešnom odoslaní</Label>
                  <Input
                    value={draftContent.successMessage || ""}
                    onChange={(e) => updateField("successMessage", e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <Label htmlFor="phone-field-toggle">Zobraziť pole pre telefónne číslo</Label>
                  <Switch
                    id="phone-field-toggle"
                    checked={draftContent.showPhoneField !== false}
                    onCheckedChange={(c) => updateField("showPhoneField", c)}
                  />
                </div>
              </div>
            )}

            {/* HOURS & LOCATION SECTION */}
            {section.type === "hours_location" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nadpis sekcie</Label>
                  <Input
                    value={draftContent.title || ""}
                    onChange={(e) => updateField("title", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Pohotovostná poznámka</Label>
                  <Input
                    value={draftContent.emergencyNote || ""}
                    onChange={(e) => updateField("emergencyNote", e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <Label htmlFor="map-toggle">Zobraziť mapu</Label>
                  <Switch
                    id="map-toggle"
                    checked={draftContent.showMap !== false}
                    onCheckedChange={(c) => updateField("showMap", c)}
                  />
                </div>
              </div>
            )}

            {/* BOOKING CTA SECTION */}
            {section.type === "booking_cta" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Hlavný nadpis výzvy</Label>
                  <Input
                    value={draftContent.title || ""}
                    onChange={(e) => updateField("title", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Podtitul</Label>
                  <Textarea
                    rows={2}
                    value={draftContent.subtitle || ""}
                    onChange={(e) => updateField("subtitle", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Text rezervačného tlačidla</Label>
                  <Input
                    value={draftContent.buttonText || ""}
                    onChange={(e) => updateField("buttonText", e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <Label htmlFor="phone-cta-toggle">Zobraziť tlačidlo telefonovania</Label>
                  <Switch
                    id="phone-cta-toggle"
                    checked={draftContent.showPhoneButton !== false}
                    onCheckedChange={(c) => updateField("showPhoneButton", c)}
                  />
                </div>
              </div>
            )}
          </div>

          <SheetFooter className="pt-4 border-t border-border flex items-center justify-between">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Zrušiť
            </Button>
            <Button onClick={handleSave} className="gap-2 font-bold">
              <Check className="h-4 w-4" />
              Použiť zmeny
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <WebsiteMediaPickerDialog
        open={mediaPickerOpen}
        onOpenChange={setMediaPickerOpen}
        onSelectImage={handleMediaSelected}
      />
    </>
  );
}
