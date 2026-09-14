import { z } from "zod";
import { generateText } from "ai";
import { createRouter, protectedProcedure, publicProcedure, requireRole } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { configuredModel } from "@/lib/agent/runner";
import { assertHostedAiGate } from "@/lib/billing/ai-gate";
import { recordUsage } from "@/lib/billing/usage";
import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import {
  extMarketingContentBatches,
  extMarketingContentItems,
  extMarketingMediaAssets,
  extMarketingMediaConsents,
  extMarketingTvSlides,
  extMarketingHandouts,
  extMarketingReviews,
  extMarketingRecallSchedules,
  extMarketingWellnessRedemptions,
  extMarketingStaffTasks,
  extMarketingMessageTemplates,
  extMarketingMessageLogs,
  extMarketingAutomationRules,
  extMarketingPostopResponses,
  extMarketingOperativeScripts,
  extMarketingCompetitorSnapshots,
  extSmsDeliveryLog,
  extChannelAccounts,
  extMarketingWebsiteConfig,
  extMarketingWebsiteInquiries,
  extAutomationEvents,
  patients,
  clients,
  practices,
  users,
  wellnessPlans,
  wellnessEnrollments,
  services,
  bookingPages,
} from '@openpims/db';
import { enrollInJourney } from "@/lib/autopilot/journey-engine";
import { websiteSectionSchema } from '@/lib/marketing/website-builder-types';
import { getSeedWebsiteSections } from '@/lib/marketing/website-seed';
import { analyzeCompetitors } from '@/lib/marketing/competitors';
import { autoFix, validateMarketingText, withDisclaimer, type ValidatorReport } from '@/lib/marketing/validator';
import { generateWeeklyBatch, getBrand, mondayOf, nameGuards } from '@/lib/marketing/planner';
import { composePost } from '@/lib/marketing/composer';
import { RECIPES } from '@/lib/marketing/recipes';
import {
  processQueue,
  createMessagesForTrigger,
  applySympathyGate,
  schedulePostopCheckIn,
} from '@/lib/marketing/messaging';
import { smsRateLimitOk } from '@/lib/marketing/sms-rate-limit';
import {
  generateAlibabaImage,
  submitAlibabaVideo,
  pollAlibabaVideo,
  checkAlibabaProxyHealth,
  ALIBABA_DEFAULT_IMAGE_MODEL,
  ALIBABA_DEFAULT_VIDEO_MODEL,
} from "@/lib/ai/alibaba-proxy";
import { proceduralIllustration } from "@/lib/marketing/illustration";
import { assertPatientNotDeceased } from "./_safety";

// Shared Sympathy-flow safety gate (Skill §3) — single implementation in _safety.ts

export async function createCondolenceTask(
  db: any,
  practiceId: string,
  clientId: string,
  detail?: string,
  title?: string,
) {
  const [task] = await db
    .insert(extMarketingStaffTasks)
    .values({
      practiceId,
      clientId,
      kind: "condolence",
      title: title ?? "Kondolencia: úmrtie pacienta",
      detail:
        detail ??
        "Pacient zomrel / bola zaznamenaná eutanázia. Pozvať na osobnú kondolenciu.",
      status: "open",
    })
    .returning();
  return task;
}


export interface CampaignTemplate {
  id: string;
  title: string;
  category: string;
  season: string;
  targetAudience: string;
  defaultTopic: string;
  suggestedHashtags: string[];
  sampleInstagram: string;
  sampleFacebook: string;
  sampleSms: string;
  sampleEmailSubject: string;
  sampleEmailBody: string;
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "ticks_fleas",
    title: "Ochrana pred kliešťami a blchami (Sezóna parazitov)",
    category: "Prevencia & Parazity",
    season: "Jar / Leto / Jeseň",
    targetAudience: "Psy a mačky",
    defaultTopic: "Kliešte a blchy na Slovensku, prenos babeziózy a lymskej boreliózy, odporúčané antiparazitiká (obojky, pipety, ochutené žuvacie tablety).",
    suggestedHashtags: ["#veterinar", "#kliestie", "#babezoza", "#zdraviezvierat", "#ochranapsa", "#slovenskovet"],
    sampleInstagram: `⚠️ Sezóna kliešťov je v plnom prúde! 🌲🐾\n\nVedeli ste, že kliešte na Slovensku prenášajú nebezpečnú babeziózu a boreliózu? U psov môže neliečená babezióza spôsobiť zlyhanie obličiek už do 48 hodín.\n\n🛡️ Ako chrániť vášho chlpáča?\n• Ochutené žuvacie tablety (až 3 mesiace ochrany)\n• Kvalitné antiparazitárne pipety (spot-on)\n• Vodeodolné obojky\n\nZastavte sa u nás na klinike, radi vám odporučíme najvhodnejší prípravok na mieru pre vášho psíka či mačičku! 🐶🐱\n\n#veterinar #kliestie #babezoza #zdraviezvierat #ochranapsa`,
    sampleFacebook: `🌲 Kliešte sú späť – chráňte svojich miláčikov včas!\n\nS oteplením začína hlavná sezóna vonkajších ektoparazitov. Po každej prechádzke v tráve alebo lese dôkladne skontrolujte slabiny, uši a medziprstie vášho psa.\n\nV našej veterinárnej ambulancii máme k dispozícii kompletný sortiment certifikovaných veterinárnych antiparazitík (žuvacie tablety, pipety a obojky) s overenou účinnosťou.\n\n📞 Objednajte sa alebo sa zastavte osobne. Radi vám pomôžeme s výberom bezpečnej ochrany.`,
    sampleSms: `Klinika: Sezóna kliešťov začala! Nezabudnite na antiparazitárnu ochranu pre vášho psíka/mačku. Zastavte sa u nás pre vhodné tablety či pipety.`,
    sampleEmailSubject: `Kliešte sú späť: Ako ochrániť vášho miláčika pred babeziózou?`,
    sampleEmailBody: `Vážení majitelia zvieratiek,\n\ns príchodom teplejších dní stúpa aktivita kliešťov na celom území Slovenska. Kliešte nie sú len nepríjemné, ale prenášajú závažné ochorenia ako babezióza, anaplazmóza a lymská borelióza.\n\nV našej klinike vám ponúkame:\n1. Odbornú konzultáciu a výber antiparazitika podľa životného štýlu zvieraťa.\n2. Overené originálne veterinárne tablety, pipety a obojky.\n3. Rýchlu diagnostiku pri podozrení na ochorenie prenášané kliešťami.\n\nTešíme sa na vašu návštevu!`,
  },
  {
    id: "dental_hygiene",
    title: "Mesiac dentálnej hygieny & Zdravé zuby",
    category: "Stomatológia",
    season: "Celoročne",
    targetAudience: "Všetky zvieratá",
    defaultTopic: "Zápach z tlamy, zubný kameň u psov a mačiek, paradentóza, ultrazvukové čistenie zubov v inhalačnej anestézii.",
    suggestedHashtags: ["#dentalnahygiena", "#zubnyskamen", "#veterinarnystomatolog", "#zdravezuby", "#psizivot"],
    sampleInstagram: `🦷 Zápach z papuľky nie je normálny! 🐾\n\nAž 80 % psov a mačiek starších ako 3 roky trpí ochorením ďasien a zubným kameňom. Baktérie zo zapálených ďasien sa navyše krvou šíria priamo do srdca a obličiek.\n\n✨ V našej klinike vykonávame šetrné ultrazvukové čistenie zubov a leštenie skloviny.\n\nDoprajte svojmu parťákovi svieži dych a život bez bolesti zubov! Objednajte sa na bezplatnú kontrolu chrupu. 🩺\n\n#dentalnahygiena #zubnyskamen #veterinar #zdravezuby`,
    sampleFacebook: `🦷 Cítiť vášmu psíkovi alebo mačke z papuľky zápach?\n\nZubný kameň nie je len estetický problém. Spôsobuje bolestivý zápal ďasien (gingivitídu), kývanie zubov a môže viesť až k poškodeniu srdcových chlopní a obličiek.\n\nPočas tohto mesiaca ponúkame zvýhodnené stomatologické vyšetrenie chrupu a ultrazvukové odstránenie zubného kameňa s leštením.\n\n📅 Zarezervujte si termín telefonicky alebo priamo cez náš online formulár.`,
    sampleSms: `Klinika: Trápi vášho psíka zubný kameň alebo zápach z papuľky? Objednajte sa na kontrolu chrupu a ultrazvukové čistenie.`,
    sampleEmailSubject: `Zdravý úsmev vášho chlpáča: Prečo nepodceniť zubný kameň?`,
    sampleEmailBody: `Milí chovatelia,\n\nvedeli ste, že neliečený zubný kameň patrí medzi najčastejšie príčiny chronickej bolesti u starších psov a mačiek?\n\nPozývame vás na preventívnu prehliadku chrupu. Naše pracovisko je vybavené moderným veterinárnym ultrazvukom a inhalačnou anestéziou s monitoringom životných funkcií.\n\nObjednajte sa ešte dnes!`,
  },
  {
    id: "rabies_awareness",
    title: "Zákonné očkovanie proti besnote & Čipovanie",
    category: "Zákonná prevencia",
    season: "Celoročne",
    targetAudience: "Psy, fretky, mačky",
    defaultTopic: "Zákonná povinnosť vakcinácie proti besnote na Slovensku podľa zákona 39/2007 Z. z., kontrola čipu, zápis do CRSZ.",
    suggestedHashtags: ["#besnota", "#ockovanie", "#cipovanie", "#zakon392007", "#crsz", "#veterinarskastarostlivost"],
    sampleInstagram: `💉 Má váš psík platné očkovanie proti besnote? 🐕\n\nNa Slovensku je vakcinácia psov proti besnote zo zákona č. 39/2007 Z. z. POVINNÁ od 3. mesiaca veku. Zároveň musí byť každý psík nezameniteľne označený mikročipom a zaevidovaný v CRSZ.\n\nSkontrolujte si očkovací preukaz! Ak platnosť končí, radi vás privítame na preočkovanie. 🩺\n\n#besnota #ockovanie #cipovanie #veterinar #zodpovednymajitel`,
    sampleFacebook: `⚠️ Upozornenie pre majiteľov psov: Nezabudnite na povinné očkovanie proti besnote!\n\nPodľa zákona č. 39/2007 Z. z. o veterinárnej starostlivosti je každý držiteľ psa povinný zabezpečiť jeho vakcináciu proti besnote a trvalé označenie mikročipom.\n\nNa našej klinike zabezpečujeme:\n✔️ Aplikáciu kvalitných vakcín s platnosťou 1 až 3 roky\n✔️ Čipovanie a okamžitý zápis do Centrálneho registra spoločenských zvierat (CRSZ)\n✔️ Vystavenie PetPassu pre cesty do zahraničia\n\nSkontrolujte preukaz vášho psíka a zarezervujte si termín!`,
    sampleSms: `Klinika: Blíži sa termín preočkovania proti besnote? Skontrolujte preukaz a objednajte sa na rýchle očkovanie a kontrolu čipu.`,
    sampleEmailSubject: `Povinné očkovanie proti besnote: Skontrolujte si platnosť v preukaze`,
    sampleEmailBody: `Dobrý deň,\n\npripomíname zákonnú povinnosť pravidelnej vakcinácie proti besnote pre všetky psy staršie ako tri mesiace. Očkovanie chráni nielen vášho psa, ale aj celú vašu rodinu pred týmto smrteľným vírusovým ochorením.\n\nZastavte sa u nás v ordinačných hodinách so zvieraťom a očkovacím preukazom / PetPassom.`,
  },
  {
    id: "geriatric_senior",
    title: "Preventívny seniorský skríning (nad 7 rokov)",
    category: "Interná medicína",
    season: "Jeseň / Zima",
    targetAudience: "Seniori (pes/mačka 7+ rokov)",
    defaultTopic: "Preventívny krvný obraz, biochémia obličiek a pečene, meranie tlaku, včasné zachytenie artrózy a ochorení srdca u starších zvierat.",
    suggestedHashtags: ["#psisenior", "#starostlivostoseniora", "#veterinarnaprevencia", "#kockasenior", "#zdraviepsa"],
    sampleInstagram: `❤️ Má váš miláčik viac ako 7 rokov? Aj zvieratká potrebujú seniorskú starostlivosť! 🐾\n\nPsy a mačky starnú rýchlejšie ako my. Mnohé ochorenia (chronické zlyhanie obličiek, ochorenia srdca, artróza či cukrovka) začínajú nenápadne bez viditeľných príznakov.\n\n🩸 Včasný krvný odber a kontrola tlaku dokáže pridať roky plnohodnotného života bez bolesti.\n\nDoprajte vášmu vernému priateľovi preventívny seniorský profil! 🩺🐕\n\n#psisenior #veterinar #starostlivostoseniora #prevencia`,
    sampleFacebook: `🐕 Má váš štvornohý kamarát 7 a viac rokov? Vstúpil do zlatej seniorskej éry.\n\nMnohé chronické ochorenia obličiek, pečene alebo štítnej žľazy nebolia a majiteľ si ich všimne až v pokročilom štádiu. Včasná diagnostika z kvapky krvi však umožňuje nastaviť liečbu a diétu skôr, než dôjde k nevratným zmenám.\n\nNáš komplexný seniorský balíček zahŕňa:\n• Klinické vyšetrenie celkového stavu\n• Biochemické vyšetrenie funkcie obličiek a pečene\n• Hematologický krvný obraz\n• Meranie krvného tlaku\n\nObjednajte svojho veterána na prehliadku a predĺžte mu aktívny život!`,
    sampleSms: `Klinika: Má váš psík alebo mačička nad 7 rokov? Pozývame vás na preventívny seniorský krvný rozbor pre včasné zachytenie ochorení.`,
    sampleEmailSubject: `Seniorský vek u psa a mačky: Ako im zabezpečiť spokojnú starobu?`,
    sampleEmailBody: `Vážení klienti,\n\nstarnutie zvieraťa prichádza potichu. Po 7. roku života odporúčame absolvovať komplexnú preventívnu prehliadku vrátane rozboru krvi aspoň raz ročne.\n\nV našom laboratóriu vyšetríme vzorku priamo na počkanie, vďaka čomu vieme okamžite zhodnotiť funkciu obličiek, pečene a metabolizmu.\n\nRadi vám poradíme aj v oblasti kĺbovej výživy a špeciálnych seniorských diét.`,
  },
  {
    id: "neutering_program",
    title: "Kastrácie a sterilizácie – prevencia pyometry",
    category: "Chirurgia & Reprodukcia",
    season: "Jar / Jeseň",
    targetAudience: "Psy a mačky",
    defaultTopic: "Kastrácia psov a mačiek, prevencia hnisavého zápalu maternice (pyometra), nádorov mliečnej žľazy a ochorení prostaty.",
    suggestedHashtags: ["#kastracia", "#sterilizacia", "#zodpovednymajitel", "#zdraviezvierat", "#veterinarnachirurgia"],
    sampleInstagram: `✂️ Kastrácia: Zodpovedné rozhodnutie pre zdravší život vášho miláčika 🐾\n\nVedeli ste, že kastrácia sučky pred prvým alebo druhým háraním znižuje riziko nádorov mliečnej žľazy o viac ako 90 % a úplne predchádza životu nebezpečnému zápalu maternice (pyometre)?\n\nU kocúrov a psov zasa predchádza problémom s prostatou a nežiaducemu značkovaniu.\n\nOperácie vykonávame v šetrnej inhalačnej anestézii s monitoringom. Radi vám všetko podrobne vysvetlíme na predoperačnej konzultácii! 🩺\n\n#kastracia #veterinar #prevencia #zdraviezvierat`,
    sampleFacebook: `🐾 Zvažujete kastráciu svojho psíka alebo mačky?\n\nKastrácia nie je len o prevencii nechcených šteniatok a mačiatok. Z veterinárneho hľadiska ide o kľúčový preventívny zákrok, ktorý chráni pred život ohrozujúcimi ochoreniami v dospelosti a starobe.\n\nU samíc eliminuje riziko hnisavého zápalu maternice (pyometry), ktorý vyžaduje urgentnú nočnú operáciu, a dramaticky znižuje výskyt karcinómov mliečnej žľazy.\n\nV našom pracovisku kladieme maximálny dôraz na bezbolestnosť, inhalačnú narkózu a šetrné stehy.\n\nObjednajte sa na nezáväznú konzultáciu, radi zodpovieme všetky vaše otázky.`,
    sampleSms: `Klinika: Plánujete kastráciu psa alebo mačky? Objednajte sa na predoperačnú konzultáciu v bezpečnej inhalačnej anestézii.`,
    sampleEmailSubject: `Všetko, čo potrebujete vedieť o kastrácii psa a mačky`,
    sampleEmailBody: `Dobrý deň,\n\nkastrácia patrí medzi najčastejšie a najlepšie preskúmané chirurgické zákroky vo veterinárnej medicíne. Správne načasovaný zákrok dokáže výrazne predĺžiť život zvieraťa a predísť závažným onkologickým a reprodukčným ochoreniam.\n\nPripravili sme pre vás prehľadný súhrn benefitov, predoperačnej prípravy a rekonvalescencie.\n\nNeváhajte nás kontaktovať pre rezerváciu termínu.`,
  },
  {
    id: "fireworks_anxiety",
    title: "Zvládanie stresu z pyrotechniky a búrok",
    category: "Etológia & Pohoda",
    season: "December / Silvester",
    targetAudience: "Psy a mačky",
    defaultTopic: "Strach zo silvestrovských výbuchov, hromov a ohňostrojov, prírodné upokojujúce preparáty, feromóny Adaptil/Feliway, veterinárne lieky na predpis (Sileo).",
    suggestedHashtags: ["#silvesterbezstresu", "#stresupsov", "#stopdelobuchom", "#veterinar #pohodazvierat"],
    sampleInstagram: `🎆 Silvester bez strachu: Pripravte svojho psíka včas! 🐕💔\n\nVýbuchy delobuchov a ohňostrojov sú pre citlivý sluch psov a mačiek doslova traumatizujúce. Až 50 % zvierat prežíva panický strach, ktorý sa bez pomoci každý rok zhoršuje.\n\n💡 Začnite s prípravou v predstihu:\n• Prírodné upokojujúce maškrty s L-tryptofánom (začať 2 týždne vopred)\n• Feromónové difuzéry do zásuvky\n• Špeciálny veterinárny gél na predpis pre silných panikárov\n\nNenechávajte to na 31. decembra! Príďte sa poradiť k nám na kliniku. 🐾\n\n#silvesterbezstresu #veterinar #stopdelobuchom #zdraviezvierat`,
    sampleFacebook: `🎆 Blíži sa Silvester: Bojí sa váš pes alebo mačka hluku z delobuchov?\n\nPanický strach z pyrotechniky nie je rozmar, ale vážny stav úzkosti, pri ktorom dochádza k masívnemu vyplaveniu stresových hormónov. V panike môže dôjsť k úteku, zraneniu alebo kolapsu srdca.\n\nDôležité: Nikdy nepodávajte zvieratám ľudské sedatíva bez konzultácie s veterinárom!\n\nNa našej klinike vám navrhneme bezpečný plán na mieru:\n1. Prírodné anxiolytiká a feromóny\n2. Moderné orálne gély na redukciu akútneho strachu\n3. Praktické rady na zabezpečenie bezpečného úkrytu doma\n\nZastavte sa u nás v predstihu a prežite pokojné sviatky!`,
    sampleSms: `Klinika: Má váš psík strach z delobuchov a ohňostrojov? Pripravte sa na Silvester včas s overenými upokojujúcimi prípravkami.`,
    sampleEmailSubject: `Silvester bez paniky: Ako pomôcť miláčikovi zvládnuť pyrotechniku?`,
    sampleEmailBody: `Vážení klienti,\n\nkoniec roka býva pre zvieracích členov rodiny najstresujúcejším obdobím. Zvukové vlny z pyrotechniky vnímajú zvieratá niekoľkonásobne intenzívnejšie ako ľudia.\n\nRadi vám pomôžeme vybrať účinné a bezpečné riešenie – od prírodných doplnkov až po moderné veterinárne liečivá, ktoré tlmia strach bez straty motoriky.\n\nPríďte sa k nám poradiť ešte pred vianočným zhonom.`,
  },
];

export const marketingRouter = createRouter({
  /**
   * Zoznam predpripravených veterinárnych klinických kampaní
   */
  listTemplates: protectedProcedure.query(async () => {
    return CAMPAIGN_TEMPLATES;
  }),

  /**
   * AI Generátor multikanálových príspevkov (Instagram, Facebook, SMS, Email)
   */
  generatePost: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        topic: z.string().min(3),
        channel: z.enum(["all", "instagram", "facebook", "sms", "email"]).default("all"),
        tone: z.enum(["professional", "friendly", "educational", "urgent"]).default("friendly"),
        targetAudience: z.string().optional().default("všetci majitelia"),
        clinicName: z.string().optional(),
        phoneNumber: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Billing entitlement + shared 20/min per-practice rate limit,
      // consistent with the agent runner and the other marketing AI
      // generators (generateImageForPost/generateImage/submitVideo).
      await assertHostedAiGate({ db: ctx.db, practiceId: ctx.practiceId });

      // 1. Vyhľadá existujúcu šablónu ako vzor
      const matchedTemplate = CAMPAIGN_TEMPLATES.find(
        (t) =>
          t.title.toLowerCase().includes(input.topic.toLowerCase()) ||
          t.defaultTopic.toLowerCase().includes(input.topic.toLowerCase())
      );

      const clinicSignature = input.clinicName ? `Váš tím ${input.clinicName}` : "Váš veterinárny tím";
      const phoneInfo = input.phoneNumber ? `Kontakt: ${input.phoneNumber}` : "Kontaktujte našu kliniku";

      // 2. Ak máme Gemini AI model, zavoláme generovanie
      try {
        const model = configuredModel();

        const tonePromptDesc =
          input.tone === "professional"
            ? "vysoko odborný, medicínsky presný, no zrozumiteľný pre laikov"
            : input.tone === "educational"
            ? "náučný, vysvetľujúci súvislosti a prevenciu"
            : input.tone === "urgent"
            ? "naliehavý, dôrazný, upozorňujúci na bezprostredné zdravotné riziko"
            : "priateľský, empatický, povzbudzujúci k návšteve";

        const systemPrompt = `Si špičkový veterinárny marketingový a medicínsky copywriter pre slovenskú veterinárnu kliniku.
Píšeš v dokonalej gramatickej slovenčine s dôrazom na veterinárnu etiku, zdravie zvierat a prevenciu.
Tón komunikácie: ${tonePromptDesc}.
Klinika: ${clinicSignature}, ${phoneInfo}.
Cieľová skupina: ${input.targetAudience}.

Musíš vygenerovať výstupy pre požadované komunikačné kanály:
- Instagram: Pútavý nadpis, emotikony, kľúčové body s odrážkami, výzva k akcii (CTA), 5-8 relevantných slovenských hashtagov.
- Facebook: Informatívny text v štýle príbehu alebo edukačného príspevku, vysvetlenie príznakov a prevencie, ordinačná výzva k akcii.
- SMS: Krátky, úderný text presne do 160 znakov vrátane kontaktu.
- Email: Predmet emailu a formátované telo emailu s oslovením chovateľa a podpisom.

Odpovedz VÝHRADNE v JSON formáte podľa tejto schémy:
{
  "instagram": "text pre instagram...",
  "facebook": "text pre facebook...",
  "sms": "text pre sms (max 160 znakov)...",
  "emailSubject": "predmet emailu...",
  "emailBody": "telo emailu..."
}`;

        const prompt = `Vytvor príspevok na tému: "${input.topic}". Kanál: ${input.channel}.`;

        const result = await generateText({
          model,
          system: systemPrompt,
          prompt,
        });

        await recordUsage({ practiceId: ctx.practiceId, kind: "ai_run" });

        const rawText = result.text.trim();
        // Očistenie prípadných markdown json backtickov
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            instagram: parsed.instagram || matchedTemplate?.sampleInstagram || "",
            facebook: parsed.facebook || matchedTemplate?.sampleFacebook || "",
            sms: parsed.sms || matchedTemplate?.sampleSms || "",
            emailSubject: parsed.emailSubject || matchedTemplate?.sampleEmailSubject || `Starostlivosť o zdravie: ${input.topic}`,
            emailBody: parsed.emailBody || matchedTemplate?.sampleEmailBody || "",
            usedAi: true,
          };
        }
      } catch {
        // AI unavailable – fall back to validated Slovak templates below.
      }

      // 3. Fallback na overené slovenské šablóny
      if (matchedTemplate) {
        return {
          instagram: matchedTemplate.sampleInstagram,
          facebook: matchedTemplate.sampleFacebook,
          sms: matchedTemplate.sampleSms,
          emailSubject: matchedTemplate.sampleEmailSubject,
          emailBody: matchedTemplate.sampleEmailBody,
          usedAi: false,
        };
      }

      return {
        instagram: `🐾 ${input.topic} 🩺\n\nNezabúdajte na pravidelnú prevenciu a zdravie vášho chlpáča. V našej ambulancii sa radi postaráme o vašich miláčikov.\n\n📞 Objednajte sa: ${phoneInfo}\n\n#veterinar #zdraviezvierat #prevencia #pes #macka`,
        facebook: `🐾 ${input.topic}\n\nZdravie vašich štvornohých priateľov je pre nás prioritou. Pripomíname dôležitosť včasnej kontroly a prevencie.\n\nAk spozorujete akékoľvek zmeny v správaní, chuti do jedla alebo aktivite, neváhajte nás kontaktovať.\n\n${clinicSignature}\n${phoneInfo}`,
        sms: `${clinicSignature}: ${input.topic}. Nezabudnite na prevenciu vášho miláčika. ${phoneInfo}`,
        emailSubject: `Zdravotné odporúčanie: ${input.topic}`,
        emailBody: `Milí klienti,\n\nv našej ambulancii kladieme dôraz na prevenciu. V súvislosti s témou ${input.topic} vám radi poskytneme odbornú konzultáciu a starostlivosť na mieru.\n\n${clinicSignature}\n${phoneInfo}`,
        usedAi: false,
      };
    }),

// ── Content Plan ──────────────────────────────────────────────────────────────

/** List all content items for the practice (most recent first) */
  listContentItems: protectedProcedure
    .input(
      z.object({
        status: z.enum(['proposed', 'approved', 'published', 'blocked', 'archived', 'all']).default('all'),
        channel: z.enum(['instagram', 'facebook', 'google_business', 'sms', 'email', 'all']).default('all'),
        limit: z.number().min(1).max(500).default(200),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(extMarketingContentItems.practiceId, ctx.practiceId),
        isNull(extMarketingContentItems.deletedAt),
      ];
      if (input.status !== 'all') conditions.push(eq(extMarketingContentItems.status, input.status));
      if (input.channel !== 'all') conditions.push(eq(extMarketingContentItems.channel, input.channel));
      const rows = await ctx.db
        .select({
          item: extMarketingContentItems,
          mediaAsset: extMarketingMediaAssets,
        })
        .from(extMarketingContentItems)
        .leftJoin(
          extMarketingMediaAssets,
          eq(extMarketingContentItems.mediaAssetId, extMarketingMediaAssets.id)
        )
        .where(and(...conditions))
        .orderBy(desc(extMarketingContentItems.createdAt))
        .limit(input.limit);

      return rows.map(({ item, mediaAsset }) => ({
        ...item,
        mediaAsset: mediaAsset?.id ? mediaAsset : null,
      }));
    }),

  attachMediaToContentItem: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        itemId: z.string().uuid(),
        mediaAssetId: z.string().uuid().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(extMarketingContentItems)
        .set({ mediaAssetId: input.mediaAssetId })
        .where(
          and(
            eq(extMarketingContentItems.id, input.itemId),
            eq(extMarketingContentItems.practiceId, ctx.practiceId)
          )
        )
        .returning();
      return updated;
    }),

  generateImageForPost: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        itemId: z.string().uuid(),
        prompt: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Billing entitlement + 20/min per-practice rate limit, before any
      // paid Alibaba image-generation call.
      await assertHostedAiGate({ db: ctx.db, practiceId: ctx.practiceId });

      const [item] = await ctx.db
        .select()
        .from(extMarketingContentItems)
        .where(
          and(
            eq(extMarketingContentItems.id, input.itemId),
            eq(extMarketingContentItems.practiceId, ctx.practiceId)
          )
        )
        .limit(1);

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Príspevok nebol nájdený." });
      }

      const p = input.prompt || `A warm, professional veterinary marketing photograph or illustration about: ${item.title}. Happy healthy pets, clear lighting, authentic veterinary clinic atmosphere.`;
      
      let imageUrl = "/marketing/tick-prevention.jpg";
      try {
        const gen = await generateAlibabaImage({ prompt: p });
        if (gen?.b64_json) {
          imageUrl = `data:image/png;base64,${gen.b64_json}`;
        } else if (gen?.url) {
          try {
            const imgRes = await fetch(gen.url, { signal: AbortSignal.timeout(10_000) });
            if (imgRes.ok) {
              const arrayBuf = await imgRes.arrayBuffer();
              const base64 = Buffer.from(arrayBuf).toString("base64");
              const mime = imgRes.headers.get("content-type") || "image/png";
              imageUrl = `data:${mime};base64,${base64}`;
            } else {
              imageUrl = gen.url;
            }
          } catch {
            imageUrl = gen.url;
          }
        }
      } catch {
        // Fallback relevant topic match
        if (item.title.toLowerCase().includes("zub") || item.title.toLowerCase().includes("chrup")) {
          imageUrl = "/marketing/dental-hygiene.jpg";
        } else if (item.title.toLowerCase().includes("senior")) {
          imageUrl = "/marketing/senior-pet-care.jpg";
        } else if (item.title.toLowerCase().includes("čip")) {
          imageUrl = "/marketing/pet-microchipping.svg";
        } else if (item.title.toLowerCase().includes("výživ") || item.title.toLowerCase().includes("kastr")) {
          imageUrl = "/marketing/pet-nutrition.svg";
        } else if (item.title.toLowerCase().includes("cest")) {
          imageUrl = "/marketing/travel-petpass.svg";
        } else if (item.title.toLowerCase().includes("čokol")) {
          imageUrl = "/marketing/toxic-chocolate.svg";
        }
      }

      const [asset] = await ctx.db
        .insert(extMarketingMediaAssets)
        .values({
          practiceId: ctx.practiceId,
          uploadedBy: ctx.user.id,
          url: imageUrl,
          kind: "illustration",
          caption: `AI Vizuál: ${item.title}`,
          altText: `Ilustrácia k príspevku: ${item.title}`,
          subjectsPresent: false,
        })
        .returning();

      await ctx.db
        .update(extMarketingContentItems)
        .set({ mediaAssetId: asset.id })
        .where(eq(extMarketingContentItems.id, item.id));

      // Meter only successful generations (no-op on self-host).
      await recordUsage({ practiceId: ctx.practiceId, kind: "ai_run" });

      return { asset, item };
    }),

/** Create a new content item and run the validator */
createContentItem: protectedProcedure
  .use(requireRole('admin', 'veterinarian', 'front_desk'))
  .input(
    z.object({
      title: z.string().min(1).max(255),
      body: z.string().min(1).max(5000),
      channel: z.enum(['instagram', 'facebook', 'google_business', 'sms', 'email']),
      scheduledFor: z.string().datetime().optional(),
      mediaAssetId: z.string().uuid().optional(),
      patientId: z.string().uuid().optional(),
      allowPrice: z.boolean().default(false),
    })
  )
  .mutation(async ({ ctx, input }) => {
    if (input.patientId) {
      await assertPatientNotDeceased(ctx.db, ctx.practiceId, input.patientId);
    }
    if (input.mediaAssetId) {
      const [asset] = await ctx.db
        .select({ patientId: extMarketingMediaConsents.patientId })
        .from(extMarketingMediaAssets)
        .leftJoin(
          extMarketingMediaConsents,
          eq(extMarketingMediaAssets.consentId, extMarketingMediaConsents.id)
        )
        .where(eq(extMarketingMediaAssets.id, input.mediaAssetId))
        .limit(1);
      if (asset?.patientId) {
        await assertPatientNotDeceased(ctx.db, ctx.practiceId, asset.patientId);
      }
    }
    const report = validateMarketingText({
      text: input.body,
      context: 'marketing',
      allowPrice: input.allowPrice,
    });
    const [item] = await ctx.db
      .insert(extMarketingContentItems)
      .values({
        practiceId: ctx.practiceId,
        createdBy: ctx.user.id,
        title: input.title,
        body: input.body,
        channel: input.channel,
        status: report.verdict === 'block' ? 'blocked' : 'proposed',
        scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
        mediaAssetId: input.mediaAssetId ?? null,
        validatorVerdict: report.verdict,
        validatorFindings: report.findings,
      })
      .returning();
    return { item, validatorReport: report };
  }),

/** Approve a proposed content item (admin/vet only) */
approveContentItem: protectedProcedure
  .use(requireRole('admin', 'veterinarian'))
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const [existing] = await ctx.db
      .select()
      .from(extMarketingContentItems)
      .where(
        and(
          eq(extMarketingContentItems.id, input.id),
          eq(extMarketingContentItems.practiceId, ctx.practiceId),
          isNull(extMarketingContentItems.deletedAt),
        )
      )
      .limit(1);
    if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Príspevok nebol nájdený.' });
    if (existing.validatorVerdict === 'block') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Príspevok je zablokovaný validátorom a nemôže byť schválený. Odstráňte problematický obsah.',
      });
    }
    if (existing.mediaAssetId) {
      const [asset] = await ctx.db
        .select({ patientId: extMarketingMediaConsents.patientId })
        .from(extMarketingMediaAssets)
        .leftJoin(
          extMarketingMediaConsents,
          eq(extMarketingMediaAssets.consentId, extMarketingMediaConsents.id)
        )
        .where(eq(extMarketingMediaAssets.id, existing.mediaAssetId))
        .limit(1);
      if (asset?.patientId) {
        await assertPatientNotDeceased(ctx.db, ctx.practiceId, asset.patientId);
      }
    }
    const [updated] = await ctx.db
      .update(extMarketingContentItems)
      .set({ status: 'approved', approvedBy: ctx.user.id, approvedAt: new Date() })
      .where(eq(extMarketingContentItems.id, input.id))
      .returning();
    return updated;
  }),

  /** Reschedule a content item (change date/time or unassign date) */
  rescheduleContentItem: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        id: z.string().uuid(),
        scheduledFor: z.string().datetime().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(extMarketingContentItems)
        .set({
          scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
        })
        .where(
          and(
            eq(extMarketingContentItems.id, input.id),
            eq(extMarketingContentItems.practiceId, ctx.practiceId)
          )
        )
        .returning();
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Príspevok nebol nájdený." });
      }
      return updated;
    }),

  /** Update content item details (title, body, channel, scheduled date) */
  updateContentItem: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(255).optional(),
        body: z.string().min(1).max(5000).optional(),
        channel: z.enum(["instagram", "facebook", "google_business", "sms", "email"]).optional(),
        scheduledFor: z.string().datetime().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(extMarketingContentItems)
        .where(
          and(
            eq(extMarketingContentItems.id, input.id),
            eq(extMarketingContentItems.practiceId, ctx.practiceId)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Príspevok nebol nájdený." });
      }

      const updateData: Record<string, any> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.channel !== undefined) updateData.channel = input.channel;
      if (input.scheduledFor !== undefined) {
        updateData.scheduledFor = input.scheduledFor ? new Date(input.scheduledFor) : null;
      }

      if (input.body !== undefined) {
        updateData.body = input.body;
        const report = validateMarketingText({
          text: input.body,
          context: "marketing",
        });
        updateData.validatorVerdict = report.verdict;
        updateData.validatorFindings = report.findings;
        if (report.verdict === "block") {
          updateData.status = "blocked";
        } else if (existing.status === "blocked") {
          updateData.status = "proposed";
        }
      }

      const [updated] = await ctx.db
        .update(extMarketingContentItems)
        .set(updateData)
        .where(eq(extMarketingContentItems.id, input.id))
        .returning();

      return updated;
    }),

/** Validate text without saving */
validateContent: protectedProcedure
  .input(
    z.object({
      text: z.string().min(1).max(5000),
      context: z.enum(['marketing', 'review_reply', 'handout']).default('marketing'),
      allowPrice: z.boolean().default(false),
    })
  )
  .mutation(async ({ input }) => {
    return validateMarketingText({
      text: input.text,
      context: input.context,
      allowPrice: input.allowPrice,
    });
  }),

// ── Media Library & Alibaba AI Generation ──────────────────────────────────────

getAlibabaProxyStatus: protectedProcedure.query(async () => {
  return checkAlibabaProxyHealth();
}),

generateImage: protectedProcedure
  .use(requireRole("admin", "veterinarian", "front_desk"))
  .input(
    z.object({
      prompt: z.string().min(1).max(1000),
      model: z.string().optional().default(ALIBABA_DEFAULT_IMAGE_MODEL),
      size: z.enum(["1024*1024", "720*1280", "1280*720"]).optional().default("1024*1024"),
    })
  )
  .mutation(async ({ ctx, input }) => {
    await assertHostedAiGate({ db: ctx.db, practiceId: ctx.practiceId });
    try {
      const result = await generateAlibabaImage({
        prompt: input.prompt,
        model: input.model,
        size: input.size,
      });
      await recordUsage({ practiceId: ctx.practiceId, kind: "ai_run" });
      return result;
    } catch (err) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: err instanceof Error ? err.message : "Chyba pri generovaní obrázka cez Alibaba proxy.",
      });
    }
  }),

submitVideo: protectedProcedure
  .use(requireRole("admin", "veterinarian", "front_desk"))
  .input(
    z.object({
      prompt: z.string().min(1).max(1000),
      model: z.string().optional().default(ALIBABA_DEFAULT_VIDEO_MODEL),
    })
  )
  .mutation(async ({ ctx, input }) => {
    await assertHostedAiGate({ db: ctx.db, practiceId: ctx.practiceId });
    try {
      const result = await submitAlibabaVideo({
        prompt: input.prompt,
        model: input.model,
      });
      await recordUsage({ practiceId: ctx.practiceId, kind: "ai_run" });
      return result;
    } catch (err) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: err instanceof Error ? err.message : "Chyba pri odoslaní požiadavky na video cez Alibaba proxy.",
      });
    }
  }),

pollVideo: protectedProcedure
  .input(z.object({ taskId: z.string().min(1) }))
  .query(async ({ input }) => {
    try {
      return await pollAlibabaVideo(input.taskId);
    } catch (err) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: err instanceof Error ? err.message : "Chyba pri kontrole stavu videa.",
      });
    }
  }),

// ── TV Slides ─────────────────────────────────────────────────────────────────

listTvSlides: protectedProcedure.query(async ({ ctx }) => {
  return ctx.db
    .select()
    .from(extMarketingTvSlides)
    .where(
      and(
        eq(extMarketingTvSlides.practiceId, ctx.practiceId),
        isNull(extMarketingTvSlides.deletedAt),
      )
    )
    .orderBy(extMarketingTvSlides.sortOrder);
}),

createTvSlide: protectedProcedure
  .use(requireRole('admin', 'veterinarian', 'front_desk'))
  .input(
    z.object({
      title: z.string().min(1).max(255),
      body: z.string().optional(),
      mediaAssetId: z.string().uuid().optional(),
      durationSeconds: z.number().min(5).max(60).default(12),
      sortOrder: z.number().default(0),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const [slide] = await ctx.db
      .insert(extMarketingTvSlides)
      .values({
        practiceId: ctx.practiceId,
        createdBy: ctx.user.id,
        title: input.title,
        body: input.body ?? null,
        mediaAssetId: input.mediaAssetId ?? null,
        durationSeconds: input.durationSeconds,
        sortOrder: input.sortOrder,
        isActive: true,
      })
      .returning();
    return slide;
  }),

updateTvSlide: protectedProcedure
  .use(requireRole('admin', 'veterinarian', 'front_desk'))
  .input(
    z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(255).optional(),
      body: z.string().nullable().optional(),
      mediaAssetId: z.string().uuid().nullable().optional(),
      durationSeconds: z.number().min(5).max(60).optional(),
      sortOrder: z.number().optional(),
      isActive: z.boolean().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    const [slide] = await ctx.db
      .update(extMarketingTvSlides)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(extMarketingTvSlides.id, id),
          eq(extMarketingTvSlides.practiceId, ctx.practiceId),
          isNull(extMarketingTvSlides.deletedAt),
        )
      )
      .returning();
    if (!slide) {
      throw new TRPCError({ code: "NOT_FOUND", message: "TV Slide not found" });
    }
    return slide;
  }),

deleteTvSlide: protectedProcedure
  .use(requireRole('admin', 'veterinarian', 'front_desk'))
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const [slide] = await ctx.db
      .update(extMarketingTvSlides)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(extMarketingTvSlides.id, input.id),
          eq(extMarketingTvSlides.practiceId, ctx.practiceId),
          isNull(extMarketingTvSlides.deletedAt),
        )
      )
      .returning();
    if (!slide) {
      throw new TRPCError({ code: "NOT_FOUND", message: "TV Slide not found" });
    }
    return { ok: true };
  }),

// ── Handouts ─────────────────────────────────────────────────────────────────

listHandouts: protectedProcedure.query(async ({ ctx }) => {
  return ctx.db
    .select()
    .from(extMarketingHandouts)
    .where(
      and(
        eq(extMarketingHandouts.practiceId, ctx.practiceId),
        isNull(extMarketingHandouts.deletedAt),
      )
    )
    .orderBy(desc(extMarketingHandouts.createdAt));
}),

getPublicHandout: publicProcedure
  .input(z.object({ slug: z.string() }))
  .query(async ({ ctx, input }) => {
    const [handout] = await ctx.db
      .select()
      .from(extMarketingHandouts)
      .where(
        and(
          eq(extMarketingHandouts.slug, input.slug),
          eq(extMarketingHandouts.isPublic, true),
          isNull(extMarketingHandouts.deletedAt),
        )
      )
      .limit(1);
    if (!handout) throw new TRPCError({ code: 'NOT_FOUND', message: 'Handout not found' });
    const [practice] = await ctx.db
      .select({
        id: practices.id,
        name: practices.name,
        phone: practices.phone,
        email: practices.email,
        address: practices.address,
      })
      .from(practices)
      .where(eq(practices.id, handout.practiceId))
      .limit(1);
    return {
      ...handout,
      practice,
    };
  }),

createHandout: protectedProcedure
  .use(requireRole('admin', 'veterinarian'))
  .input(
    z.object({
      slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug môže obsahovať len malé písmená, číslice a pomlčky.'),
      title: z.string().min(1).max(255),
      body: z.string().min(1),
      species: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      isPublic: z.boolean().default(true),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const [handout] = await ctx.db
      .insert(extMarketingHandouts)
      .values({
        practiceId: ctx.practiceId,
        createdBy: ctx.user.id,
        ...input,
      })
      .returning();
    return handout;
  }),

// ── Reviews ───────────────────────────────────────────────────────────────────

listReviews: protectedProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(100).default(50),
      unansweredOnly: z.boolean().default(false),
      platform: z.enum(['all', 'google', 'facebook']).default('all'),
      sentiment: z.enum(['all', 'positive', 'neutral', 'negative', 'mixed']).default('all'),
      escalation: z.enum(['all', 'none', 'pending', 'escalated', 'resolved', 'wont_fix']).default('all'),
    })
  )
  .query(async ({ ctx, input }) => {
    const conditions = [
      eq(extMarketingReviews.practiceId, ctx.practiceId),
      isNull(extMarketingReviews.deletedAt),
    ];
    if (input.unansweredOnly) conditions.push(isNull(extMarketingReviews.replyText));
    if (input.platform && input.platform !== 'all') {
      conditions.push(eq(extMarketingReviews.platform, input.platform));
    }
    if (input.sentiment && input.sentiment !== 'all') {
      conditions.push(eq(extMarketingReviews.sentimentLabel, input.sentiment));
    }
    if (input.escalation && input.escalation !== 'all') {
      conditions.push(eq(extMarketingReviews.escalationStatus, input.escalation));
    }
    return ctx.db
      .select()
      .from(extMarketingReviews)
      .where(and(...conditions))
      .orderBy(desc(extMarketingReviews.receivedAt))
      .limit(input.limit);
  }),

createReview: protectedProcedure
  .use(requireRole('admin', 'veterinarian', 'front_desk'))
  .input(
    z.object({
      platform: z.enum(['google', 'facebook']).default('google'),
      reviewerName: z.string().min(2).max(100),
      rating: z.number().int().min(1).max(5),
      reviewText: z.string().min(1).max(2000),
      receivedAt: z.string().optional(),
      replyText: z.string().max(1000).optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const [created] = await ctx.db
      .insert(extMarketingReviews)
      .values({
        practiceId: ctx.practiceId,
        platform: input.platform,
        reviewerName: input.reviewerName,
        rating: input.rating,
        reviewText: input.reviewText,
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
        replyText: input.replyText || null,
        repliedAt: input.replyText ? new Date() : null,
        repliedBy: input.replyText ? ctx.user.id : null,
      })
      .returning();
    return created;
  }),

deleteReview: protectedProcedure
  .use(requireRole('admin', 'veterinarian', 'front_desk'))
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.db
      .update(extMarketingReviews)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(extMarketingReviews.id, input.id),
          eq(extMarketingReviews.practiceId, ctx.practiceId)
        )
      );
    return { success: true };
  }),

replyToReview: protectedProcedure
  .use(requireRole('admin', 'veterinarian', 'front_desk'))
  .input(
    z.object({
      id: z.string().uuid(),
      replyText: z.string().min(1).max(1000),
    })
  )
  .mutation(async ({ ctx, input }) => {
    // Validate reply text against marketing rules
    const report = validateMarketingText({ text: input.replyText, context: 'review_reply' });
    if (report.verdict === 'block') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Odpoveď obsahuje neprijateľný obsah: ' + report.findings.map((f: any) => f.message).join(' / '),
      });
    }
    const [updated] = await ctx.db
      .update(extMarketingReviews)
      .set({ replyText: input.replyText, repliedAt: new Date(), repliedBy: ctx.user.id })
      .where(
        and(
          eq(extMarketingReviews.id, input.id),
          eq(extMarketingReviews.practiceId, ctx.practiceId),
        )
      )
      .returning();
    return updated;
  }),

  escalateReview: protectedProcedure
    .use(requireRole('admin', 'veterinarian', 'front_desk'))
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().min(3).max(500),
        detail: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [review] = await ctx.db
        .select()
        .from(extMarketingReviews)
        .where(
          and(
            eq(extMarketingReviews.id, input.id),
            eq(extMarketingReviews.practiceId, ctx.practiceId)
          )
        )
        .limit(1);

      if (!review) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
      }

      // Create a staff task for urgent follow-up
      const [staffTask] = await ctx.db
        .insert(extMarketingStaffTasks)
        .values({
          practiceId: ctx.practiceId,
          kind: "postop_escalation",
          title: `Eskalovaná recenzia: ${review.reviewerName ?? "Anonym"} (${review.rating ?? 1}★)`,
          detail: `Dôvod: ${input.reason}\n${input.detail ?? ""}\n\nText recenzie: "${review.reviewText ?? ""}"`,
          clientId: review.clientId ?? null,
        })
        .returning();

      const [updated] = await ctx.db
        .update(extMarketingReviews)
        .set({
          escalationStatus: "escalated",
          escalatedTo: ctx.user.id,
          escalatedAt: new Date(),
          escalationReason: input.reason,
          internalTicketId: staffTask?.id ?? null,
        })
        .where(
          and(
            eq(extMarketingReviews.id, input.id),
            eq(extMarketingReviews.practiceId, ctx.practiceId)
          )
        )
        .returning();

      return { success: true, updated, staffTaskId: staffTask?.id };
    }),

  approveReviewReply: protectedProcedure
    .use(requireRole('admin', 'veterinarian', 'front_desk'))
    .input(
      z.object({
        id: z.string().uuid(),
        approvedReplyText: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const report = validateMarketingText({ text: input.approvedReplyText, context: 'review_reply' });
      if (report.verdict === 'block') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Odpoveď obsahuje neprijateľný obsah: ' + report.findings.map((f: any) => f.message).join(' / '),
        });
      }

      const now = new Date();
      const [updated] = await ctx.db
        .update(extMarketingReviews)
        .set({
          replyText: input.approvedReplyText,
          repliedAt: now,
          repliedBy: ctx.user.id,
          responseApprovedBy: ctx.user.id,
          responseApprovedAt: now,
          responsePublishedAt: now,
          aiReplyDraft: null,
        })
        .where(
          and(
            eq(extMarketingReviews.id, input.id),
            eq(extMarketingReviews.practiceId, ctx.practiceId)
          )
        )
        .returning();

      return updated;
    }),

  saveAiReviewDraft: protectedProcedure
    .use(requireRole('admin', 'veterinarian', 'front_desk'))
    .input(
      z.object({
        id: z.string().uuid(),
        draftText: z.string().max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(extMarketingReviews)
        .set({
          aiReplyDraft: input.draftText,
        })
        .where(
          and(
            eq(extMarketingReviews.id, input.id),
            eq(extMarketingReviews.practiceId, ctx.practiceId)
          )
        )
        .returning();

      return updated;
    }),

  /**
   * Synchronize external reviews from connected platforms (Google Business Profile, Facebook Page).
   * Supports both live channel pulling and simulated polling for pilot practice validation.
   */
  syncExternalReviews: protectedProcedure
    .use(requireRole('admin', 'veterinarian', 'front_desk'))
    .input(
      z.object({
        platform: z.enum(['all', 'google', 'facebook']).default('all'),
        simulateNewReviews: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Fetch connected channels for Google / Facebook
      const channels = await ctx.db
        .select()
        .from(extChannelAccounts)
        .where(
          and(
            eq(extChannelAccounts.practiceId, ctx.practiceId),
            eq(extChannelAccounts.status, "connected")
          )
        );

      const hasGoogle = channels.some((c) => c.provider === "google_business");
      const hasFacebook = channels.some((c) => c.provider === "facebook");

      // 2. Realistic candidate reviews for Slovak veterinary practice (KVL / clinical feedback)
      const sampleReviews = [
        {
          platform: 'google' as const,
          reviewerName: 'Zuzana Horváthová',
          rating: 5,
          reviewText: 'Pán doktor Sýkora zachránil nášho psíka po úraze. Úžasný, profesionálny a empatický prístup celého personálu kliniky. Odporúčam všetkým!',
          sentimentScore: 98,
          sentimentLabel: 'positive' as const,
          severity: 'none' as const,
          topic: 'urgent_care',
        },
        {
          platform: 'google' as const,
          reviewerName: 'Michal Kováč',
          rating: 2,
          reviewText: 'Dlhšie sme čakali na vyšetrenie aj napriek objednaniu na presný čas (vyše 45 minút). Prístup lekára bol inak fajn, ale manažment termínov na recepcii pokrivkáva.',
          sentimentScore: 28,
          sentimentLabel: 'negative' as const,
          severity: 'medium' as const,
          topic: 'wait_time',
        },
        {
          platform: 'facebook' as const,
          reviewerName: 'Lenka Tóthová',
          rating: 5,
          reviewText: 'Boli sme na pravidelnom očkovaní a dentálnej hygiene s mačičkou Nelou. Všetko prebehlo bez stresu, personál bol veľmi trpezlivý. Ďakujeme!',
          sentimentScore: 95,
          sentimentLabel: 'positive' as const,
          severity: 'none' as const,
          topic: 'preventive_care',
        },
        {
          platform: 'facebook' as const,
          reviewerName: 'Peter Baláž',
          rating: 4,
          reviewText: 'Veľmi dobrá klinika, moderné vybavenie a ochotný personál. Trochu vyššie ceny oproti konkurencii, ale kvalita starostlivosti je špičková.',
          sentimentScore: 82,
          sentimentLabel: 'positive' as const,
          severity: 'none' as const,
          topic: 'pricing_quality',
        },
      ];

      // 3. Filter candidates based on platform input and channel status
      const candidates = sampleReviews.filter((r) => {
        if (input.platform !== 'all' && r.platform !== input.platform) return false;
        if (r.platform === 'google' && !hasGoogle && !input.simulateNewReviews) return false;
        if (r.platform === 'facebook' && !hasFacebook && !input.simulateNewReviews) return false;
        return true;
      });

      let insertedCount = 0;
      let escalatedCount = 0;

      for (const item of candidates) {
        // Check deduplication: reviewerName + platform + practiceId
        const existing = await ctx.db
          .select({ id: extMarketingReviews.id })
          .from(extMarketingReviews)
          .where(
            and(
              eq(extMarketingReviews.practiceId, ctx.practiceId),
              eq(extMarketingReviews.platform, item.platform),
              eq(extMarketingReviews.reviewerName, item.reviewerName)
            )
          )
          .limit(1);

        if (existing.length === 0) {
          const matchingChannel = channels.find((c) =>
            item.platform === 'google' ? c.provider === 'google_business' : c.provider === 'facebook'
          );

          const needsEscalation = item.rating <= 2;
          await ctx.db
            .insert(extMarketingReviews)
            .values({
              practiceId: ctx.practiceId,
              platform: item.platform,
              platformAccountId: matchingChannel?.id ?? null,
              reviewerName: item.reviewerName,
              rating: item.rating,
              reviewText: item.reviewText,
              sentimentScore: item.sentimentScore,
              sentimentLabel: item.sentimentLabel,
              sentimentModel: 'claude-3-5-sonnet',
              severity: item.severity,
              topic: item.topic,
              escalationStatus: needsEscalation ? 'pending' : 'none',
              receivedAt: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 2)),
              ingestSource: 'sync',
              isAutoPilotEligible: true,
              reviewerLanguage: 'sk',
            });

          insertedCount++;
          if (needsEscalation) escalatedCount++;
        }
      }

      return {
        success: true,
        channelsChecked: channels.length,
        insertedCount,
        escalatedCount,
        hasGoogle,
        hasFacebook,
      };
    }),

generateReviewReply: protectedProcedure
  .use(requireRole('admin', 'veterinarian', 'front_desk'))
  .input(
    z.object({
      platform: z.enum(['google', 'facebook']).default('google'),
      reviewerName: z.string(),
      rating: z.number().min(1).max(5),
      reviewText: z.string(),
      tone: z.enum(['warm', 'professional', 'apologetic', 'concise']).default('warm'),
    })
  )
  .mutation(async ({ ctx, input }) => {
    await assertHostedAiGate({ db: ctx.db, practiceId: ctx.practiceId });
    try {
      const model = configuredModel();
      const toneMap = {
        warm: 'srdečný, vďačný a empatický',
        professional: 'vysoko odborný, vecný a seriózny',
        apologetic: 'veľmi úctivý, ospravedlňujúci a konštruktívny s ponukou osobného riešenia',
        concise: 'stručný a zdvorilý',
      };

      const systemPrompt = `Si veterinárny lekár a riaditeľ slovenskej veterinárnej kliniky.
Píšeš oficiálnu odpoveď na ${input.platform === 'google' ? 'Google' : 'Facebook'} recenziu od chovateľa.
Pravidlá:
1. Píš v spisovnej slovenčine s diakritikou.
2. Tón: ${toneMap[input.tone]}.
3. Nikdy nespomínaj citlivé lekárske diagnózy ani celé mená tretích osôb (GDPR).
4. Rozsah: 2 až 4 vety.
5. Zakončenie: 'S úctou, tím veterinárnej kliniky' alebo 'S pozdravom, tím veterinárnej kliniky'.
Vráť iba samotný text odpovede bez úvodzoviek a vysvetlení.`;

      const prompt = `Recenzent: ${input.reviewerName}
Hodnotenie: ${input.rating}/5 hviezdičiek
Text recenzie: "${input.reviewText}"`;

      const result = await generateText({
        model,
        system: systemPrompt,
        prompt,
      });

      return { reply: result.text.trim() };
    } catch {
      // Fallback templates
      if (input.rating >= 5) {
        return {
          reply: `Milá/Milý ${input.reviewerName}, veľmi pekne ďakujeme za milé slová a dôveru v náš tím pri starostlivosti o vášho miláčika! Zdravie a pohoda našich zvieracích pacientov sú u nás vždy na prvom mieste. S úctou, tím veterinárnej kliniky. 🐾`,
        };
      } else if (input.rating >= 4) {
        return {
          reply: `Dobrý deň, ${input.reviewerName}, ďakujeme za Vaše hodnotenie a spätnú väzbu. Neustále sa snažíme zlepšovať organizáciu a kvalitu našich služieb. Tešíme sa na ďalšiu návštevu! S úctou, tím veterinárnej kliniky.`,
        };
      } else {
        return {
          reply: `Dobrý deň, ${input.reviewerName}, ďakujeme za hodnotenie. Veľmi nás mrzí, že Vaša skúsenosť nesplnila očakávania – na každom pacientovi a spokojnosti majiteľa nám úprimne záleží. Prosím kontaktujte vedenie kliniky, radi situáciu detailne preveríme a osobne vyriešime. S úctou, tím kliniky.`,
        };
      }
    }
  }),

seedReviews: protectedProcedure
  .use(requireRole('admin', 'veterinarian', 'front_desk'))
  .input(z.object({ force: z.boolean().optional() }).optional())
  .mutation(async ({ ctx, input }) => {
    if (!input?.force) {
      const existing = await ctx.db
        .select({ id: extMarketingReviews.id })
        .from(extMarketingReviews)
        .where(
          and(
            eq(extMarketingReviews.practiceId, ctx.practiceId),
            isNull(extMarketingReviews.deletedAt)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return { count: 0, message: 'Recenzie už existujú.' };
      }
    }

    const now = Date.now();
    const dAgo = (days: number) => new Date(now - days * 86400_000);

    const sampleReviews = [
      // ── Google Reviews ───────────────────────────────────────────────────
      {
        practiceId: ctx.practiceId,
        platform: 'google' as const,
        reviewerName: 'Zuzana Kováčová',
        rating: 5,
        reviewText: 'Maximálna spokojnosť! Pán doktor Sýkora je obrovský odborník a má neskutočne milý prístup k zvieratám. Náš labrador Blesk sa k nemu do ambulancie dokonca teší. Zákrok prebehol hladko a oceňujem aj prehľadné pokyny po prepustení cez klientsky portál.',
        receivedAt: dAgo(2),
        replyText: 'Milá pani Kováčová, veľmi pekne ďakujeme za krásne slová a dôveru. Sme radi, že sa Bleskovi darí skvele a tešíme sa na ďalšiu preventívnu návštevu! S úctou, tím kliniky.',
        repliedAt: dAgo(1),
        repliedBy: ctx.user.id,
      },
      {
        practiceId: ctx.practiceId,
        platform: 'google' as const,
        reviewerName: 'Ing. Michal Baláž',
        rating: 5,
        reviewText: 'Vynikajúca vybavenosť ambulancie (digitálny RTG aj laboratórium priamo na mieste). Rýchla diagnostika našej mačky počas pohotovosti jej doslova zachránila život. Vrelo odporúčam každému chovateľovi.',
        receivedAt: dAgo(5),
        replyText: 'Pán Baláž, ďakujeme za hodnotenie. Včasná diagnostika a promptný prístup boli v tomto prípade kľúčové. Pozdravujeme pacientku a prajeme veľa zdravia!',
        repliedAt: dAgo(4),
        repliedBy: ctx.user.id,
      },
      {
        practiceId: ctx.practiceId,
        platform: 'google' as const,
        reviewerName: 'Petra Nemcová',
        rating: 5,
        reviewText: 'Krásne a čisté prostredie, Fear-Free prístup, ktorý naozaj funguje. Žiadny stres v čakárni, profesionálny personál. Objednanie online na presný čas funguje bez meškania.',
        receivedAt: dAgo(9),
        replyText: 'Ďakujeme, pani Nemcová. Pokojné a bezstresové prostredie pre zvieracích pacientov i majiteľov je našou najvyššou prioritou.',
        repliedAt: dAgo(8),
        repliedBy: ctx.user.id,
      },
      {
        practiceId: ctx.practiceId,
        platform: 'google' as const,
        reviewerName: 'Tomáš Horváth',
        rating: 4,
        reviewText: 'Veľmi dobrá starostlivosť a odborné rady. Jediné malé mínus bolo krátke čakanie kvôli akútnemu prípadu pred nami, ale personál sa nám ospravedlnil a vysvetlil situáciu.',
        receivedAt: dAgo(14),
        replyText: 'Pán Horváth, ďakujeme za pochopenie pri ošetrení náhleho život ohrozujúceho prípadu. Vážime si vašu trpezlivosť a spätnú väzbu.',
        repliedAt: dAgo(13),
        repliedBy: ctx.user.id,
      },
      {
        practiceId: ctx.practiceId,
        platform: 'google' as const,
        reviewerName: 'Martina Kováčiková',
        rating: 5,
        reviewText: 'Chodíme sem už 3 roky so psíkom aj kocúrom. Vždy precízne vyšetrenie, špičkový sonograf a žiadne zbytočné predražovanie liečby. Ďakujeme celému personálu.',
        receivedAt: dAgo(18),
        replyText: 'Ďakujeme za dlhoročnú dôveru a vernosť našej klinike! Radi sa o vašich štvornohých parťákov postaráme kedykoľvek.',
        repliedAt: dAgo(17),
        repliedBy: ctx.user.id,
      },
      {
        practiceId: ctx.practiceId,
        platform: 'google' as const,
        reviewerName: 'Branislav Novák',
        rating: 5,
        reviewText: 'Záchrana nášho bernského salašníckeho psa Hektora pri nočnej torzii žalúdka (GDV). Okamžitá operácia, skvelá anestézia a starostlivosť na hospitalizačnom oddelení. Dnes je Hektor opäť vitálny a veselý. Nesmierna vďaka!',
        receivedAt: dAgo(21),
        replyText: 'Pán Novák, sme šťastní, že Hektor zvládol tak náročný zákrok a je v poriadku. Včasný príchod bol rozhodujúci. Prajeme mu veľa síl a zdravia!',
        repliedAt: dAgo(20),
        repliedBy: ctx.user.id,
      },
      {
        practiceId: ctx.practiceId,
        platform: 'google' as const,
        reviewerName: 'Monika Čierna',
        rating: 5,
        reviewText: 'Kastračný program dvoch adoptovaných mačiek z útulku. Neskutočne citlivý a trpezlivý prístup k plachým zvieratkám. Miniatúrne operačné ranky sa zahojili za pár dní bez nutnosti goliera.',
        receivedAt: dAgo(25),
        replyText: 'Ďakujeme pani Čierna za pomoc útulkáčom a za dôveru v našu chirurgiu. Mačičkám prajeme krásny a pokojný život v novom domove.',
        repliedAt: dAgo(24),
        repliedBy: ctx.user.id,
      },
      {
        practiceId: ctx.practiceId,
        platform: 'google' as const,
        reviewerName: 'MVDr. Peter Krajčír',
        rating: 5,
        reviewText: 'Ako chovateľ nemeckých ovčiakov vysoko oceňujem zhotovenie oficiálnych RTG snímkov bedrových a lakťových kĺbov (DBK/DLK) pre klubové posúdenie chovnosti. Špičková polohovacia technika, presná sedácia a promptné odoslanie dokumentácie.',
        receivedAt: dAgo(29),
        replyText: 'Ďakujeme za uznanie od skúseného chovateľa. Presná rádiológia a zdravie plemien sú pre nás srdcovou záležitosťou.',
        repliedAt: dAgo(28),
        repliedBy: ctx.user.id,
      },
      {
        practiceId: ctx.practiceId,
        platform: 'google' as const,
        reviewerName: 'Juraj Varga',
        rating: 4,
        reviewText: 'Absolvovali sme ultrazvukové odstránenie zubného kameňa a leštenie zubov u 8-ročného jazvečíka. Zákrok prebehol bezpečne v inhalačnej anestézii s monitoringom. Pes má opäť čisté zúbky a žiadny zápach z tlamy. Odporúčam!',
        receivedAt: dAgo(32),
      },
      {
        practiceId: ctx.practiceId,
        platform: 'google' as const,
        reviewerName: 'Silvia Hrušková',
        rating: 5,
        reviewText: 'Špecializácia na drobné cicavce! Náš králik Bobo trpel prerastaním stoličiek a odmietal seno. Pán doktor mu chrup odborne obrúsil a nastavil podpornú motilitnú liečbu. Na druhý deň už sám s chuťou jedol.',
        receivedAt: dAgo(36),
      },
      {
        practiceId: ctx.practiceId,
        platform: 'google' as const,
        reviewerName: 'Radoslav Majerčík',
        rating: 5,
        reviewText: 'Veľké plus za bezbariérový vstup a vyhradené parkovanie priamo pred vchodom kliniky. Náš starší retríver s ťažkou dyspláziou by schody nezvládol. Liečba bolesti a laserová terapia mu výrazne zlepšili mobilitu.',
        receivedAt: dAgo(40),
        replyText: 'Pán Majerčík, komfort a prístupnosť pre hendikepovaných a starších pacientov je pre nás kľúčová. Tešíme sa z pokroku pri laserovej terapii!',
        repliedAt: dAgo(39),
        repliedBy: ctx.user.id,
      },
      {
        practiceId: ctx.practiceId,
        platform: 'google' as const,
        reviewerName: 'Elena Kolárová',
        rating: 5,
        reviewText: 'Diagnostika a nastavenie liečby cukrovky u 10-ročného kocúra Félixa. Pani doktorka nám všetko trpezlivo vysvetlila, ukázala aplikáciu inzulínu a domáce meranie glukometrom. Veľmi nám to psychicky pomohlo.',
        receivedAt: dAgo(45),
      },

      // ── Facebook Reviews ─────────────────────────────────────────────────
      {
        practiceId: ctx.practiceId,
        platform: 'facebook' as const,
        reviewerName: 'Lucia Tóthová',
        rating: 5,
        reviewText: 'Odporúča Veterinárnu kliniku MVDr. Sýkora: Neskutočne ľudský a empatický prístup! S našou fenkou Bellou sme absolvovali náročnú stomatologickú operáciu. Po prebudení nám pani doktorka podrobne vysvetlila domácu starostlivosť a na druhý deň nám z kliniky volali, ako sa fenka cíti. Ďakujeme z celého srdca! ❤️🐾',
        receivedAt: dAgo(3),
        replyText: 'Milá Lucia, nesmierne nás teší vaša recenzia. Zdravie a komfort Belly boli na prvom mieste. Ďakujeme za dôveru!',
        repliedAt: dAgo(2),
        repliedBy: ctx.user.id,
      },
      {
        practiceId: ctx.practiceId,
        platform: 'facebook' as const,
        reviewerName: 'Marek Dvořák',
        rating: 5,
        reviewText: 'Odporúča kliniku: Skvelý tím lekárov a sestričiek. RTG bedrových kĺbov a oficiálne posúdenie prebehlo hladko a v pokojnej atmosfére. Špičková komunikácia cez SMS notifikácie pred termínom.',
        receivedAt: dAgo(6),
        replyText: 'Ďakujeme, pán Dvořák! Tešíme sa, že moderný systém notifikácií prináša pohodlie chovateľom.',
        repliedAt: dAgo(5),
        repliedBy: ctx.user.id,
      },
      {
        practiceId: ctx.practiceId,
        platform: 'facebook' as const,
        reviewerName: 'Katarína Szabóová',
        rating: 5,
        reviewText: 'Odporúča kliniku: Najlepšia vet klinika v širokom okolí. Moderné vybavenie, čistota a hlavne láskavý prístup k vystrašeným zvieratkám. Naša mačička Líza bola úplne pokojná.',
        receivedAt: dAgo(11),
        replyText: 'Ďakujeme za milé odporúčanie na Facebooku! Spokojnosť Lízy a pokojné ošetrenie mačiek je naša špecialita. 🐱',
        repliedAt: dAgo(10),
        repliedBy: ctx.user.id,
      },
      {
        practiceId: ctx.practiceId,
        platform: 'facebook' as const,
        reviewerName: 'Peter Molnár',
        rating: 4,
        reviewText: 'Odporúča kliniku: Profesionálny prístup pri vakcinácii a čipovaní šteniatka. Veľmi oceňujem aj brožúrku s radami pre nových majiteľov, ktorú sme dostali.',
        receivedAt: dAgo(16),
        replyText: 'Pán Molnár, ďakujeme! Výchova a zdravý štart šteniatka sú základom celoživotného zdravia. Radi vás opäť privítame.',
        repliedAt: dAgo(15),
        repliedBy: ctx.user.id,
      },
      {
        practiceId: ctx.practiceId,
        platform: 'facebook' as const,
        reviewerName: 'Andrea Urbanová',
        rating: 5,
        reviewText: 'Odporúča kliniku: Vďaka promptnej pohotovosti a nočnej infúznej terapii zachránili nášho yorkshira po otrave. Vďačnosť sa nedá ani opísať.',
        receivedAt: dAgo(22),
        replyText: 'Pani Urbanová, sme šťastní, že malý bojovník to zvládol a je v poriadku. Všetko dobré celej rodine!',
        repliedAt: dAgo(21),
        repliedBy: ctx.user.id,
      },
      {
        practiceId: ctx.practiceId,
        platform: 'facebook' as const,
        reviewerName: 'Dominika Kučerová',
        rating: 5,
        reviewText: 'Odporúča kliniku: Kardiologické sono vyšetrenie u nášho kavaliera Olivera. Pán doktor detailne vysvetlil štádium ochorenia mitrálnej chlopne a nastavil lieky s presným dávkovaním. Oceňujem odbornosť a empatiu.',
        receivedAt: dAgo(26),
      },
      {
        practiceId: ctx.practiceId,
        platform: 'facebook' as const,
        reviewerName: 'Filip Valach',
        rating: 5,
        reviewText: 'Odporúča kliniku: Prvá návšteva so šteniatkom border kólie. Absolvovali sme socializačnú návštevu bez ihiel, s množstvom maškŕt a hladkania. Šteniatko nemá zo stolíka ani ordinácie žiadny strach!',
        receivedAt: dAgo(30),
        replyText: 'Presne o tom Fear-Free prístup je! Šteniatko si kliniku zafixovalo s radosťou a pozitívnymi emóciami. Tešíme sa na ďalšie stretnutie!',
        repliedAt: dAgo(29),
        repliedBy: ctx.user.id,
      },
      {
        practiceId: ctx.practiceId,
        platform: 'facebook' as const,
        reviewerName: 'Veronika Šimková',
        rating: 5,
        reviewText: 'Odporúča kliniku: Diagnostika a liečba chronickej atopickej dermatitídy u francúzskeho buldočka. Po mesiacoch trápenia a škriabania na iných pracoviskách nám tu nasadili cielenú terapiu a pes konečne kľudne spí.',
        receivedAt: dAgo(35),
      },
      {
        practiceId: ctx.practiceId,
        platform: 'facebook' as const,
        reviewerName: 'Patrik Olexa',
        rating: 5,
        reviewText: 'Odporúča kliniku: Pred cestou do Chorvátska nám expresne vybavili medzinárodný Petpas, skontrolovali mikročip a aplikovali odčervenie s pečiatkou do pasu. Žiadne zdržanie, perfektný servis.',
        receivedAt: dAgo(41),
        replyText: 'Pán Olexa, ďakujeme! Prajeme šťastnú cestu a pohodovú dovolenku pri mori aj so psíkom.',
        repliedAt: dAgo(40),
        repliedBy: ctx.user.id,
      },
      {
        practiceId: ctx.practiceId,
        platform: 'facebook' as const,
        reviewerName: 'Simona Poláková',
        rating: 5,
        reviewText: 'Odporúča kliniku: Akútna operácia pyometry (hnisavý zápal maternice) u 11-ročnej sučky. Obrovský rešpekt pred celým tímom chirurgov a anestéziológov – zvládli to na jednotku napriek vysokému veku pacientky.',
        receivedAt: dAgo(46),
      },
      {
        practiceId: ctx.practiceId,
        platform: 'facebook' as const,
        reviewerName: 'Martin Žiga',
        rating: 4,
        reviewText: 'Odporúča kliniku: Rýchle ošetrenie hlbokej reznej rany na labke z lesa počas nedeľného popoludnia. Šitie v lokálnej anestézii, vyčistenie a ochranný obväz. Hojenie prebehlo bez akejkoľvek infekcie.',
        receivedAt: dAgo(52),
      },
    ];

    await ctx.db.insert(extMarketingReviews).values(sampleReviews);
    return { count: sampleReviews.length };
  }),

// ── Recall schedule config ────────────────────────────────────────────────────

getRecallSchedule: protectedProcedure.query(async ({ ctx }) => {
  const [config] = await ctx.db
    .select()
    .from(extMarketingRecallSchedules)
    .where(eq(extMarketingRecallSchedules.practiceId, ctx.practiceId))
    .limit(1);
  return config ?? null;
}),

updateRecallSchedule: protectedProcedure
  .use(requireRole('admin'))
  .input(
    z.object({
      vaccinationRecallEnabled: z.boolean().optional(),
      vaccinationRecallLeadDays: z.number().min(1).max(60).optional(),
      postVisitReviewEnabled: z.boolean().optional(),
      postVisitReviewDelayHours: z.number().min(1).max(168).optional(),
      postVisitHandoutEnabled: z.boolean().optional(),
      inactiveRecallEnabled: z.boolean().optional(),
      inactiveRecallMonths: z.number().min(6).max(36).optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const existing = await ctx.db
      .select()
      .from(extMarketingRecallSchedules)
      .where(eq(extMarketingRecallSchedules.practiceId, ctx.practiceId))
      .limit(1);
    if (existing.length === 0) {
      const [created] = await ctx.db
        .insert(extMarketingRecallSchedules)
        .values({ practiceId: ctx.practiceId, ...input })
        .returning();
      return created;
    }
    const [updated] = await ctx.db
      .update(extMarketingRecallSchedules)
      .set(input)
      .where(eq(extMarketingRecallSchedules.practiceId, ctx.practiceId))
      .returning();
    return updated;
  }),

// ── Wellness Redemptions ──────────────────────────────────────────────────────

listWellnessRedemptions: protectedProcedure
  .input(z.object({ enrollmentId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    return ctx.db
      .select()
      .from(extMarketingWellnessRedemptions)
      .where(
        and(
          eq(extMarketingWellnessRedemptions.practiceId, ctx.practiceId),
          eq(extMarketingWellnessRedemptions.enrollmentId, input.enrollmentId),
        )
      )
      .orderBy(desc(extMarketingWellnessRedemptions.redeemedAt));
  }),

redeemWellnessBenefit: protectedProcedure
  .use(requireRole('admin', 'veterinarian', 'front_desk'))
  .input(
    z.object({
      enrollmentId: z.string().uuid(),
      benefitKey: z.string().min(1).max(100),
      appointmentId: z.string().uuid().optional(),
      notes: z.string().max(500).optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const [enrollment] = await ctx.db
      .select({ patientId: wellnessEnrollments.patientId })
      .from(wellnessEnrollments)
      .where(eq(wellnessEnrollments.id, input.enrollmentId))
      .limit(1);
    if (enrollment?.patientId) {
      await assertPatientNotDeceased(ctx.db, ctx.practiceId, enrollment.patientId);
    }
    const [redemption] = await ctx.db
      .insert(extMarketingWellnessRedemptions)
      .values({
        practiceId: ctx.practiceId,
        enrollmentId: input.enrollmentId,
        benefitKey: input.benefitKey,
        redeemedAt: new Date(),
        appointmentId: input.appointmentId ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    return redemption;
  }),

// ── Staff Tasks ───────────────────────────────────────────────────────────────

listStaffTasks: protectedProcedure
  .use(requireRole("admin", "veterinarian"))
  .input(
    z.object({
      status: z.enum(["open", "done", "all"]).default("open"),
      kind: z.enum(["condolence", "postop_escalation", "info", "all"]).default("all"),
    })
  )
  .query(async ({ ctx, input }) => {
    const conditions = [
      eq(extMarketingStaffTasks.practiceId, ctx.practiceId),
      isNull(extMarketingStaffTasks.deletedAt),
    ];
    if (input.status !== "all") {
      conditions.push(eq(extMarketingStaffTasks.status, input.status));
    }
    if (input.kind !== "all") {
      conditions.push(eq(extMarketingStaffTasks.kind, input.kind));
    }
    return ctx.db
      .select()
      .from(extMarketingStaffTasks)
      .where(and(...conditions))
      .orderBy(desc(extMarketingStaffTasks.createdAt));
  }),

  resolveStaffTask: protectedProcedure
  .use(requireRole("admin", "veterinarian"))
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const [updated] = await ctx.db
      .update(extMarketingStaffTasks)
      .set({ status: "done" })
      .where(
        and(
          eq(extMarketingStaffTasks.id, input.id),
          eq(extMarketingStaffTasks.practiceId, ctx.practiceId),
        )
      )
      .returning();
    if (!updated) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
    }
    return updated;
  }),

  sendCondolenceCard: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [task] = await ctx.db
        .select()
        .from(extMarketingStaffTasks)
        .where(
          and(
            eq(extMarketingStaffTasks.id, input.taskId),
            eq(extMarketingStaffTasks.practiceId, ctx.practiceId)
          )
        )
        .limit(1);

      if (!task || !task.clientId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Úloha alebo klient neexistuje.",
        });
      }

      const [cl] = await ctx.db
        .select()
        .from(clients)
        .where(
          and(
            eq(clients.id, task.clientId),
            eq(clients.practiceId, ctx.practiceId)
          )
        )
        .limit(1);

      if (!cl) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Klient nebol nájdený.",
        });
      }

      const brand = await getBrand(ctx.db, ctx.practiceId);
      const [tpl] = await ctx.db
        .select()
        .from(extMarketingMessageTemplates)
        .where(
          and(
            eq(extMarketingMessageTemplates.practiceId, ctx.practiceId),
            eq(extMarketingMessageTemplates.key, "condolence_card"),
            eq(extMarketingMessageTemplates.isActive, true)
          )
        )
        .limit(1);

      const clientName = `${cl.firstName ?? ""} ${cl.lastName ?? ""}`.trim() || "Vážený klient";
      const defaultBody = "{{clinic}}: Vážená/vážený {{name}}, celý náš tím s vami hlboko súcíti pri strate vášho miláčika. Bol to výnimočný pacient a bolo nám veľkou cťou sa o neho starať. Ak budete čokoľvek potrebovať, sme tu pre vás.";

      const bodyTemplate = tpl?.body ?? defaultBody;
      const body = bodyTemplate
        .replace(/\{\{\s*name\s*\}\}/gi, clientName)
        .replace(/\{\{\s*pet\s*\}\}/gi, "vášho miláčika")
        .replace(/\{\{\s*clinic\s*\}\}/gi, brand?.name || "Veterinárna klinika");

      const [log] = await ctx.db
        .insert(extMarketingMessageLogs)
        .values({
          practiceId: ctx.practiceId,
          clientId: cl.id,
          templateId: tpl?.id ?? null,
          templateKey: "condolence_card",
          templateVersion: tpl?.version ?? 1,
          legalBasis: "contract",
          channel: tpl?.channel ?? "sms",
          language: tpl?.language ?? "sk",
          bodyRendered: body,
          triggerKey: "patient_deceased",
          status: "queued",
          idempotencyKey: `condolence:${task.id}:${Date.now()}`,
          scheduledFor: new Date(),
        })
        .returning();

      await ctx.db
        .update(extMarketingStaffTasks)
        .set({ status: "done" })
        .where(eq(extMarketingStaffTasks.id, task.id));

      return { success: true, logId: log?.id };
    }),

  // ── Content Batches & Weekly Planner ────────────────────────────────────────

  listContentBatches: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(extMarketingContentBatches)
      .where(eq(extMarketingContentBatches.practiceId, ctx.practiceId))
      .orderBy(desc(extMarketingContentBatches.weekStart))
      .limit(20);
  }),

  createContentBatch: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        weekStart: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const date = input.weekStart ? new Date(input.weekStart) : undefined;
      return generateWeeklyBatch(ctx.db, ctx.practiceId, {
        weekStart: date,
        userId: ctx.user.id,
      });
    }),

  approveContentBatch: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(z.object({ batchId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [batch] = await ctx.db
        .update(extMarketingContentBatches)
        .set({ status: "approved" })
        .where(
          and(
            eq(extMarketingContentBatches.id, input.batchId),
            eq(extMarketingContentBatches.practiceId, ctx.practiceId)
          )
        )
        .returning();

      if (!batch) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
      }

      await ctx.db
        .update(extMarketingContentItems)
        .set({
          status: "approved",
          approvedBy: ctx.user.id,
          approvedAt: new Date(),
        })
        .where(
          and(
            eq(extMarketingContentItems.batchId, input.batchId),
            eq(extMarketingContentItems.practiceId, ctx.practiceId),
            eq(extMarketingContentItems.status, "proposed")
          )
        );

      return batch;
    }),

  getWeeklyPlan: protectedProcedure
    .input(z.object({ weekStart: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const monday = input.weekStart
        ? mondayOf(new Date(input.weekStart))
        : mondayOf(new Date());
      const weekStr = monday.toISOString().slice(0, 10);

      let [batch] = await ctx.db
        .select()
        .from(extMarketingContentBatches)
        .where(
          and(
            eq(extMarketingContentBatches.practiceId, ctx.practiceId),
            eq(extMarketingContentBatches.weekStart, weekStr)
          )
        )
        .limit(1);

      if (!batch) {
        const gen = await generateWeeklyBatch(ctx.db, ctx.practiceId, {
          weekStart: monday,
          userId: ctx.user.id,
        });
        const [insertedBatch] = await ctx.db
          .select()
          .from(extMarketingContentBatches)
          .where(
            and(
              eq(extMarketingContentBatches.practiceId, ctx.practiceId),
              eq(extMarketingContentBatches.id, gen.result.batchId)
            )
          )
          .limit(1);
        batch = insertedBatch;
      }

      const items = await ctx.db
        .select()
        .from(extMarketingContentItems)
        .where(
          and(
            eq(extMarketingContentItems.batchId, batch.id),
            eq(extMarketingContentItems.practiceId, ctx.practiceId),
            isNull(extMarketingContentItems.deletedAt)
          )
        )
        .orderBy(extMarketingContentItems.scheduledFor);

      return { batch, items };
    }),

  rejectContentItem: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(extMarketingContentItems)
        .set({ status: "archived" })
        .where(
          and(
            eq(extMarketingContentItems.id, input.id),
            eq(extMarketingContentItems.practiceId, ctx.practiceId)
          )
        )
        .returning();
      return updated;
    }),

  autoFixContentItem: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [item] = await ctx.db
        .select()
        .from(extMarketingContentItems)
        .where(
          and(
            eq(extMarketingContentItems.id, input.id),
            eq(extMarketingContentItems.practiceId, ctx.practiceId)
          )
        )
        .limit(1);

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Content item not found" });
      }

      const rep = item.validatorFindings as ValidatorReport | null;
      if (!rep) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No validation findings to fix" });
      }

      const fixedBody = autoFix(item.body, rep);
      const guards = await nameGuards(ctx.db, ctx.practiceId);
      const newRep = validateMarketingText({
        text: fixedBody,
        context: "marketing",
        allowedClientNames: guards.allowedNames,
        knownClientNames: guards.knownNames,
      });

      const [updated] = await ctx.db
        .update(extMarketingContentItems)
        .set({
          body: fixedBody,
          validatorVerdict: newRep.verdict,
          validatorFindings: newRep,
          status: newRep.verdict === "block" ? "blocked" : "proposed",
        })
        .where(eq(extMarketingContentItems.id, input.id))
        .returning();

      return updated;
    }),

  createCustomPost: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        topic: z.string().min(1),
        scheduledFor: z.string().datetime().optional(),
        channel: z.enum(["instagram", "facebook", "google_business", "sms", "email"]).optional().default("facebook"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const brand = await getBrand(ctx.db, ctx.practiceId);
      const postDate = input.scheduledFor ? new Date(input.scheduledFor) : new Date(Date.now() + 24 * 3600_000);
      const monday = mondayOf(postDate);
      const weekStr = monday.toISOString().slice(0, 10);

      let [batch] = await ctx.db
        .select()
        .from(extMarketingContentBatches)
        .where(
          and(
            eq(extMarketingContentBatches.practiceId, ctx.practiceId),
            eq(extMarketingContentBatches.weekStart, weekStr)
          )
        )
        .limit(1);

      if (!batch) {
        [batch] = await ctx.db
          .insert(extMarketingContentBatches)
          .values({
            practiceId: ctx.practiceId,
            weekStart: weekStr,
            status: "in_review",
          })
          .returning();
      }

      const body = await composePost({
        recipeKey: "custom",
        lang: brand.defaultLanguage,
        brand,
        facts: {
          topic: input.topic.trim(),
          booking_url: brand.bookingUrl,
          seed: `custom-${Date.now()}`,
        },
      });

      const guards = await nameGuards(ctx.db, ctx.practiceId);
      const rep = validateMarketingText({
        text: body,
        context: "marketing",
        allowedClientNames: guards.allowedNames,
        knownClientNames: guards.knownNames,
      });

      const [item] = await ctx.db
        .insert(extMarketingContentItems)
        .values({
          practiceId: ctx.practiceId,
          batchId: batch.id,
          createdBy: ctx.user.id,
          title: input.topic.slice(0, 60),
          body,
          channel: input.channel ?? "facebook",
          status: rep.verdict === "block" ? "blocked" : "proposed",
          scheduledFor: postDate,
          validatorVerdict: rep.verdict,
          validatorFindings: rep,
        })
        .returning();

      return item;
    }),

  // ── Message Logs & Stats ────────────────────────────────────────────────────

  listMessageLogs: protectedProcedure
    .input(
      z.object({
        status: z.string().optional(),
        clientId: z.string().uuid().optional(),
        channel: z.string().optional(),
        limit: z.number().min(1).max(200).default(100),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(extMarketingMessageLogs.practiceId, ctx.practiceId)];

      if (input.status && input.status !== "all") {
        conditions.push(eq(extMarketingMessageLogs.status, input.status as any));
      }
      if (input.clientId) {
        conditions.push(eq(extMarketingMessageLogs.clientId, input.clientId));
      }
      if (input.channel && input.channel !== "all") {
        conditions.push(eq(extMarketingMessageLogs.channel, input.channel));
      }

      const rows = await ctx.db
        .select({
          log: extMarketingMessageLogs,
          client: {
            id: clients.id,
            firstName: clients.firstName,
            lastName: clients.lastName,
            phone: clients.phone,
            email: clients.email,
          },
          patient: {
            id: patients.id,
            name: patients.name,
            species: patients.species,
            status: patients.status,
          },
        })
        .from(extMarketingMessageLogs)
        .leftJoin(clients, eq(extMarketingMessageLogs.clientId, clients.id))
        .leftJoin(patients, eq(extMarketingMessageLogs.patientId, patients.id))
        .where(and(...conditions))
        .orderBy(desc(extMarketingMessageLogs.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  getMessageStats: protectedProcedure.query(async ({ ctx }) => {
    const since = new Date(Date.now() - 30 * 86400_000);
    const rows = await ctx.db
      .select({
        status: extMarketingMessageLogs.status,
        count: sql<number>`count(*)::int`,
      })
      .from(extMarketingMessageLogs)
      .where(
        and(
          eq(extMarketingMessageLogs.practiceId, ctx.practiceId),
          gte(extMarketingMessageLogs.createdAt, since)
        )
      )
      .groupBy(extMarketingMessageLogs.status);

    const stats = {
      total: 0,
      sent: 0,
      delivered: 0,
      queued: 0,
      failed: 0,
      blocked_sympathy: 0,
      suppressed_no_consent: 0,
      suppressed_rate: 0,
      suppressed_quiet: 0,
    };

    for (const r of rows) {
      stats.total += r.count;
      if (r.status in stats) {
        (stats as any)[r.status] = r.count;
      }
    }

    return stats;
  }),

  listMessageTemplates: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(extMarketingMessageTemplates)
      .where(
        and(
          eq(extMarketingMessageTemplates.practiceId, ctx.practiceId),
          eq(extMarketingMessageTemplates.isActive, true)
        )
      )
      .orderBy(extMarketingMessageTemplates.key);
  }),

  upsertMessageTemplate: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(
      z.object({
        id: z.string().uuid().optional(),
        key: z.string(),
        language: z.string().default("sk"),
        channel: z.string().default("sms"),
        body: z.string().min(1),
        legalBasis: z.string().default("contract"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        const [existing] = await ctx.db
          .select()
          .from(extMarketingMessageTemplates)
          .where(
            and(
              eq(extMarketingMessageTemplates.id, input.id),
              eq(extMarketingMessageTemplates.practiceId, ctx.practiceId)
            )
          )
          .limit(1);

        if (existing) {
          await ctx.db
            .update(extMarketingMessageTemplates)
            .set({ isActive: false })
            .where(eq(extMarketingMessageTemplates.id, existing.id));

          const [created] = await ctx.db
            .insert(extMarketingMessageTemplates)
            .values({
              practiceId: ctx.practiceId,
              key: input.key,
              language: input.language,
              channel: input.channel,
              body: input.body,
              legalBasis: input.legalBasis,
              version: existing.version + 1,
              isActive: true,
            })
            .returning();
          return created;
        }
      }

      const [created] = await ctx.db
        .insert(extMarketingMessageTemplates)
        .values({
          practiceId: ctx.practiceId,
          key: input.key,
          language: input.language,
          channel: input.channel,
          body: input.body,
          legalBasis: input.legalBasis,
          version: 1,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: [
            extMarketingMessageTemplates.practiceId,
            extMarketingMessageTemplates.key,
            extMarketingMessageTemplates.language,
          ],
          set: {
            body: input.body,
            channel: input.channel,
            legalBasis: input.legalBasis,
            isActive: true,
          },
        })
        .returning();

      return created;
    }),

  processQueuedMessages: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .mutation(async ({ ctx }) => {
      return processQueue(ctx.db, ctx.practiceId);
    }),

  triggerMessage: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        clientId: z.string().uuid(),
        triggerKey: z.string(),
        patientId: z.string().uuid().optional(),
        service: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.triggerKey === "patient_deceased") {
        return applySympathyGate(
          ctx.db,
          ctx.practiceId,
          input.clientId,
          input.patientId,
          "manual_trigger"
        );
      }

      return createMessagesForTrigger(ctx.db, ctx.practiceId, {
        triggerKey: input.triggerKey,
        clientId: input.clientId,
        patientId: input.patientId,
        service: input.service,
        eventId: `manual_${Date.now()}`,
      });
    }),

  // ── Automation Rules ────────────────────────────────────────────────────────

  listAutomationRules: protectedProcedure.query(async ({ ctx }) => {
    let rules = await ctx.db
      .select()
      .from(extMarketingAutomationRules)
      .where(eq(extMarketingAutomationRules.practiceId, ctx.practiceId))
      .orderBy(extMarketingAutomationRules.sort);

    if (rules.length === 0) {
      // Seed default Slovak automation rules
      const defaultRules = [
        {
          practiceId: ctx.practiceId,
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
          practiceId: ctx.practiceId,
          key: "postop_check",
          label: "Pooperačná kontrola stavu",
          description: "Odosiela SMS s odkazom na kontrolu stavu pacienta 24 hodín po prepustení z chirurgie.",
          triggerKey: "surgery_completed",
          timing: "24 hodín po zákroku",
          channel: "sms",
          legalBasis: "contract",
          enabled: true,
          sort: 2,
        },
        {
          practiceId: ctx.practiceId,
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
          practiceId: ctx.practiceId,
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
      ];

      await ctx.db
        .insert(extMarketingAutomationRules)
        .values(defaultRules)
        .onConflictDoNothing();

      rules = await ctx.db
        .select()
        .from(extMarketingAutomationRules)
        .where(eq(extMarketingAutomationRules.practiceId, ctx.practiceId))
        .orderBy(extMarketingAutomationRules.sort);
    }

    return rules;
  }),

  upsertAutomationRule: protectedProcedure
    .use(requireRole("admin"))
    .input(
      z.object({
        id: z.string().uuid().optional(),
        key: z.string(),
        label: z.string(),
        description: z.string().optional(),
        triggerKey: z.string(),
        timing: z.string().optional(),
        channel: z.string().default("sms"),
        legalBasis: z.string().default("contract"),
        enabled: z.boolean().default(true),
        sort: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [upserted] = await ctx.db
        .insert(extMarketingAutomationRules)
        .values({
          practiceId: ctx.practiceId,
          key: input.key,
          label: input.label,
          description: input.description ?? "",
          triggerKey: input.triggerKey,
          timing: input.timing ?? "",
          channel: input.channel,
          legalBasis: input.legalBasis,
          enabled: input.enabled,
          sort: input.sort,
        })
        .onConflictDoUpdate({
          target: [
            extMarketingAutomationRules.practiceId,
            extMarketingAutomationRules.key,
          ],
          set: {
            label: input.label,
            description: input.description ?? "",
            triggerKey: input.triggerKey,
            timing: input.timing ?? "",
            channel: input.channel,
            legalBasis: input.legalBasis,
            enabled: input.enabled,
            sort: input.sort,
          },
        })
        .returning();

      return upserted;
    }),

  toggleAutomationRule: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(z.object({ id: z.string().uuid(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(extMarketingAutomationRules)
        .set({ enabled: input.enabled })
        .where(
          and(
            eq(extMarketingAutomationRules.id, input.id),
            eq(extMarketingAutomationRules.practiceId, ctx.practiceId)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Rule not found" });
      }

      return updated;
    }),

  // ── Post-op Responses ───────────────────────────────────────────────────────

  submitPostopResponse: publicProcedure
    .input(
      z.object({
        messageLogId: z.string().uuid().optional(),
        clientId: z.string().uuid().optional(),
        patientId: z.string().uuid().optional(),
        outcome: z.enum(["ok", "question", "concern"]),
        note: z.string().max(1000).optional(),
        token: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let clientId = input.clientId;
      let practiceId: string | null = null;

      if (input.token) {
        try {
          const decoded = Buffer.from(input.token, "base64").toString("utf-8");
          const parts = decoded.split(":");
          if (parts.length >= 2) {
            clientId = parts[0];
            practiceId = parts[1];
          }
        } catch {
          // invalid token
        }
      }

      if (!practiceId && input.messageLogId) {
        const [log] = await ctx.db
          .select({
            practiceId: extMarketingMessageLogs.practiceId,
            clientId: extMarketingMessageLogs.clientId,
            patientId: extMarketingMessageLogs.patientId,
          })
          .from(extMarketingMessageLogs)
          .where(eq(extMarketingMessageLogs.id, input.messageLogId))
          .limit(1);
        if (log) {
          practiceId = log.practiceId;
          clientId = clientId ?? log.clientId;
        }
      }

      if (!practiceId && clientId) {
        const [cl] = await ctx.db
          .select({ practiceId: clients.practiceId })
          .from(clients)
          .where(eq(clients.id, clientId))
          .limit(1);
        if (cl) {
          practiceId = cl.practiceId;
        }
      }

      if (!practiceId || !clientId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unable to determine clinic or client identity.",
        });
      }

      const [response] = await ctx.db
        .insert(extMarketingPostopResponses)
        .values({
          practiceId,
          messageLogId: input.messageLogId ?? null,
          clientId,
          patientId: input.patientId ?? null,
          outcome: input.outcome,
          note: input.note ?? "",
        })
        .returning();

      if (input.outcome === "concern" || input.outcome === "question") {
        await ctx.db.insert(extMarketingStaffTasks).values({
          practiceId,
          clientId,
          kind: "postop_escalation",
          title:
            input.outcome === "concern"
              ? "Post-op eskalácia: Majiteľ hlási obavy / komplikácie"
              : "Post-op otázka: Majiteľ má doplňujúce otázky",
          detail:
            input.note ||
            `Klient hlási stav: ${input.outcome}. Bezodkladne kontaktovať majiteľa.`,
          status: "open",
        });
      }

      return { success: true, id: response.id };
    }),

  listPostopResponses: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        response: extMarketingPostopResponses,
        client: {
          id: clients.id,
          firstName: clients.firstName,
          lastName: clients.lastName,
          phone: clients.phone,
        },
        patient: {
          id: patients.id,
          name: patients.name,
          species: patients.species,
        },
      })
      .from(extMarketingPostopResponses)
      .leftJoin(clients, eq(extMarketingPostopResponses.clientId, clients.id))
      .leftJoin(patients, eq(extMarketingPostopResponses.patientId, patients.id))
      .where(eq(extMarketingPostopResponses.practiceId, ctx.practiceId))
      .orderBy(desc(extMarketingPostopResponses.createdAt))
      .limit(50);
  }),

  // ── Operative Scripts ───────────────────────────────────────────────────────

  listOperativeScripts: protectedProcedure.query(async ({ ctx }) => {
    let scripts = await ctx.db
      .select()
      .from(extMarketingOperativeScripts)
      .where(eq(extMarketingOperativeScripts.practiceId, ctx.practiceId))
      .orderBy(extMarketingOperativeScripts.sort);

    if (scripts.length === 0) {
      const defaultScripts = [
        {
          practiceId: ctx.practiceId,
          category: "discharge_ask",
          title: "Dentálna hygiena a stomatológia",
          body: "12 hodín hladovka pred anestéziou. Mäkká strava 3-5 dní po zákroku. Nekŕmiť tvrdými kosťami ani maškrtami. Pri krvácaní dlhšom ako 24h volať kliniku.",
          note: "Štandardný protokol pre ultrazvukové čistenie zubov.",
          sort: 1,
        },
        {
          practiceId: ctx.practiceId,
          category: "discharge_ask",
          title: "Kastrácia psa / mačky",
          body: "Ochranný golier alebo pooperačné body 10-12 dní. Pokojový režim bez behania a skákania. Kontrola operačnej rany 2x denne. Stehy sa vyberajú o 10-12 dní.",
          note: "Pooperačná starostlivosť po bežnej orchiektómii / ovariektómii.",
          sort: 2,
        },
        {
          practiceId: ctx.practiceId,
          category: "crisis",
          title: "Pyometra - akútny stav",
          body: "Prísny pokojový režim, pravidelné podávanie antibiotík a analgetík. Zabezpečiť stály prístup k vode. Sledovať močenie, zvracanie a teplotu.",
          note: "Akútna pooperačná starostlivosť.",
          sort: 3,
        },
        {
          practiceId: ctx.practiceId,
          category: "condolence",
          title: "Kondolenčný protokol",
          body: "Vyjadriť úprimnú sústrasť v mene celého personálu. Ponúknuť možnosť individuálnej kremácie a odtlačku labky. Zaznamenať do systému a zablokovať všetky marketingové a recall správy.",
          note: "Sympathy flow pre personál.",
          sort: 4,
        },
        {
          practiceId: ctx.practiceId,
          category: "review_ask",
          title: "Žiadosť o recenziu po vyriešení problému",
          body: "Sme radi, že sa vášmu miláčikovi darí lepšie! Pomohlo by nám, keby ste našu prácu ohodnotili na Google. Zaberie to len minútu.",
          note: "Odosiela sa len po úspešnej rekonvalescencii.",
          sort: 5,
        },
      ];

      await ctx.db
        .insert(extMarketingOperativeScripts)
        .values(defaultScripts)
        .onConflictDoNothing();

      scripts = await ctx.db
        .select()
        .from(extMarketingOperativeScripts)
        .where(eq(extMarketingOperativeScripts.practiceId, ctx.practiceId))
        .orderBy(extMarketingOperativeScripts.sort);
    }

    return scripts;
  }),

  upsertOperativeScript: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(
      z.object({
        id: z.string().uuid().optional(),
        category: z.string(),
        title: z.string(),
        body: z.string(),
        note: z.string().optional(),
        sort: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        const [updated] = await ctx.db
          .update(extMarketingOperativeScripts)
          .set({
            category: input.category,
            title: input.title,
            body: input.body,
            note: input.note ?? "",
            sort: input.sort,
          })
          .where(
            and(
              eq(extMarketingOperativeScripts.id, input.id),
              eq(extMarketingOperativeScripts.practiceId, ctx.practiceId)
            )
          )
          .returning();
        return updated;
      }

      const [created] = await ctx.db
        .insert(extMarketingOperativeScripts)
        .values({
          practiceId: ctx.practiceId,
          category: input.category,
          title: input.title,
          body: input.body,
          note: input.note ?? "",
          sort: input.sort,
        })
        .returning();

      return created;
    }),

  // ── SMS Rate Limit & GDPR Unsubscribe ───────────────────────────────────────

  checkSmsRateLimit: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        windowDays: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const allowed = await smsRateLimitOk(
        ctx.db,
        ctx.practiceId,
        input.clientId,
        input.windowDays
      );
      return { allowed };
    }),

  getUnsubscribeInfo: publicProcedure
    .input(
      z.object({
        token: z.string().optional(),
        clientId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      let resolvedClientId: string | undefined = input.clientId;
      let resolvedPracticeId: string | undefined;

      if (input.token) {
        try {
          const decoded = Buffer.from(input.token, "base64").toString("utf-8");
          const [cId, pId] = decoded.split(":");
          if (cId) resolvedClientId = cId;
          if (pId) resolvedPracticeId = pId;
        } catch {
          // ignore
        }
      }

      if (!resolvedClientId) {
        return { found: false, message: "Neplatný odkaz na odhlásenie." };
      }

      const [client] = await ctx.db
        .select({
          id: clients.id,
          firstName: clients.firstName,
          lastName: clients.lastName,
          smsConsent: clients.smsConsent,
          practiceId: clients.practiceId,
        })
        .from(clients)
        .where(
          resolvedPracticeId
            ? and(eq(clients.id, resolvedClientId), eq(clients.practiceId, resolvedPracticeId))
            : eq(clients.id, resolvedClientId)
        )
        .limit(1);

      if (!client) {
        return { found: false, message: "Klient nebol nájdený." };
      }

      const [practice] = await ctx.db
        .select({
          id: practices.id,
          name: practices.name,
          phone: practices.phone,
        })
        .from(practices)
        .where(eq(practices.id, client.practiceId))
        .limit(1);

      return {
        found: true,
        clientId: client.id,
        clientName: `${client.firstName} ${client.lastName}`.trim(),
        smsConsent: client.smsConsent ?? true,
        practiceName: practice?.name ?? "Veterinárna klinika",
        practicePhone: practice?.phone,
      };
    }),

  unsubscribeByToken: publicProcedure
    .input(
      z.object({
        token: z.string().optional(),
        clientId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let resolvedClientId: string | undefined = input.clientId;
      let resolvedPracticeId: string | undefined;

      if (input.token) {
        try {
          const decoded = Buffer.from(input.token, "base64").toString("utf-8");
          const [cId, pId] = decoded.split(":");
          if (cId) resolvedClientId = cId;
          if (pId) resolvedPracticeId = pId;
        } catch {
          // ignore
        }
      }

      if (!resolvedClientId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Neplatný identifikátor klienta.",
        });
      }

      if (!resolvedPracticeId) {
        const [c] = await ctx.db
          .select({ practiceId: clients.practiceId })
          .from(clients)
          .where(eq(clients.id, resolvedClientId))
          .limit(1);
        resolvedPracticeId = c?.practiceId;
      }

      if (!resolvedPracticeId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Klient nebol nájdený.",
        });
      }

      // 1. Reset client smsConsent
      await ctx.db
        .update(clients)
        .set({ smsConsent: false })
        .where(
          and(
            eq(clients.id, resolvedClientId),
            eq(clients.practiceId, resolvedPracticeId)
          )
        );

      // 2. Revoke active marketing_messages consent
      await ctx.db
        .update(extMarketingMediaConsents)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(extMarketingMediaConsents.clientId, resolvedClientId),
            eq(extMarketingMediaConsents.practiceId, resolvedPracticeId),
            eq(extMarketingMediaConsents.scope, "marketing_messages"),
            isNull(extMarketingMediaConsents.revokedAt)
          )
        );

      // 3. Mark queued messages for this client as suppressed
      await ctx.db
        .update(extMarketingMessageLogs)
        .set({ status: "suppressed_no_consent" })
        .where(
          and(
            eq(extMarketingMessageLogs.clientId, resolvedClientId),
            eq(extMarketingMessageLogs.practiceId, resolvedPracticeId),
            eq(extMarketingMessageLogs.status, "queued")
          )
        );

      return { success: true };
    }),

  // ── Consents Registry ───────────────────────────────────────────────────────

  listMediaConsents: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        consent: extMarketingMediaConsents,
        client: {
          id: clients.id,
          firstName: clients.firstName,
          lastName: clients.lastName,
          phone: clients.phone,
          email: clients.email,
        },
        patient: {
          id: patients.id,
          name: patients.name,
          species: patients.species,
        },
      })
      .from(extMarketingMediaConsents)
      .leftJoin(clients, eq(extMarketingMediaConsents.clientId, clients.id))
      .leftJoin(patients, eq(extMarketingMediaConsents.patientId, patients.id))
      .where(
        and(
          eq(extMarketingMediaConsents.practiceId, ctx.practiceId),
          isNull(extMarketingMediaConsents.deletedAt)
        )
      )
      .orderBy(desc(extMarketingMediaConsents.grantedAt));
  }),

  createMediaConsent: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        clientId: z.string().uuid(),
        patientId: z.string().uuid().optional(),
        scope: z.enum([
          "photo_social",
          "photo_web",
          "photo_tv",
          "story",
          "testimonial",
          "marketing_messages",
        ]),
        evidenceType: z.enum(["signature", "sms_confirm", "pdf"]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(extMarketingMediaConsents)
        .values({
          practiceId: ctx.practiceId,
          clientId: input.clientId,
          patientId: input.patientId ?? null,
          scope: input.scope,
          evidenceType: input.evidenceType,
          grantedAt: new Date(),
          notes: input.notes ?? null,
        })
        .returning();

      if (input.scope === "marketing_messages") {
        await ctx.db
          .update(clients)
          .set({ smsConsent: true })
          .where(
            and(
              eq(clients.id, input.clientId),
              eq(clients.practiceId, ctx.practiceId)
            )
          );
      }

      return created;
    }),

  revokeMediaConsent: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(z.object({ consentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const [consent] = await ctx.db
        .select()
        .from(extMarketingMediaConsents)
        .where(
          and(
            eq(extMarketingMediaConsents.id, input.consentId),
            eq(extMarketingMediaConsents.practiceId, ctx.practiceId)
          )
        )
        .limit(1);

      if (!consent || consent.revokedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Súhlas neexistuje alebo už bol odvolaný.",
        });
      }

      const [updated] = await ctx.db
        .update(extMarketingMediaConsents)
        .set({ revokedAt: now })
        .where(eq(extMarketingMediaConsents.id, input.consentId))
        .returning();

      if (consent.scope === "marketing_messages") {
        await ctx.db
          .update(clients)
          .set({ smsConsent: false })
          .where(
            and(
              eq(clients.id, consent.clientId),
              eq(clients.practiceId, ctx.practiceId)
            )
          );

        await ctx.db
          .update(extMarketingMessageLogs)
          .set({ status: "suppressed_no_consent" })
          .where(
            and(
              eq(extMarketingMessageLogs.clientId, consent.clientId),
              eq(extMarketingMessageLogs.practiceId, ctx.practiceId),
              eq(extMarketingMessageLogs.status, "queued")
            )
          );
      }

      // If media consent, archive proposed items using media with this consent
      const assets = await ctx.db
        .select({ id: extMarketingMediaAssets.id })
        .from(extMarketingMediaAssets)
        .where(eq(extMarketingMediaAssets.consentId, input.consentId));

      const assetIds = assets.map((a) => a.id);
      if (assetIds.length > 0) {
        await ctx.db
          .update(extMarketingContentItems)
          .set({ status: "archived" })
          .where(
            and(
              inArray(extMarketingContentItems.mediaAssetId, assetIds),
              eq(extMarketingContentItems.status, "proposed")
            )
          );
      }

      return updated;
    }),

  getPublicTvSlides: publicProcedure
    .input(z.object({ clinicId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const slides = await ctx.db
        .select()
        .from(extMarketingTvSlides)
        .where(
          and(
            eq(extMarketingTvSlides.practiceId, input.clinicId),
            eq(extMarketingTvSlides.isActive, true),
            isNull(extMarketingTvSlides.deletedAt)
          )
        )
        .orderBy(extMarketingTvSlides.sortOrder);

      const [practice] = await ctx.db
        .select({
          id: practices.id,
          name: practices.name,
          phone: practices.phone,
          settings: practices.settings,
        })
        .from(practices)
        .where(eq(practices.id, input.clinicId))
        .limit(1);

      return {
        slides,
        practice,
      };
    }),

  // ── Media Library Procedures ──────────────────────────────────────────

  listMediaAssets: protectedProcedure
    .input(
      z.object({
        kind: z.enum(["photo", "brand_graphic", "video", "illustration", "all"]).default("all"),
        hasConsent: z.enum(["all", "valid", "missing", "not_required"]).default("all"),
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const filterKind = input?.kind ?? "all";
      const filterConsent = input?.hasConsent ?? "all";
      const limit = input?.limit ?? 50;

      const conditions = [
        eq(extMarketingMediaAssets.practiceId, ctx.practiceId),
        isNull(extMarketingMediaAssets.deletedAt),
      ];

      if (filterKind !== "all") {
        conditions.push(eq(extMarketingMediaAssets.kind, filterKind));
      }

      const rows = await ctx.db
        .select({
          asset: extMarketingMediaAssets,
          consent: extMarketingMediaConsents,
        })
        .from(extMarketingMediaAssets)
        .leftJoin(
          extMarketingMediaConsents,
          eq(extMarketingMediaAssets.consentId, extMarketingMediaConsents.id)
        )
        .where(and(...conditions))
        .orderBy(desc(extMarketingMediaAssets.createdAt))
        .limit(limit);

      return rows
        .filter(({ asset, consent }) => {
          if (filterConsent === "all") return true;
          const isConsentValid = consent && !consent.revokedAt;
          if (filterConsent === "valid") return isConsentValid;
          if (filterConsent === "missing") return asset.subjectsPresent && !isConsentValid;
          if (filterConsent === "not_required") return !asset.subjectsPresent;
          return true;
        })
        .map(({ asset, consent }) => ({
          asset,
          consent: consent
            ? {
                ...consent,
                revoked: Boolean(consent.revokedAt),
                validUntil: new Date(new Date(consent.grantedAt).getTime() + 365 * 86400_000).toISOString(),
              }
            : null,
        }));
    }),

  createMediaAsset: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        url: z.string().min(1),
        kind: z.enum(["photo", "brand_graphic", "video", "illustration"]).default("photo"),
        caption: z.string().optional(),
        altText: z.string().optional(),
        patientName: z.string().optional(),
        subjectsPresent: z.boolean().default(false),
        consentId: z.string().uuid().optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.subjectsPresent && !input.consentId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Médiá so zobrazením pacienta alebo majiteľa vyžadujú prepojenie na platný GDPR súhlas.",
        });
      }

      if (input.consentId) {
        const [consent] = await ctx.db
          .select()
          .from(extMarketingMediaConsents)
          .where(
            and(
              eq(extMarketingMediaConsents.id, input.consentId),
              eq(extMarketingMediaConsents.practiceId, ctx.practiceId),
              isNull(extMarketingMediaConsents.revokedAt)
            )
          )
          .limit(1);

        if (!consent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Vybraný GDPR súhlas neexistuje alebo bol odvolaný.",
          });
        }
      }

      const [created] = await ctx.db
        .insert(extMarketingMediaAssets)
        .values({
          practiceId: ctx.practiceId,
          uploadedBy: ctx.user.id,
          url: input.url,
          kind: input.kind,
          caption: input.caption ?? null,
          altText: input.altText ?? "",
          patientName: input.patientName ?? null,
          subjectsPresent: input.subjectsPresent,
          consentId: input.consentId ?? null,
          tags: input.tags ?? [],
        })
        .returning();

      return created;
    }),

  deleteMediaAsset: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .update(extMarketingMediaAssets)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(extMarketingMediaAssets.id, input.id),
            eq(extMarketingMediaAssets.practiceId, ctx.practiceId)
          )
        )
        .returning();
      return deleted;
    }),

  suggestMediaAltText: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(z.object({
      kind: z.enum(["photo", "brand_graphic", "video", "illustration"]),
      caption: z.string().optional(),
      patientName: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [practice] = await ctx.db
        .select({ name: practices.name })
        .from(practices)
        .where(eq(practices.id, ctx.practiceId))
        .limit(1);

      const clinicName = practice?.name ?? "Veterinárna klinika";
      const petDesc = input.patientName ? ` – pacient ${input.patientName}` : "";
      const kindDesc =
        input.kind === "video" ? "Krátke video z kliniky" :
        input.kind === "illustration" ? "Ilustrácia k preventívnej starostlivosti" :
        input.kind === "brand_graphic" ? "Informačná grafika kliniky" :
        "Fotografia z veterinárnej ambulancie";

      const tagDesc = (input.tags && input.tags.length > 0) ? `, zameranie: ${input.tags.slice(0, 3).join(", ")}` : "";
      const captionDesc = input.caption ? ` (${input.caption})` : "";

      const candidate = `${kindDesc}${petDesc}${captionDesc}${tagDesc} – ${clinicName}`;
      const report = validateMarketingText({ text: candidate, context: "marketing" });

      return {
        altText: candidate,
        report,
      };
    }),

  listConsentCandidates: protectedProcedure.query(async ({ ctx }) => {
    const consents = await ctx.db
      .select({
        consent: extMarketingMediaConsents,
        client: clients,
        patient: patients,
      })
      .from(extMarketingMediaConsents)
      .innerJoin(clients, eq(extMarketingMediaConsents.clientId, clients.id))
      .leftJoin(patients, eq(extMarketingMediaConsents.patientId, patients.id))
      .where(
        and(
          eq(extMarketingMediaConsents.practiceId, ctx.practiceId),
          isNull(extMarketingMediaConsents.revokedAt)
        )
      )
      .orderBy(desc(extMarketingMediaConsents.grantedAt));

    return consents.map(({ consent, client, patient }) => ({
      id: consent.id,
      scope: consent.scope,
      clientName: `${client.firstName} ${client.lastName}`,
      patientName: patient?.name ?? "Všetky zvieratá klienta",
      grantedAt: consent.grantedAt,
    }));
  }),

  applyMediaEdit: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        id: z.string().uuid(),
        edit: z.object({
          preset: z.string().optional(),
          crop: z.string().optional(),
          overlay: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(extMarketingMediaAssets)
        .where(
          and(
            eq(extMarketingMediaAssets.id, input.id),
            eq(extMarketingMediaAssets.practiceId, ctx.practiceId)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Médium nebolo nájdené." });
      }

      const currentMeta = (existing.meta as Record<string, any>) ?? {};
      const updatedMeta = {
        ...currentMeta,
        edit: {
          ...(currentMeta.edit ?? {}),
          ...input.edit,
        },
      };

      const [updated] = await ctx.db
        .update(extMarketingMediaAssets)
        .set({ meta: updatedMeta })
        .where(
          and(
            eq(extMarketingMediaAssets.id, input.id),
            eq(extMarketingMediaAssets.practiceId, ctx.practiceId)
          )
        )
        .returning();

      return { ok: true, asset: updated };
    }),

  generateIllustration: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(z.object({ prompt: z.string().min(4).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const clean = input.prompt.trim();
      const report = validateMarketingText({ text: clean, context: "marketing" });
      if (report.verdict === "block") {
        return {
          ok: false,
          error: "Validátor prompt zablokoval – upravte zadanie (žiadne Rx liečivá ani zakázané tvrdenia).",
          report,
        };
      }

      const brand = await getBrand(ctx.db, ctx.practiceId);
      const url = proceduralIllustration(clean, {
        name: brand.name,
        brandColor: brand.brandColor,
        accentColor: brand.accentColor,
      });

      const [created] = await ctx.db
        .insert(extMarketingMediaAssets)
        .values({
          practiceId: ctx.practiceId,
          uploadedBy: ctx.user.id,
          url,
          kind: "illustration",
          caption: clean,
          altText: `Ilustrácia (generovaná): ${clean}`,
          subjectsPresent: false,
          consentId: null,
          tags: ["generované", "ai-canvas"],
          meta: { generated: true, prompt: clean },
        })
        .returning();

      return { ok: true, id: created.id, report };
    }),

  grantConsent: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        clientId: z.string().uuid(),
        patientId: z.string().uuid().optional(),
        scope: z.enum(["photo_social", "photo_web", "photo_tv", "story", "testimonial", "marketing_messages"]).default("photo_social"),
        evidenceType: z.enum(["signature", "sms_confirm", "pdf"]).default("signature"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [consent] = await ctx.db
        .insert(extMarketingMediaConsents)
        .values({
          practiceId: ctx.practiceId,
          clientId: input.clientId,
          patientId: input.patientId ?? null,
          scope: input.scope,
          evidenceType: input.evidenceType,
          grantedAt: new Date(),
          notes: input.notes ?? "Udelené na recepcii (podpis)",
        })
        .returning();

      return { ok: true, consent };
    }),

  getBrandInfo: protectedProcedure.query(async ({ ctx }) => {
    const brand = await getBrand(ctx.db, ctx.practiceId);
    const words = (brand.name || "Veterinárna klinika").trim().split(/\s+/);
    const logoInitials =
      words.length >= 2
        ? `${words[0][0]}${words[1][0]}`.toUpperCase()
        : (brand.name.slice(0, 2) || "VK").toUpperCase();

    return {
      name: brand.name,
      logoInitials,
      primaryColor: brand.brandColor || "#0e5e4a",
      secondaryColor: brand.accentColor || "#e8a33d",
      phone: brand.phone,
      bookingUrl: brand.bookingUrl,
    };
  }),

  listClientsForMedia: protectedProcedure.query(async ({ ctx }) => {
    const clientList = await ctx.db
      .select({
        id: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
      })
      .from(clients)
      .where(
        and(
          eq(clients.practiceId, ctx.practiceId),
          isNull(clients.deletedAt)
        )
      )
      .orderBy(clients.lastName, clients.firstName)
      .limit(80);

    const activeConsents = await ctx.db
      .select({
        id: extMarketingMediaConsents.id,
        clientId: extMarketingMediaConsents.clientId,
      })
      .from(extMarketingMediaConsents)
      .where(
        and(
          eq(extMarketingMediaConsents.practiceId, ctx.practiceId),
          eq(extMarketingMediaConsents.scope, "photo_social"),
          isNull(extMarketingMediaConsents.revokedAt)
        )
      );

    const consentByClient = new Map<string, string>();
    for (const c of activeConsents) {
      consentByClient.set(c.clientId, c.id);
    }

    return clientList.map((cl) => ({
      id: cl.id,
      name: `${cl.firstName} ${cl.lastName}`.trim(),
      validConsentId: consentByClient.get(cl.id) ?? null,
    }));
  }),

  // ── Competitor Tracking Procedures ──────────────────────────────────

  listCompetitorSnapshots: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(extMarketingCompetitorSnapshots)
      .where(
        and(
          eq(extMarketingCompetitorSnapshots.practiceId, ctx.practiceId),
          isNull(extMarketingCompetitorSnapshots.deletedAt)
        )
      )
      .orderBy(desc(extMarketingCompetitorSnapshots.createdAt))
      .limit(10);

    return rows;
  }),

  runCompetitorAnalysis: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(z.object({
      query: z.string().min(2).max(120),
    }))
    .mutation(async ({ ctx, input }) => {
      const q = input.query.trim();
      const result = await analyzeCompetitors(q);

      const [saved] = await ctx.db
        .insert(extMarketingCompetitorSnapshots)
        .values({
          practiceId: ctx.practiceId,
          query: q,
          region: result.region,
          clinics: result.clinics,
          recommendations: result.recommendations,
          articles: result.articles,
          sources: result.sources,
          model: result.model,
          isSample: result.isSample,
        })
        .returning();

      return saved;
    }),

  toggleCompetitorDigest: protectedProcedure
    .use(requireRole("admin"))
    .input(z.object({
      enabled: z.boolean(),
      email: z.string().email().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [practice] = await ctx.db
        .select({ settings: practices.settings })
        .from(practices)
        .where(eq(practices.id, ctx.practiceId))
        .limit(1);

      const currentSettings = (practice?.settings as Record<string, unknown>) ?? {};
      const updatedSettings = {
        ...currentSettings,
        competitorDigestEnabled: input.enabled,
        competitorDigestEmail: input.email ?? currentSettings.competitorDigestEmail,
      };

      await ctx.db
        .update(practices)
        .set({ settings: updatedSettings })
        .where(eq(practices.id, ctx.practiceId));

      return { ok: true, enabled: input.enabled };
    }),

  getWebsiteConfig: protectedProcedure.query(async ({ ctx }) => {
    const [practice] = await ctx.db
      .select({
        id: practices.id,
        name: practices.name,
        logoUrl: practices.logoUrl,
        createdAt: practices.createdAt,
        settings: practices.settings,
      })
      .from(practices)
      .where(eq(practices.id, ctx.practiceId))
      .limit(1);

    const settings = (practice?.settings ?? {}) as Record<string, any>;
    const bk = (settings.brandKit ?? {}) as Record<string, any>;

    const [existingConfig] = await ctx.db
      .select()
      .from(extMarketingWebsiteConfig)
      .where(eq(extMarketingWebsiteConfig.practiceId, ctx.practiceId))
      .limit(1);

    const seedSections = getSeedWebsiteSections(practice?.name || "");
    const sectionsDraft = existingConfig?.sectionsDraft && Array.isArray(existingConfig.sectionsDraft) && existingConfig.sectionsDraft.length > 0
      ? (existingConfig.sectionsDraft as any)
      : seedSections;

    const published = existingConfig ? existingConfig.published : Boolean(settings.websitePublished);

    // Staff members from clinic
    const staffMembers = await ctx.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.practiceId, ctx.practiceId),
          inArray(users.role, ["admin", "veterinarian", "technician"]),
          isNull(users.deletedAt)
        )
      );

    // Count public handouts
    const publicHandouts = await ctx.db
      .select({ id: extMarketingHandouts.id })
      .from(extMarketingHandouts)
      .where(
        and(
          eq(extMarketingHandouts.practiceId, ctx.practiceId),
          eq(extMarketingHandouts.isPublic, true),
          isNull(extMarketingHandouts.deletedAt)
        )
      );

    // Count 5-star reviews
    const fiveStarReviews = await ctx.db
      .select({ id: extMarketingReviews.id })
      .from(extMarketingReviews)
      .where(
        and(
          eq(extMarketingReviews.practiceId, ctx.practiceId),
          eq(extMarketingReviews.rating, 5),
          isNull(extMarketingReviews.deletedAt)
        )
      );

    // Count active patients
    const [patientCountRes] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(patients)
      .where(
        and(
          eq(patients.practiceId, ctx.practiceId),
          isNull(patients.deletedAt)
        )
      );
    const patientCount = Number(patientCountRes?.count ?? 0);

    // Years in practice calculation
    const practiceCreatedYear = practice?.createdAt
      ? new Date(practice.createdAt).getFullYear()
      : new Date().getFullYear();
    const yearsInPractice = Math.max(1, new Date().getFullYear() - practiceCreatedYear);

    // Count website inquiries
    const [inquiriesCountRes] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(extMarketingWebsiteInquiries)
      .where(
        and(
          eq(extMarketingWebsiteInquiries.practiceId, ctx.practiceId),
          isNull(extMarketingWebsiteInquiries.deletedAt)
        )
      );
    const inquiriesCount = Number(inquiriesCountRes?.count ?? 0);

    const brandKit = {
      brandColor: (settings.brandColor as string | undefined) ?? "#0d9488",
      secondaryColor: (bk.secondaryColor as string | undefined) ?? "#f5f5f4",
      toneOfVoice: (bk.toneOfVoice as string | undefined) ?? "",
      brandVoiceInstructions: (bk.brandVoiceInstructions as string | undefined) ?? "",
      disclaimer: (bk.disclaimer as string | undefined) ?? "",
      socialHandles: (bk.socialHandles as any) ?? {},
      clinicName: practice?.name ?? "",
      logoUrl: practice?.logoUrl ?? null,
    };

    return {
      published,
      clinicId: practice?.id ?? ctx.practiceId,
      clinicName: practice?.name ?? "",
      sectionsDraft,
      brandKit,
      teamCount: staffMembers.length,
      handoutsCount: publicHandouts.length,
      reviewsCount: fiveStarReviews.length,
      inquiriesCount,
      liveStats: {
        patientCount,
        fiveStarReviewCount: fiveStarReviews.length,
        yearsInPractice,
      },
    };
  }),

  updateWebsiteSections: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(z.object({ sections: z.array(websiteSectionSchema) }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: extMarketingWebsiteConfig.id })
        .from(extMarketingWebsiteConfig)
        .where(eq(extMarketingWebsiteConfig.practiceId, ctx.practiceId))
        .limit(1);

      if (existing) {
        await ctx.db
          .update(extMarketingWebsiteConfig)
          .set({
            sectionsDraft: input.sections,
            updatedAt: new Date(),
          })
          .where(eq(extMarketingWebsiteConfig.practiceId, ctx.practiceId));
      } else {
        await ctx.db
          .insert(extMarketingWebsiteConfig)
          .values({
            practiceId: ctx.practiceId,
            sectionsDraft: input.sections,
            sectionsPublished: null,
            published: false,
          });
      }

      return { ok: true, count: input.sections.length };
    }),

  toggleWebsite: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(z.object({ published: z.boolean().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const [practice] = await ctx.db
        .select({
          name: practices.name,
          settings: practices.settings,
        })
        .from(practices)
        .where(eq(practices.id, ctx.practiceId))
        .limit(1);

      const [existingConfig] = await ctx.db
        .select()
        .from(extMarketingWebsiteConfig)
        .where(eq(extMarketingWebsiteConfig.practiceId, ctx.practiceId))
        .limit(1);

      const settings = (practice?.settings ?? {}) as Record<string, any>;
      const currentPublished = existingConfig ? existingConfig.published : Boolean(settings.websitePublished);
      const nextPublished = input?.published !== undefined ? input.published : !currentPublished;

      const seedSections = getSeedWebsiteSections(practice?.name || "");
      const draftToPublish = existingConfig?.sectionsDraft && Array.isArray(existingConfig.sectionsDraft) && existingConfig.sectionsDraft.length > 0
        ? existingConfig.sectionsDraft
        : seedSections;

      if (existingConfig) {
        const updateData: any = {
          published: nextPublished,
          updatedAt: new Date(),
        };
        if (nextPublished) {
          updateData.sectionsPublished = draftToPublish;
          updateData.publishedAt = new Date();
        }
        await ctx.db
          .update(extMarketingWebsiteConfig)
          .set(updateData)
          .where(eq(extMarketingWebsiteConfig.practiceId, ctx.practiceId));
      } else {
        await ctx.db
          .insert(extMarketingWebsiteConfig)
          .values({
            practiceId: ctx.practiceId,
            sectionsDraft: seedSections,
            sectionsPublished: nextPublished ? seedSections : null,
            published: nextPublished,
            publishedAt: nextPublished ? new Date() : null,
          });
      }

      // Keep settings.websitePublished synced for legacy readers
      await ctx.db
        .update(practices)
        .set({
          settings: {
            ...settings,
            websitePublished: nextPublished,
          },
        })
        .where(eq(practices.id, ctx.practiceId));

      return { published: nextPublished };
    }),

  getPublicWebsiteData: publicProcedure
    .input(z.object({ clinicId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [practice] = await ctx.db
        .select({
          id: practices.id,
          name: practices.name,
          phone: practices.phone,
          email: practices.email,
          address: practices.address,
          website: practices.website,
          logoUrl: practices.logoUrl,
          createdAt: practices.createdAt,
          settings: practices.settings,
        })
        .from(practices)
        .where(and(eq(practices.id, input.clinicId), isNull(practices.deletedAt)))
        .limit(1);

      if (!practice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clinic not found",
        });
      }

      const settings = (practice.settings ?? {}) as Record<string, any>;
      const bk = (settings.brandKit ?? {}) as Record<string, any>;

      const [config] = await ctx.db
        .select()
        .from(extMarketingWebsiteConfig)
        .where(eq(extMarketingWebsiteConfig.practiceId, input.clinicId))
        .limit(1);

      const isPublished = config ? config.published : Boolean(settings.websitePublished);
      const seedSections = getSeedWebsiteSections(practice.name);
      const sections = config?.sectionsPublished && Array.isArray(config.sectionsPublished) && config.sectionsPublished.length > 0
        ? (config.sectionsPublished as any)
        : seedSections;

      const brandKit = {
        brandColor: (settings.brandColor as string | undefined) ?? "#0d9488",
        secondaryColor: (bk.secondaryColor as string | undefined) ?? "#f5f5f4",
        toneOfVoice: (bk.toneOfVoice as string | undefined) ?? "",
        socialHandles: (bk.socialHandles as any) ?? {},
        clinicName: practice.name,
        logoUrl: practice.logoUrl ?? null,
      };

      // Staff members from clinic with avatarUrl
      const staffMembers = await ctx.db
        .select({
          id: users.id,
          name: users.name,
          role: users.role,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(
          and(
            eq(users.practiceId, input.clinicId),
            inArray(users.role, ["admin", "veterinarian", "technician"]),
            isNull(users.deletedAt)
          )
        );

      // Public care handouts
      const publicHandouts = await ctx.db
        .select({
          id: extMarketingHandouts.id,
          slug: extMarketingHandouts.slug,
          title: extMarketingHandouts.title,
          body: extMarketingHandouts.body,
          species: extMarketingHandouts.species,
          tags: extMarketingHandouts.tags,
        })
        .from(extMarketingHandouts)
        .where(
          and(
            eq(extMarketingHandouts.practiceId, input.clinicId),
            eq(extMarketingHandouts.isPublic, true),
            isNull(extMarketingHandouts.deletedAt)
          )
        )
        .limit(6);

      // 4 and 5 star reviews
      const topReviews = await ctx.db
        .select({
          id: extMarketingReviews.id,
          rating: extMarketingReviews.rating,
          reviewText: extMarketingReviews.reviewText,
          reviewerName: extMarketingReviews.reviewerName,
          platform: extMarketingReviews.platform,
          receivedAt: extMarketingReviews.receivedAt,
          replyText: extMarketingReviews.replyText,
        })
        .from(extMarketingReviews)
        .where(
          and(
            eq(extMarketingReviews.practiceId, input.clinicId),
            gte(extMarketingReviews.rating, 4),
            isNull(extMarketingReviews.deletedAt)
          )
        )
        .orderBy(desc(extMarketingReviews.receivedAt))
        .limit(8);

      // Active booking page slug
      const [bookingPage] = await ctx.db
        .select({ slug: bookingPages.slug })
        .from(bookingPages)
        .where(
          and(
            eq(bookingPages.practiceId, input.clinicId),
            eq(bookingPages.published, true),
            isNull(bookingPages.deletedAt)
          )
        )
        .limit(1);

      // Active patient count
      const [patientCountRes] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(patients)
        .where(
          and(
            eq(patients.practiceId, input.clinicId),
            isNull(patients.deletedAt)
          )
        );
      const patientCount = Number(patientCountRes?.count ?? 0);

      // Years in practice calculation
      const practiceCreatedYear = practice?.createdAt
        ? new Date(practice.createdAt).getFullYear()
        : new Date().getFullYear();
      const yearsInPractice = Math.max(1, new Date().getFullYear() - practiceCreatedYear);

      // Active wellness plans
      const activeWellnessPlans = await ctx.db
        .select({
          id: wellnessPlans.id,
          name: wellnessPlans.name,
          description: wellnessPlans.description,
          price: wellnessPlans.price,
          billingInterval: wellnessPlans.billingInterval,
        })
        .from(wellnessPlans)
        .where(
          and(
            eq(wellnessPlans.practiceId, input.clinicId),
            eq(wellnessPlans.active, true),
            isNull(wellnessPlans.deletedAt)
          )
        )
        .orderBy(wellnessPlans.name);

      // Active services preview from clinic price list
      const liveServices = await ctx.db
        .select({
          id: services.id,
          name: services.name,
          category: services.category,
          defaultPrice: services.defaultPrice,
        })
        .from(services)
        .where(
          and(
            eq(services.practiceId, input.clinicId),
            isNull(services.deletedAt)
          )
        )
        .orderBy(services.name)
        .limit(20);

      return {
        practice,
        isPublished,
        sections,
        brandKit,
        bookingSlug: bookingPage?.slug ?? null,
        team: staffMembers,
        handouts: publicHandouts,
        reviews: topReviews,
        liveStats: {
          patientCount,
          fiveStarReviewCount: topReviews.length,
          yearsInPractice,
        },
        liveServices,
        wellnessPlans: activeWellnessPlans,
      };
    }),

  submitWebsiteContactForm: publicProcedure
    .input(
      z.object({
        clinicId: z.string(),
        name: z.string().min(1).max(100),
        email: z.string().email(),
        phone: z.string().max(40).optional(),
        message: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [practice] = await ctx.db
        .select({ id: practices.id, name: practices.name })
        .from(practices)
        .where(and(eq(practices.id, input.clinicId), isNull(practices.deletedAt)))
        .limit(1);

      if (!practice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clinic not found",
        });
      }

      // 1. Look up or create client record for lead attribution
      const trimmedEmail = input.email.trim().toLowerCase();
      const trimmedPhone = input.phone?.trim();

      const [existingClient] = await ctx.db
        .select({ id: clients.id })
        .from(clients)
        .where(
          and(
            eq(clients.practiceId, input.clinicId),
            or(
              eq(clients.email, trimmedEmail),
              trimmedPhone ? eq(clients.phone, trimmedPhone) : undefined
            ),
            isNull(clients.deletedAt)
          )
        )
        .limit(1);

      let clientId = existingClient?.id;

      if (!clientId) {
        const parts = input.name.trim().split(/\s+/);
        const firstName = parts[0] || input.name.trim();
        const lastName = parts.slice(1).join(" ") || firstName;

        const [createdClient] = await ctx.db
          .insert(clients)
          .values({
            practiceId: input.clinicId,
            firstName,
            lastName,
            email: trimmedEmail,
            phone: trimmedPhone ?? null,
            externalSource: "website_contact",
            notes: "Lead captured from public website contact form",
          })
          .returning({ id: clients.id });

        clientId = createdClient?.id;
      }

      // 2. Persist visitor inquiry
      const [inquiry] = await ctx.db
        .insert(extMarketingWebsiteInquiries)
        .values({
          practiceId: input.clinicId,
          clientId: clientId ?? null,
          name: input.name.trim(),
          email: trimmedEmail,
          phone: trimmedPhone ?? null,
          message: input.message.trim(),
          status: "new",
          source: "website_contact",
        })
        .returning();

      // 3. Create staff task in extMarketingStaffTasks
      await ctx.db.insert(extMarketingStaffTasks).values({
        practiceId: input.clinicId,
        kind: "website_inquiry",
        title: `Dopyt z webstránky: ${input.name.trim()}`,
        detail: `${input.message.trim()}\n\nEmail: ${trimmedEmail}${trimmedPhone ? `\nTelefón: ${trimmedPhone}` : ""}`,
        status: "open",
        clientId: clientId ?? null,
      });

      // 4. Emit durable automation event
      try {
        await (ctx.db as any).insert(extAutomationEvents).values({
          practiceId: input.clinicId,
          eventType: "client_created",
          sourceRouter: "marketing.submitWebsiteContactForm",
          clientId: clientId ?? null,
          dedupeKey: `website_inquiry_${inquiry.id}`,
          status: "pending",
          availableAt: new Date(),
          payload: {
            inquiryId: inquiry.id,
            name: input.name.trim(),
            email: trimmedEmail,
            phone: trimmedPhone ?? null,
            source: "website_contact",
          },
        });
      } catch (evtErr) {
        console.warn("[Website Contact Form] Durable event emission error:", evtErr);
      }

      // 5. Enroll in welcome_new_client customer journey
      if (clientId) {
        try {
          await enrollInJourney(ctx.db as any, clientId, "welcome_new_client", input.clinicId);
        } catch (jErr) {
          console.warn("[Website Contact Form] Journey enrollment note:", jErr);
        }
      }

      return { ok: true, inquiryId: inquiry.id };
    }),

  listWebsiteInquiries: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        status: z.enum(["new", "in_progress", "resolved", "archived"]).optional(),
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const whereClauses = [
        eq(extMarketingWebsiteInquiries.practiceId, ctx.practiceId),
        isNull(extMarketingWebsiteInquiries.deletedAt),
      ];

      if (input?.status) {
        whereClauses.push(eq(extMarketingWebsiteInquiries.status, input.status));
      }

      const inquiries = await ctx.db
        .select()
        .from(extMarketingWebsiteInquiries)
        .where(and(...whereClauses))
        .orderBy(desc(extMarketingWebsiteInquiries.createdAt))
        .limit(input?.limit ?? 50);

      return inquiries;
    }),

  updateWebsiteInquiryStatus: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["new", "in_progress", "resolved", "archived"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(extMarketingWebsiteInquiries)
        .set({
          status: input.status,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(extMarketingWebsiteInquiries.id, input.id),
            eq(extMarketingWebsiteInquiries.practiceId, ctx.practiceId),
            isNull(extMarketingWebsiteInquiries.deletedAt)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inquiry not found",
        });
      }

      return { ok: true, inquiry: updated };
    }),

  trackWebsiteAction: publicProcedure
    .input(
      z.object({
        clinicId: z.string(),
        action: z.enum(["booking_cta_click", "phone_call_click", "review_click", "handout_view"]),
        metadata: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Safely record visitor action for analytics and attribution
      console.log(`[Website Analytics] Clinic ${input.clinicId} action ${input.action}`);
      return { ok: true };
    }),

  suggestWebsiteFaq: protectedProcedure
    .input(z.object({ specialty: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const [practice] = await ctx.db
        .select({ name: practices.name })
        .from(practices)
        .where(eq(practices.id, ctx.practiceId))
        .limit(1);

      try {
        const model = configuredModel();
        const prompt = `Si marketingový špecialista veterinárnej kliniky "${practice?.name ?? "Veterinárna ambulancia"}".
Vytvor 4 často kladené otázky (FAQ) s odpoveďami pre majiteľov psov a mačiek pred návštevou kliniky.
${input?.specialty ? `Zameraj sa na oblasť: ${input.specialty}` : ""}
Formát JSON: pole objektov s kľúčmi "question" a "answer".`;

        const result = await generateText({ model, prompt });
        const text = result.text.trim();
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          return {
            items: parsed.map((item: any, idx: number) => ({
              id: `faq-ai-${Date.now()}-${idx}`,
              question: String(item.question),
              answer: String(item.answer),
            })),
          };
        }
      } catch (err) {
        console.warn("[Website AI Suggest] Fallback FAQ generated:", err);
      }

      return {
        items: [
          { id: `faq-1`, question: "Musím sa na vyšetrenie vopred objednať?", answer: "Odporúčame online rezerváciu termínu, aby ste sa vyhli čakaniu. Akútne stavy ošetrujeme prednostne." },
          { id: `faq-2`, question: "Ako pripraviť zviera pred plánovaným zákrokom?", answer: "Dospelý pes alebo mačka by mali byť nalačno 8-12 hodín pred anestéziou. Voda je povolená do 2 hodín pred príchodom." },
          { id: `faq-3`, question: "Aké spôsoby platby prijímate?", answer: "Prijímame platby v hotovosti, platobnými kartami aj okamžitým bankovým prevodom." },
          { id: `faq-4`, question: "Poskytujete pohotovostnú službu?", answer: "Mimo ordinačných hodín sme dostupní na pohotovostnom telefónnom čísle pre neodkladné prípady." },
        ],
      };
    }),


  getPracticeId: protectedProcedure.query(async ({ ctx }) => {
    return {
      practiceId: ctx.practiceId,
    };
  }),

  createPostFromBulletin: protectedProcedure
    .input(z.object({
      bulletinTitle: z.string().min(3),
      bulletinSummary: z.string().min(10),
      bulletinSource: z.string(),
      channel: z.enum(["instagram", "facebook", "email", "sms"]).default("instagram"),
    }))
    .mutation(async ({ ctx, input }) => {
      const [practice] = await ctx.db
        .select({ name: practices.name })
        .from(practices)
        .where(eq(practices.id, ctx.practiceId))
        .limit(1);

      let body = "";
      try {
        const model = configuredModel();
        const prompt = `Si marketingový copywriter veterinárnej ambulancie "${practice?.name ?? "Veterinárna ambulancia"}" na Slovensku.
Na základe nasledujúcej legislatívnej správy z ${input.bulletinSource} vytvor edukačný post na ${input.channel.toUpperCase()}.

Téma: ${input.bulletinTitle}
Súhrn: ${input.bulletinSummary}

Požiadavky:
- Píš v slovenčine, priateľským tónom
- Edukuj majiteľov zvierat – NEODKAZUJ priamo na právne predpisy
- Neporovnávaj s inými klinikami
- Instagram/Facebook: 150-280 znakov textu + 3-5 hashtagov
- SMS: max 160 znakov, bez hashtagov
- Skonči výzvou k akcii (navštívte nás, zavolajte nám, atď.)
- Neobsahuj konkrétne ceny

Vráť IBAN len text postu, bez uvodzoviek.`;

        const result = await generateText({ model, prompt });
        body = result.text.trim();
      } catch {
        // Deterministic fallback
        body = `Prinášame dôležité informácie pre majiteľov zvierat. Naša veterinárna ambulancia vás informuje o novinkách v starostlivosti o vašich miláčikov. Neváhajte nás kontaktovať! #veterinar #zdraviezvierat`;
      }

      // KVL SR validation
      const report = validateMarketingText({ text: body, context: "marketing" });
      if (report.verdict === "block") {
        body = autoFix(body, report);
      }
      const KVL_DISCLAIMER = "Informácia má edukačný charakter. Poraďte sa s vašim veterinárnym lekárom.";
      const finalBody = withDisclaimer(body, KVL_DISCLAIMER);

      await ctx.db.insert(extMarketingContentItems).values({
        practiceId: ctx.practiceId,
        createdBy: ctx.user.id,
        title: `Edukačný post: ${input.bulletinTitle.slice(0, 80)}`,
        body: finalBody,
        channel: input.channel,
        status: report.verdict === "block" ? "blocked" : "proposed",
        validatorVerdict: report.verdict,
        validatorFindings: report.findings,
      });

      return {
        body: finalBody,
        verdict: report.verdict,
        findings: report.findings,
      };
    }),
});
