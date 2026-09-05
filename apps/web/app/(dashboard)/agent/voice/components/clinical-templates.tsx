"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Stethoscope,
  Syringe,
  AlertTriangle,
  Sparkles,
  Bone,
  Check,
  ChevronRight,
  Copy,
  BookOpen,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface ClinicalTemplate {
  id: string;
  title: string;
  category: string;
  icon: React.ElementType;
  badgeColor: string;
  description: string;
  sampleDictation: string;
  keyPhrases: string[];
}

export const CLINICAL_TEMPLATES: ClinicalTemplate[] = [
  {
    id: "preventive_trias",
    title: "Všeobecná prehliadka & Triáda",
    category: "Preventíva",
    icon: Stethoscope,
    badgeColor: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    description: "Kompletné klinické vyšetrenie zdravého pacienta s fyziologickou triádou.",
    sampleDictation:
      "Pes Max, kríženec, 4 roky, kastrovaný pes. Majiteľ prichádza na pravidelnú ročnú preventívnu prehliadku. Doma bez ťažkostí, chuť do jedla výborná, príjem vody normálny, defekácia aj močenie bez patológie. Fyzikálne vyšetrenie: Triáda - telesná teplota 38,5 °C, tepová frekvencia 88 úderov za minútu, dychová frekvencia 22 dychov za minútu, kapilárny návrat CRT pod 2 sekundy, sliznice dutiny ústnej ružové, lesklé a vlhké. Periférne miazgové uzliny nezväčšené, voľne pohyblivé, nebolestivé. Auskultačne srdcové ozvy ohraničené, čisté bez šelestov, vezikulárne dýchanie obojstranne čisté. Palpácia brušnej dutiny nebolestivá, brušný lis mäkký, orgány v normálnych anatomických hraniciach. Koža čistá, srsť lesklá, bez ektoparazitov. Mierny nános zubného kameňa na horných špiciakoch 1. stupňa. Záver: klinicky zdravý jedinec. Plán: odporučená lokálna dentálna hygiena a kontrola o 12 mesiacov.",
    keyPhrases: ["TT 38,5 °C", "TF 88/min", "DF 22/min", "CRT < 2s", "Auskultácia čistá"],
  },
  {
    id: "vaccination_petpass",
    title: "Vakcinácia & PetPass (Besnota)",
    category: "Vakcinácia",
    icon: Syringe,
    badgeColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    description: "Aplikácia kombinovanej vakcíny a primovakcinácia besnoty s lehotou 21 dní.",
    sampleDictation:
      "Fena Bella, labradorský retriever, vek 2 roky, hmotnosť 28,5 kg. Dôvod návštevy: pravidelné očkovanie a vystavenie potvrdenia o spôsobilosti na vycestovanie do zahraničia. Anamnéza bez ťažkostí, odčervená pred 14 dňami. Klinické predvakcinačné vyšetrenie: afebrilná, telesná teplota 38,3 °C, tep 92/min, celkový zdravotný stav výborný, schopná vakcinácie. Aplikovaná kombinovaná vakcína Nobivac DHPPi a vakcína proti besnote Nobivac Rabies, šarža B204A1, subkutánne s.c. do oblasti medzilopatkového priestoru. Aplikácia bez komplikácií. Údaje o vakcinácii zapísané do pasu spoločenského zvieraťa číslo SK 1234567. Majiteľ poučený o 21-dňovej ochrannej lehote pre vycestovanie podľa Nariadenia EÚ č. 576/2013 a o možných nežiaducich účinkoch. Plán: kľudový režim 24 hodín po očkovaní, revakcinácia o 1 rok.",
    keyPhrases: ["Nobivac DHPPi + Rabies", "PetPass SK", "Lehota 21 dní", "Afebrilná", "s.c. medzilopatka"],
  },
  {
    id: "acute_gastroenteritis",
    title: "Akútna gastroenteritída",
    category: "Gastroenterológia",
    icon: AlertTriangle,
    badgeColor: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    description: "Vracanie, vodnatá hnačka, dehydratácia a antiemetická/infúzna terapia.",
    sampleDictation:
      "Mačka Luna, európska krátkosrstá, 3 roky, samica kastrovaná, hmotnosť 3,6 kg. Anamnéza: od včerajšieho večera opakované vracanie peny a žlče, dnes 4-krát vodnatá žltkastá hnačka bez prímesi čerstvej krvi. Od rána úplná inapetencia, príjem vody minimálny, apatia. Klinický nález: dehydratácia cca 6%, kožná riasa sa vracia spomalene, sliznice lepkavé, CRT 2 sekundy, telesná teplota 39,1 °C, tep 160/min. Palpácia brušnej dutiny: mierna obranná reakcia a bolestivosť v mezogastriu, črevné kľučky naplnené tekutinou a plynom, cudzie teleso palpačne nezistené. Diagnóza: akútna gastroenteritída, pravdepodobne alimentárna indiskrécia. Terapia na ambulancii: Maropitant Cerenia 1 mg/kg s.c. jednorazovo, infúzia Ringer-laktát 120 ml i.v. pomaly. Domáca liečba: Pro-Kolin pasta 2 ml p.o. dvakrát denne počas 5 dní. Prísna diéta Royal Canin Gastrointestinal v malých dávkach. Kontrola zajtra dopoludnia, v prípade zhoršenia alebo pretrvávania vracania okamžite.",
    keyPhrases: ["Cerenia 1 mg/kg s.c.", "Ringer-laktát i.v.", "Pro-Kolin p.o. b.i.d.", "Dehydratácia 6%"],
  },
  {
    id: "dermatology_otitis",
    title: "Dermatológia & Otitis Externa",
    category: "Dermatológia",
    icon: Sparkles,
    badgeColor: "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
    description: "Pruritus labiek, erytém, kvasinková otitída s cytológiou a cielenou liečbou.",
    sampleDictation:
      "Pes Blesk, francúzsky buldoček, 5 rokov, hmotnosť 12,8 kg. Anamnéza: silný pruritus trvajúci 2 týždne, vyhrýzanie medziprstia na všetkých štyroch končatinách a intenzívne škriabanie uší s trasením hlavou. Objektívny nález: TT 38,6 °C, TF 96/min. Dermatologické vyšetrenie: výrazný interdigitálny erytém, hnedasté zafarbenie srsti zo slín, alopécia a mierna lichenifikácia. Otoskopia: bilaterálny erytém vertikálneho aj horizontálneho zvukovodu, masívny tmavohnedý ceruminózny exsudát. Cytologické vyšetrenie steru z uší: masívny záchyt kvasiniek Malassezia pachydermatis (viac ako 15 na zorné pole), baktérie ojedinele. Diagnóza: atopická dermatitída s komplikujúcou obojstrannou kvasinkovou otitídou. Terapeutický plán: toaleta zvukovodov čistiacim roztokom Otodine, lokálne ušné kvapky Posatex 1x denne 7 kvapiek do každého ucha počas 10 dní. Systémovo na kontrolu pruritu Apoquel 5,4 mg p.o. dvakrát denne b.i.d. počas 14 dní, následne zníženie na 1x denne. Kúpeľ v liečebnom šampóne Malaseb 2x týždenne. Kontrolná otoskopia a cytológia o 14 dní.",
    keyPhrases: ["Malassezia pachydermatis", "Apoquel 5,4 mg", "Posatex gtt", "Malaseb šampón"],
  },
  {
    id: "orthopedics_lameness",
    title: "Ortopédia & Ruptúra väzu (CCL)",
    category: "Chirurgia & Ortopédia",
    icon: Bone,
    badgeColor: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
    description: "Krívanie panvovej končatiny, zásuvkový test, palpačná krepitácia a plán TPLO.",
    sampleDictation:
      "Pes Rocky, nemecký ovčiak, 6 rokov, nekastrovaný samec, hmotnosť 36 kg. Dôvod návštevy: náhle vzniknuté krívanie na pravú panvovú končatinu pred 3 dňami po prudkom doskoku pri aportovaní. Objektívne vyšetrenie: ortopedické hodnotenie - krívanie na pravú panvovú končatinu 3. až 4. stupňa z 5, končatinu odľahčuje, našľapuje len na končeky prstov. Palpačne: opuch pravého kolenného kĺbu, kĺbová efúzia, zhrubnutie mediálneho aspektu (medial buttress sign). Pozitívny predný zásuvkový test (cranial drawer test) a pozitívny tibiálny kompresný test. RTG vyšetrenie kolenného kĺbu v sedácii: periartikulárne osteofyty, intrakapsulárny tieň tekutiny, posun tíbie kraniálne. Diagnóza: kompletná ruptúra predného skríženého väzu (cranial cruciate ligament rupture - CCLR) pravého kolena. Terapeutický plán: Meloxoral 1,5 mg/ml perorálna suspenzia, iniciálna dávka 0,2 mg/kg p.o. dnes, následne 0,1 mg/kg jedenkrát denne s krmivom. Striktný kľudový režim, venčenie výlučne na krátkom vodítku. Majiteľovi doporučená chirurgická stabilizácia kolena metódou TPLO (Tibial Plateau Leveling Osteotomy). Termín predoperačného vyšetrenia stanovený na pondelok.",
    keyPhrases: ["Ruptúra CCL", "Zásuvkový test pozitívny", "TPLO operácia", "Meloxoral 0,1 mg/kg"],
  },
];

interface ClinicalTemplatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (templateText: string, title: string) => void;
}

export function ClinicalTemplatesModal({
  open,
  onOpenChange,
  onSelectTemplate,
}: ClinicalTemplatesModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<ClinicalTemplate>(
    CLINICAL_TEMPLATES[0]!,
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Vzor skopírovaný do schránky");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUse = (template: ClinicalTemplate) => {
    onSelectTemplate(template.sampleDictation, template.title);
    onOpenChange(false);
    toast.success(`Šablóna „${template.title}“ vložená`);
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-card rounded-2xl border shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-violet-600 flex items-center justify-center text-white">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">
                Klinické vzory & šablóny diktovania
              </h2>
              <p className="text-xs text-muted-foreground">
                Oficiálna slovenská veterinárna prax (ŠVPS SR & KVL SR). Kliknite pre náhľad a vloženie.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 p-0 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden min-h-0">
          {/* Sidebar with template list */}
          <div className="md:col-span-5 border-r overflow-y-auto p-2 space-y-1.5 bg-muted/20">
            {CLINICAL_TEMPLATES.map((tmpl) => {
              const Icon = tmpl.icon;
              const isSelected = tmpl.id === selectedTemplate.id;
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setSelectedTemplate(tmpl)}
                  className={cn(
                    "w-full text-left rounded-lg p-2.5 transition-all text-xs",
                    "border flex items-start gap-2.5",
                    isSelected
                      ? "border-violet-500 bg-violet-50 dark:bg-violet-950/40 shadow-sm"
                      : "border-transparent hover:bg-muted/60",
                  )}
                >
                  <div
                    className={cn(
                      "h-7 w-7 rounded-md flex items-center justify-center shrink-0 mt-0.5",
                      tmpl.badgeColor,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-foreground truncate">
                        {tmpl.title}
                      </span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    </div>
                    <span className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                      {tmpl.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Template detail */}
          <div className="md:col-span-7 flex flex-col overflow-y-auto p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <Badge variant="outline" className={cn("text-[11px] font-medium mb-1", selectedTemplate.badgeColor)}>
                  {selectedTemplate.category}
                </Badge>
                <h3 className="text-base font-semibold tracking-tight">
                  {selectedTemplate.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedTemplate.description}
                </p>
              </div>
            </div>

            {/* Key phrases */}
            <div>
              <span className="text-xs font-medium text-muted-foreground block mb-1.5">
                Kľúčové klinické pojmy & liečivá
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedTemplate.keyPhrases.map((phrase, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-mono text-foreground border"
                  >
                    {phrase}
                  </span>
                ))}
              </div>
            </div>

            {/* Full text */}
            <div className="space-y-1.5 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Znenie ukážkového diktátu
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(selectedTemplate.sampleDictation, selectedTemplate.id)}
                  className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                >
                  {copiedId === selectedTemplate.id ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copiedId === selectedTemplate.id ? "Skopírované" : "Kopírovať text"}
                </Button>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed font-sans whitespace-pre-wrap flex-1 max-h-[260px] overflow-y-auto">
                {selectedTemplate.sampleDictation}
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-2 border-t flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Zavrieť
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => handleUse(selectedTemplate)}
                className="gap-1.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Vložiť vzor do diktovania
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
