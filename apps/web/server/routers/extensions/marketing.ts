import { z } from "zod";
import { generateText } from "ai";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { configuredModel } from "@/lib/agent/runner";
import { readHostedAiAccess } from "@/lib/billing/ai-access";
import { recordUsage } from "@/lib/billing/usage";
import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import {
  extMarketingContentItems,
  extMarketingMediaAssets,
  extMarketingMediaConsents,
  extMarketingTvSlides,
  extMarketingHandouts,
  extMarketingReviews,
  extMarketingRecallSchedules,
  extMarketingWellnessRedemptions,
} from '@openpims/db';
import { validateMarketingText } from '@/lib/marketing/validator';
import {
  generateAlibabaImage,
  submitAlibabaVideo,
  pollAlibabaVideo,
  checkAlibabaProxyHealth,
  ALIBABA_DEFAULT_IMAGE_MODEL,
  ALIBABA_DEFAULT_VIDEO_MODEL,
} from "@/lib/ai/alibaba-proxy";

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
      allowPrice: z.boolean().default(false),
    })
  )
  .mutation(async ({ ctx, input }) => {
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

listMediaAssets: protectedProcedure
  .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
  .query(async ({ ctx, input }) => {
    return ctx.db
      .select()
      .from(extMarketingMediaAssets)
      .where(
        and(
          eq(extMarketingMediaAssets.practiceId, ctx.practiceId),
          isNull(extMarketingMediaAssets.deletedAt),
        )
      )
      .orderBy(desc(extMarketingMediaAssets.createdAt))
      .limit(input.limit);
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

getPublicHandout: protectedProcedure
  .input(z.object({ slug: z.string() }))
  .query(async ({ ctx, input }) => {
    const [handout] = await ctx.db
      .select()
      .from(extMarketingHandouts)
      .where(
        and(
          eq(extMarketingHandouts.practiceId, ctx.practiceId),
          eq(extMarketingHandouts.slug, input.slug),
          eq(extMarketingHandouts.isPublic, true),
          isNull(extMarketingHandouts.deletedAt),
        )
      )
      .limit(1);
    if (!handout) throw new TRPCError({ code: 'NOT_FOUND' });
    return handout;
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
});
