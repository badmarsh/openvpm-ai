import { z } from "zod";
import { generateText } from "ai";
import { createRouter, protectedProcedure, publicProcedure, requireRole } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { configuredModel } from "@/lib/agent/runner";
import { readHostedAiAccess } from "@/lib/billing/ai-access";
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
  patients,
  clients,
  practices,
  wellnessEnrollments,
} from '@openpims/db';
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

async function assertPatientNotDeceased(db: any, patientId: string) {
  const [p] = await db
    .select({ status: patients.status })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  if (p?.status === "deceased") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Sympathy Gate: Blocked for deceased patient.",
    });
  }
}

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
      // AI access gate — consistent with agent runner
      const aiAccess = await readHostedAiAccess(ctx.db, ctx.practiceId);
      if (!aiAccess?.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: aiAccess?.message ?? "AI funkcie nie sú k dispozícii",
        });
      }

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
      } catch (err) {
        console.warn("AI generation fallback to templates:", err);
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
      limit: z.number().min(1).max(100).default(50),
    })
  )
  .query(async ({ ctx, input }) => {
    const conditions = [
      eq(extMarketingContentItems.practiceId, ctx.practiceId),
      isNull(extMarketingContentItems.deletedAt),
    ];
    if (input.status !== 'all') conditions.push(eq(extMarketingContentItems.status, input.status));
    if (input.channel !== 'all') conditions.push(eq(extMarketingContentItems.channel, input.channel));
    return ctx.db
      .select()
      .from(extMarketingContentItems)
      .where(and(...conditions))
      .orderBy(desc(extMarketingContentItems.createdAt))
      .limit(input.limit);
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
      await assertPatientNotDeceased(ctx.db, input.patientId);
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
        await assertPatientNotDeceased(ctx.db, asset.patientId);
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
        await assertPatientNotDeceased(ctx.db, asset.patientId);
      }
    }
    const [updated] = await ctx.db
      .update(extMarketingContentItems)
      .set({ status: 'approved', approvedBy: ctx.user.id, approvedAt: new Date() })
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
    })
  )
  .query(async ({ ctx, input }) => {
    const conditions = [
      eq(extMarketingReviews.practiceId, ctx.practiceId),
      isNull(extMarketingReviews.deletedAt),
    ];
    if (input.unansweredOnly) conditions.push(isNull(extMarketingReviews.replyText));
    return ctx.db
      .select()
      .from(extMarketingReviews)
      .where(and(...conditions))
      .orderBy(desc(extMarketingReviews.receivedAt))
      .limit(input.limit);
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
      await assertPatientNotDeceased(ctx.db, enrollment.patientId);
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
    .input(z.object({ topic: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const brand = await getBrand(ctx.db, ctx.practiceId);
      const monday = mondayOf(new Date());
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
          channel: "facebook",
          status: rep.verdict === "block" ? "blocked" : "proposed",
          scheduledFor: new Date(Date.now() + 24 * 3600_000),
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

  unsubscribeByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const decoded = Buffer.from(input.token, "base64").toString("utf-8");
        const [clientId, practiceId] = decoded.split(":");

        if (!clientId || !practiceId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Neplatný odhlasovací odkaz.",
          });
        }

        // 1. Reset client smsConsent
        await ctx.db
          .update(clients)
          .set({ smsConsent: false })
          .where(and(eq(clients.id, clientId), eq(clients.practiceId, practiceId)));

        // 2. Revoke active marketing_messages consent
        await ctx.db
          .update(extMarketingMediaConsents)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(extMarketingMediaConsents.clientId, clientId),
              eq(extMarketingMediaConsents.practiceId, practiceId),
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
              eq(extMarketingMessageLogs.clientId, clientId),
              eq(extMarketingMessageLogs.practiceId, practiceId),
              eq(extMarketingMessageLogs.status, "queued")
            )
          );

        return { success: true };
      } catch (err: any) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Neplatný token pre odhlásenie.",
        });
      }
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

      return rows.filter(({ asset, consent }) => {
        if (filterConsent === "all") return true;
        const isConsentValid = consent && !consent.revokedAt;
        if (filterConsent === "valid") return isConsentValid;
        if (filterConsent === "missing") return asset.subjectsPresent && !isConsentValid;
        if (filterConsent === "not_required") return !asset.subjectsPresent;
        return true;
      });
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

  getPracticeId: protectedProcedure.query(async ({ ctx }) => {
    return {
      practiceId: ctx.practiceId,
    };
  }),
});
