import type { Database } from "@openpims/db/client";
import {
  extMarketingTvSlides,
  extMarketingHandouts,
  extMarketingReviews,
  extMarketingContentBatches,
  extMarketingContentItems,
  extMarketingMediaConsents,
  extMarketingMediaAssets,
  extMarketingStaffTasks,
  extMarketingMessageTemplates,
  extMarketingMessageLogs,
  extMarketingAutomationRules,
  extMarketingOperativeScripts,
  extMarketingRecallSchedules,
  extMarketingCompetitorSnapshots,
} from "@openpims/db";

export interface MarketingDemoIds {
  marketingTvSlideIds: string[];
  marketingHandoutIds: string[];
  marketingReviewIds: string[];
  marketingContentBatchIds: string[];
  marketingContentItemIds: string[];
  marketingMediaConsentIds: string[];
  marketingMediaAssetIds: string[];
  marketingStaffTaskIds: string[];
  marketingMessageTemplateIds: string[];
  marketingMessageLogIds: string[];
  marketingAutomationRuleIds: string[];
  marketingScriptIds: string[];
  marketingRecallScheduleIds: string[];
  marketingCompetitorSnapshotIds: string[];
}

const EMPTY_IDS: MarketingDemoIds = {
  marketingTvSlideIds: [],
  marketingHandoutIds: [],
  marketingReviewIds: [],
  marketingContentBatchIds: [],
  marketingContentItemIds: [],
  marketingMediaConsentIds: [],
  marketingMediaAssetIds: [],
  marketingStaffTaskIds: [],
  marketingMessageTemplateIds: [],
  marketingMessageLogIds: [],
  marketingAutomationRuleIds: [],
  marketingScriptIds: [],
  marketingRecallScheduleIds: [],
  marketingCompetitorSnapshotIds: [],
};

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function mondayOfCurrentWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Seed demo content for the Marketing Studio extension so every page
 * (Content Plan, TV, Handouts, Reviews, Scripts, Consents, Media,
 *  Automations, Messages, Competitors, Recall) shows realistic Slovak
 * veterinary clinic data on a fresh trial.
 */
export async function seedMarketingDemoData(
  db: Database,
  opts: {
    practiceId: string;
    ownerId: string | null;
    clientIds: string[];
    patientIds: string[];
    appointmentIds: string[];
  }
): Promise<MarketingDemoIds> {
  const { practiceId, ownerId, clientIds, patientIds, appointmentIds } = opts;
  const adminId = ownerId ?? "00000000-0000-0000-0000-000000000000";
  const ids = { ...EMPTY_IDS };

  // ── 1. TV Slides ─────────────────────────────────────────────────────────
  const tvSlides = await db
    .insert(extMarketingTvSlides)
    .values([
      {
        practiceId,
        createdBy: adminId,
        title: "Očkovanie chráni vášho miláčika",
        body: "Pravidelné očkovanie je najlepšia prevencia. Kontaktujte nás pre aktuálny očkovací kalendár.",
        durationSeconds: 12,
        sortOrder: 0,
        isActive: true,
      },
      {
        practiceId,
        createdBy: adminId,
        title: "Wellness program – prevencia výhodnejšia",
        body: "Získajte preventívnu starostlivosť za výhodnejšiu cenu. Pridajte sa do wellness programu ešte dnes!",
        durationSeconds: 10,
        sortOrder: 1,
        isActive: true,
      },
      {
        practiceId,
        createdBy: adminId,
        title: "Dentálna hygiena psov a mačiek",
        body: "Pravidelné čistenie zubov predchádza parodontóze. Objednajte sa na dentálnu prehliadku.",
        durationSeconds: 12,
        sortOrder: 2,
        isActive: true,
      },
      {
        practiceId,
        createdBy: adminId,
        title: "Náš tím – vaši partneri v starostlivosti",
        body: "S úctou a profesionalitou staráme o vašich miláčikov už viac ako 10 rokov.",
        durationSeconds: 15,
        sortOrder: 3,
        isActive: true,
      },
      {
        practiceId,
        createdBy: adminId,
        title: "Edukačné letáky zdarma",
        body: "Stiahnite si naše letáky o starostlivosti o zviera na QR kód nižšie.",
        durationSeconds: 8,
        sortOrder: 4,
        isActive: true,
      },
    ])
    .returning({ id: extMarketingTvSlides.id });
  ids.marketingTvSlideIds = tvSlides.map((s) => s.id);

  // ── 2. Handouts ──────────────────────────────────────────────────────────
  const handouts = await db
    .insert(extMarketingHandouts)
    .values([
      {
        practiceId,
        createdBy: adminId,
        slug: "starostlivost-po-sterilizacii",
        title: "Starostlivosť po kastrácii/sterilizácii",
        body: "Prvé 24 hodín: Udržujte zviera v teple a pokoji. Ponúknite iba malé množstvo vody. Kŕmte až na druhý deň ľahkou stravou.\n\nTýždeň po zákroku: Obmedzte pohyb – žiadne skákanie a beh. Kontrolujte ranu 2× denne. Zabráňte lízaniu rany (náhrdelník).\n\nKedy kontaktovať veterinára: Opuch, sčervenanie alebo hnis v rane. Zviera odmieta jesť viac ako 24 hodín. Vracanie alebo hnačka trvajúca viac ako 12 hodín.",
        species: ["canine", "feline"],
        tags: ["chirurgia", "pooperačná starostlivosť"],
        isPublic: true,
      },
      {
        practiceId,
        createdBy: adminId,
        slug: "prevencia-parazitov",
        title: "Prevencia parazitov u domácich zvierat",
        body: "Blyšky a kliešte: Používajte prípravky podľa hmotnosti zvieraťa. Aplikujte pravidelne podľa návodu. Skontrolujte zviera po každej prechádzke v prírode.\n\nOdčervovanie: Šteňatá a mačiatka každé 2–4 týždne do veku 6 mesiacov. Dospelé zvieratá 4× ročne.\n\nSrdečný červ (Dirofilaria immitis): Prevencia je kľúčová – liečba je náročná a drahá. Mesačná profylaxia počas sezóny komárov.",
        species: ["canine", "feline"],
        tags: ["parazitológia", "prevencia"],
        isPublic: true,
      },
      {
        practiceId,
        createdBy: adminId,
        slug: "vyziva-psa",
        title: "Správna výživa psa",
        body: "Základné princípy: Vhodné množstvo podľa veku, hmotnosti a aktivity. Kvalitná krmiva s deklarovaným zložením. Čistá čerstvá voda k dispozícii neustále.\n\nČo nekŕmiť: Čokoláda, hrozienka, cibuľa, cesnak. Kosti varené – hrozí perforácia čriev. Xylitol (sladidlo) – smrteľne toxický.\n\nHmotnosť: Obezita je najčastejšie výživové ochorenie. Pravidelne kontrolujte hmotnosť.",
        species: ["canine"],
        tags: ["výživa", "prevencia"],
        isPublic: true,
      },
      {
        practiceId,
        createdBy: adminId,
        slug: "starostlivost-o-zuby-macky",
        title: "Dentálna starostlivosť o mačku",
        body: "Prečo je dôležitá: 70% mačiek nad 3 roky má dentálne ochorenie. Parodontóza spôsobuje bolesť a infekciu.\n\nDoma: Čistenie zubov špeciálnou kefkou (ideálne denne). Dentálne pamlsky ako doplnok.\n\nProfesionálna starostlivosť: Dentálna prehliadka pri každej návšteve. Profesionálne čistenie pod anestéziou podľa potreby.",
        species: ["feline"],
        tags: ["dentálna", "prevencia"],
        isPublic: true,
      },
    ])
    .returning({ id: extMarketingHandouts.id });
  ids.marketingHandoutIds = handouts.map((h) => h.id);

  // ── 3. Reviews ───────────────────────────────────────────────────────────
  const reviews = await db
    .insert(extMarketingReviews)
    .values([
      {
        practiceId,
        platform: "google",
        clientId: clientIds[0],
        patientId: patientIds[0],
        appointmentId: appointmentIds[0] ?? null,
        rating: 5,
        reviewText: "Najlepšia veterinárna klinika! Biscuit sa vždy teší na návštevu. Doktor je veľmi trpezlivý a vysvetlí všetko.",
        reviewerName: "Jordan Avery",
        receivedAt: daysAgo(3),
        replyText: "Ďakujeme za milé slová a dôveru v náš tím pri starostlivosti o vášho miláčika! S úctou, tím veterinárnej kliniky.",
        repliedAt: daysAgo(2),
        repliedBy: adminId,
        requestSentAt: daysAgo(5),
      },
      {
        practiceId,
        platform: "google",
        clientId: clientIds[1],
        patientId: patientIds[1],
        rating: 4,
        reviewText: "Profesionálna starostlivosť, iba čakacia doba bola trochu dlhšia. Inak spokojnosť.",
        reviewerName: "Sam Rivera",
        receivedAt: daysAgo(7),
        requestSentAt: daysAgo(9),
      },
      {
        practiceId,
        platform: "facebook",
        clientId: clientIds[2],
        patientId: patientIds[2],
        rating: 5,
        reviewText: "Odporúča kliniku: Skvelá klinika! Mango dostal najlepšiu starostlivosť. Odporúčam každému chovateľovi.",
        reviewerName: "Taylor Brooks",
        receivedAt: daysAgo(10),
        replyText: "Veľmi si vážime vašu spätnú väzbu. Sme radi, že ošetrenie prebehlo bez komplikácií! 🐾",
        repliedAt: daysAgo(9),
        repliedBy: adminId,
        requestSentAt: daysAgo(12),
      },
      {
        practiceId,
        platform: "google",
        externalReviewId: "google_demo_1",
        rating: 4,
        reviewText: "Boli sme v núdzovke a čakali sme kvôli akútnemu prípadu pred nami. Personál príjemný a všetko dobre dopadlo.",
        reviewerName: "Martina K.",
        receivedAt: daysAgo(14),
      },
      {
        practiceId,
        platform: "facebook",
        externalReviewId: "fb_demo_1",
        rating: 5,
        reviewText: "Odporúča Veterinárnu kliniku: Už 5 rokov chodíme sem a nikdy sme neboli sklamaní. Úplne odporúčam!",
        reviewerName: "Peter H.",
        receivedAt: daysAgo(21),
        replyText: "Ďakujeme za dôveru po všetky tieto roky! Je cťou starať sa o vašich miláčikov. 🙏",
        repliedAt: daysAgo(20),
        repliedBy: adminId,
      },
    ])
    .returning({ id: extMarketingReviews.id });
  ids.marketingReviewIds = reviews.map((r) => r.id);

  // ── 4. Content Plan ──────────────────────────────────────────────────────
  const batches = await db
    .insert(extMarketingContentBatches)
    .values([
      { practiceId, weekStart: mondayOfCurrentWeek(), status: "approved" },
    ])
    .returning({ id: extMarketingContentBatches.id });
  ids.marketingContentBatchIds = batches.map((b) => b.id);

  const contentItems = await db
    .insert(extMarketingContentItems)
    .values([
      {
        practiceId,
        batchId: batches[0]!.id,
        createdBy: adminId,
        title: "Očkovací deň – zľava 20%",
        body: "🗓 Tento týždeň máme Očkovací deň! Všetky vakcíny so 20% zľavou. Ochráňte svojho miláčika a ušetrite. #Veterina #Ockovanie",
        channel: "instagram",
        status: "approved",
        scheduledFor: daysAgo(-2),
      },
      {
        practiceId,
        batchId: batches[0]!.id,
        createdBy: adminId,
        title: "Dentálny mesiac – február",
        body: "🦷 70% psov a mačiek nad 3 roky má dentálny problém. Počas dentálneho mesiaca získate bezplatnú dentálnu kontrolu. #DentalCare",
        channel: "facebook",
        status: "approved",
        scheduledFor: daysAgo(-5),
      },
      {
        practiceId,
        batchId: batches[0]!.id,
        createdBy: adminId,
        title: "Príbeh pacienta: od záchrany k zdraviu",
        body: "Pozrite si príbeh Maxa – psa, ktorý prišiel s ťažkou parvovirózou a dnes je plný energie. 🐕❤️",
        channel: "instagram",
        status: "proposed",
      },
      {
        practiceId,
        batchId: batches[0]!.id,
        createdBy: adminId,
        title: "Wellness program – spoľahlivá prevencia",
        body: "Pravidelné prehliadky, očkovanie a odčervenie v jednom balíčku. Váš miláčik si zaslúži najlepšiu prevenciu.",
        channel: "sms",
        status: "published",
        publishedAt: daysAgo(1),
      },
    ])
    .returning({ id: extMarketingContentItems.id });
  ids.marketingContentItemIds = contentItems.map((i) => i.id);

  // ── 5. Media Consents + Assets ───────────────────────────────────────────
  const consents = await db
    .insert(extMarketingMediaConsents)
    .values([
      {
        practiceId,
        clientId: clientIds[0],
        patientId: patientIds[0],
        scope: "photo_social",
        evidenceType: "signature",
        grantedAt: daysAgo(30),
        notes: "Súhlas pri registrácii",
      },
      {
        practiceId,
        clientId: clientIds[0],
        patientId: patientIds[0],
        scope: "marketing_messages",
        evidenceType: "sms_confirm",
        grantedAt: daysAgo(28),
      },
      {
        practiceId,
        clientId: clientIds[1],
        patientId: patientIds[1],
        scope: "photo_web",
        evidenceType: "signature",
        grantedAt: daysAgo(20),
      },
      {
        practiceId,
        clientId: clientIds[2],
        scope: "testimonial",
        evidenceType: "pdf",
        grantedAt: daysAgo(15),
      },
    ])
    .returning({ id: extMarketingMediaConsents.id });
  ids.marketingMediaConsentIds = consents.map((c) => c.id);

  const mediaAssets = await db
    .insert(extMarketingMediaAssets)
    .values([
      {
        practiceId,
        uploadedBy: adminId,
        kind: "photo",
        caption: "Biscuit pri ročnej prehliadke",
        patientName: "Biscuit",
        subjectsPresent: true,
        tags: ["pes", "wellness", "zlatý retríver"],
        altText: "Zlatý retríver Biscuit pri veterinárnej prehliadke",
        consentId: consents[0]!.id,
      },
      {
        practiceId,
        uploadedBy: adminId,
        kind: "brand_graphic",
        caption: "Logo kliniky – vianočná edícia",
        subjectsPresent: false,
        tags: ["brand", "Vianoce", "logo"],
        altText: "Vianočné logo veterinárnej kliniky",
      },
      {
        practiceId,
        uploadedBy: adminId,
        kind: "photo",
        caption: "Luna po dentálnej prevencii",
        patientName: "Luna",
        subjectsPresent: true,
        tags: ["mačka", "dentálne", "prevencia"],
        altText: "Mačka Luna po dentálnej prehliadke",
        consentId: consents[2]!.id,
      },
    ])
    .returning({ id: extMarketingMediaAssets.id });
  ids.marketingMediaAssetIds = mediaAssets.map((a) => a.id);

  // ── 6. Staff Tasks ───────────────────────────────────────────────────────
  const staffTasks = await db
    .insert(extMarketingStaffTasks)
    .values([
      {
        practiceId,
        kind: "condolence",
        title: "Kondolencia: úmrtie pacienta",
        detail: "Majiteľ hlási úmrtie 14-ročnej nemeckej ovčiacky. Pozvať na osobnú kondolenciu.",
        status: "open",
        clientId: clientIds[0],
      },
      {
        practiceId,
        kind: "postop_escalation",
        title: "Pooperačná eskalácia – rana sa hojí pomalšie",
        detail: "Majiteľ hlási mierny opuch po kastrácii. Sledovať ďalej.",
        status: "open",
        clientId: clientIds[1],
      },
      {
        practiceId,
        kind: "info",
        title: "Recall: neaktívny klient 18 mesiacov",
        detail: "Klient nebol na kontrole 18 mesiacov. Poslať pozvánku na preventívnu prehliadku.",
        status: "done",
        clientId: clientIds[2],
      },
    ])
    .returning({ id: extMarketingStaffTasks.id });
  ids.marketingStaffTaskIds = staffTasks.map((t) => t.id);

  // ── 7. Message Templates ─────────────────────────────────────────────────
  const templates = await db
    .insert(extMarketingMessageTemplates)
    .values([
      {
        practiceId,
        key: "vaccine_due",
        language: "sk",
        channel: "sms",
        body: "{{clinic_name}}: Váš miláčik {{pet_name}} má o {{days}} dní expirovať očkovanie. Objednajte sa na +421 xxx xxx xxx.",
        legalBasis: "contract",
        version: 1,
        isActive: true,
      },
      {
        practiceId,
        key: "postop_check",
        language: "sk",
        channel: "sms",
        body: "{{clinic_name}}: Ako sa má {{pet_name}} po zákroku? Odpovedajte: 1=OK, 2=Otázka, 3=Obava. Link: {{short_url}}",
        legalBasis: "contract",
        version: 1,
        isActive: true,
      },
      {
        practiceId,
        key: "review_request",
        language: "sk",
        channel: "sms",
        body: "{{clinic_name}} ďakuje za návštevu! Ak ste spokojní, pomôžete nám recenziou: {{review_url}}",
        legalBasis: "consent",
        version: 1,
        isActive: true,
      },
      {
        practiceId,
        key: "inactive_recall",
        language: "sk",
        channel: "sms",
        body: "{{clinic_name}}: Už {{months}} mesiacov sme nevideli {{pet_name}}! Preventívna prehliadka je dôležitá. Objednajte sa: +421 xxx xxx xxx",
        legalBasis: "consent",
        version: 1,
        isActive: true,
      },
      {
        practiceId,
        key: "appointment_reminder",
        language: "sk",
        channel: "sms",
        body: "{{clinic_name}} pripomína: zajtra o {{time}} máte objednanú návštevu s {{pet_name}}. Potvrďte odpoveďou ÁNO.",
        legalBasis: "contract",
        version: 1,
        isActive: true,
      },
    ])
    .returning({ id: extMarketingMessageTemplates.id });
  ids.marketingMessageTemplateIds = templates.map((t) => t.id);

  // ── 8. Message Logs ──────────────────────────────────────────────────────
  const messageLogs = await db
    .insert(extMarketingMessageLogs)
    .values([
      {
        practiceId,
        clientId: clientIds[0],
        patientId: patientIds[0],
        templateId: templates[0]!.id,
        templateKey: "vaccine_due",
        templateVersion: 1,
        legalBasis: "contract",
        channel: "sms",
        language: "sk",
        bodyRendered: "VetKlinika: Váš miláčik Biscuit má o 14 dní expirovať očkovanie. Objednajte sa na +421 xxx xxx xxx.",
        triggerKey: "vaccine_due",
        status: "delivered",
        idempotencyKey: `demo_vax_${clientIds[0]}_${Date.now()}`,
        scheduledFor: daysAgo(2),
        sentAt: daysAgo(2),
      },
      {
        practiceId,
        clientId: clientIds[1],
        patientId: patientIds[1],
        templateId: templates[1]!.id,
        templateKey: "postop_check",
        templateVersion: 1,
        legalBasis: "contract",
        channel: "sms",
        language: "sk",
        bodyRendered: "VetKlinika: Ako sa má Luna po zákroku? Odpovedajte: 1=OK, 2=Otázka, 3=Obava.",
        triggerKey: "surgery_completed",
        status: "delivered",
        idempotencyKey: `demo_postop_${clientIds[1]}_${Date.now()}`,
        scheduledFor: daysAgo(1),
        sentAt: daysAgo(1),
      },
      {
        practiceId,
        clientId: clientIds[0],
        patientId: patientIds[0],
        templateId: templates[2]!.id,
        templateKey: "review_request",
        templateVersion: 1,
        legalBasis: "consent",
        channel: "sms",
        language: "sk",
        bodyRendered: "VetKlinika ďakuje za návštevu! Ak ste spokojní, pomôžete nám recenziou: https://g.page/r/demo",
        triggerKey: "appointment_completed",
        status: "sent",
        idempotencyKey: `demo_review_${clientIds[0]}_${Date.now()}`,
        scheduledFor: daysAgo(-1),
        sentAt: daysAgo(-1),
      },
      {
        practiceId,
        clientId: clientIds[2],
        templateId: templates[3]!.id,
        templateKey: "inactive_recall",
        templateVersion: 1,
        legalBasis: "consent",
        channel: "sms",
        language: "sk",
        bodyRendered: "VetKlinika: Už 18 mesiacov sme nevideli Mango! Preventívna prehliadka je dôležitá.",
        triggerKey: "inactive_recall",
        status: "suppressed_no_consent",
        idempotencyKey: `demo_recall_${clientIds[2]}_${Date.now()}`,
        scheduledFor: daysAgo(-3),
      },
      {
        practiceId,
        clientId: clientIds[1],
        patientId: patientIds[1],
        templateId: templates[4]!.id,
        templateKey: "appointment_reminder",
        templateVersion: 1,
        legalBasis: "contract",
        channel: "sms",
        language: "sk",
        bodyRendered: "VetKlinika pripomína: zajtra o 10:00 máte objednanú návštevu s Luna. Potvrďte odpoveďou ÁNO.",
        triggerKey: "appointment_reminder",
        status: "queued",
        idempotencyKey: `demo_reminder_${clientIds[1]}_${Date.now()}`,
        scheduledFor: daysAgo(-1),
      },
    ])
    .returning({ id: extMarketingMessageLogs.id });
  ids.marketingMessageLogIds = messageLogs.map((l) => l.id);

  // ── 9. Automation Rules ──────────────────────────────────────────────────
  const automationRules = await db
    .insert(extMarketingAutomationRules)
    .values([
      {
        practiceId,
        key: "vaccine_due",
        label: "Pripomienka očkovania",
        description: "Odosiela SMS upozornenie 14 dní pred expiráciou platnosti vakcíny.",
        triggerKey: "vaccine_due",
        timing: "14 dní pred expiráciou",
        channel: "sms",
        legalBasis: "contract",
        enabled: true,
        sort: 1,
      },
      {
        practiceId,
        key: "postop_check",
        label: "Pooperačná kontrola stavu",
        description: "Odosiela SMS s odkazom na kontrolu 24 hodín po prepustení z chirurgie.",
        triggerKey: "surgery_completed",
        timing: "24 hodín po zákroku",
        channel: "sms",
        legalBasis: "contract",
        enabled: true,
        sort: 2,
      },
      {
        practiceId,
        key: "review_request",
        label: "Žiadosť o Google recenziu",
        description: "Odosiela SMS s poďakovaním a žiadosťou o recenziu 48 hodín po úspešnej návšteve.",
        triggerKey: "appointment_completed",
        timing: "48 hodín po návšteve",
        channel: "sms",
        legalBasis: "consent",
        enabled: true,
        sort: 3,
      },
      {
        practiceId,
        key: "inactive_recall",
        label: "Recall neaktívnych pacientov",
        description: "Pripomenie preventívnu prehliadku pacientom, ktorí neboli na klinike viac ako 12 mesiacov.",
        triggerKey: "inactive_recall",
        timing: "12 mesiacov bez návštevy",
        channel: "sms",
        legalBasis: "consent",
        enabled: true,
        sort: 4,
      },
    ])
    .onConflictDoNothing()
    .returning({ id: extMarketingAutomationRules.id });
  ids.marketingAutomationRuleIds = automationRules.map((r) => r.id);

  // ── 10. Operative Scripts ────────────────────────────────────────────────
  const scripts = await db
    .insert(extMarketingOperativeScripts)
    .values([
      {
        practiceId,
        category: "discharge_ask",
        title: "Štandardný discharge – chirurgia",
        body: "Dnes [meno] odchádza domov po [zákrok]. Prosíme, sledujte príjem potravy a vody. Akákoľvek nezvyčajná reakcia – opuch, vracanie, letargia – volajte okamžite. Náhrdelník nosiť 10–14 dní.",
        sort: 0,
      },
      {
        practiceId,
        category: "discharge_ask",
        title: "Discharge – dentálna prevencia",
        body: "Po dentálnom čistení môže byť [meno] trochu citlivý na tvrdú potravu 2–3 dni. Ponúknite mäkkú stravu. Zuby čistite denne kefkou – ukážem vám techniku.",
        sort: 1,
      },
      {
        practiceId,
        category: "crisis",
        title: "Komplikácia po zákroku – pokojný prístup",
        body: "Počúvam vás a beriem to vážne. Opäť sa na to pozrieme – môžete prísť ešte dnes? Ak nie, náš pohotovostný tím je k dispozícii. Závisí nám na každom pacientovi.",
        sort: 0,
      },
      {
        practiceId,
        category: "crisis",
        title: "Nespokojný klient – eskalácia",
        body: "Rozumiem vašej nespokojnosti a je mi to ľúto. Chcem to napraviť – môžem vás prepojiť s vedúcim kliniky? Ozveme sa vám do 24 hodín.",
        sort: 1,
      },
      {
        practiceId,
        category: "condolence",
        title: "Osobná kondolencia – telefonát",
        body: "Volám vám v mene celého nášho tímu. Je nám veľmi ľúto straty [meno]. Vedeli sme, aké ste mali špeciálne puto. Ak budete potrebovať čokoľvek – aj len sa porozprávať – sme tu pre vás.",
        sort: 0,
      },
      {
        practiceId,
        category: "condolence",
        title: "Kondolenčná správa – písomná",
        body: "Vážený/á [meno], v mene tímu [klinika] vyjadrujeme najhlbšiu sústrasť pri strate vášho milovaného [meno zvieraťa]. Bol/a pre vás viac než zviera – bol/a rodina. S úctou, [tím kliniky].",
        sort: 1,
      },
      {
        practiceId,
        category: "review_ask",
        title: "Žiadosť o recenziu – po úspešnom ošetrení",
        body: "Sme radi, že [meno] je v poriadku! Ak ste boli spokojní s našou starostlivosťou, ocenili by sme vašu recenziu na Google – pomôže ďalším majiteľom nájsť spoľahlivú veterinu.",
        sort: 0,
      },
    ])
    .returning({ id: extMarketingOperativeScripts.id });
  ids.marketingScriptIds = scripts.map((s) => s.id);

  // ── 11. Recall Schedule ──────────────────────────────────────────────────
  const recallSchedules = await db
    .insert(extMarketingRecallSchedules)
    .values([
      {
        practiceId,
        vaccinationRecallEnabled: true,
        vaccinationRecallLeadDays: 14,
        postVisitReviewEnabled: true,
        postVisitReviewDelayHours: 48,
        postVisitHandoutEnabled: true,
        inactiveRecallEnabled: true,
        inactiveRecallMonths: 18,
      },
    ])
    .onConflictDoNothing()
    .returning({ id: extMarketingRecallSchedules.id });
  ids.marketingRecallScheduleIds = recallSchedules.map((r) => r.id);

  // ── 12. Competitor Snapshot ──────────────────────────────────────────────
  const competitorSnapshots = await db
    .insert(extMarketingCompetitorSnapshots)
    .values([
      {
        practiceId,
        query: "veterinárna klinika Bratislava",
        region: "Bratislava",
        clinics: [
          { name: "VetKlinika Demo", rating: 4.8, reviews: 127, distance: "0 km" },
          { name: "Animal Care Bratislava", rating: 4.5, reviews: 89, distance: "1.2 km" },
          { name: "PetMed s.r.o.", rating: 4.3, reviews: 56, distance: "2.5 km" },
          { name: "VetCentrum Plus", rating: 4.1, reviews: 34, distance: "3.8 km" },
        ],
        recommendations: [
          "Zlepšite Google profil – pridajte fotografie interiéru",
          "Odpovedajte na všetky recenzie do 24 hodín",
          "Pridajte príspevky o zdraví zvierat 2× týždenne",
          "Aktivujte SMS recall pre neaktívnych klientov",
        ],
        articles: [
          { title: "Význam preventívnych prehliadok u psov", source: "vetrends.sk" },
          { title: "Trendy v veterinárnej stomatológii 2026", source: "vetjournal.eu" },
        ],
        sources: ["Google Maps", "VetRends.sk", "ZVSR"],
        model: "demo-seed",
        isSample: true,
      },
    ])
    .returning({ id: extMarketingCompetitorSnapshots.id });
  ids.marketingCompetitorSnapshotIds = competitorSnapshots.map((c) => c.id);

  return ids;
}
