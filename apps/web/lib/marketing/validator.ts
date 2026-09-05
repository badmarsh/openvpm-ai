// Marketing content validator – openvpm-ai native implementation.
// Deterministic rule engine (SKILL.md §3 Clinical & Safety Gates).
// block = never approvable in UI; warn = approvable with acknowledgement.
// Rules source: Zákon 39/2007 Z. z., Zákon o reklame, Etický kódex KVL SR.

export type ValidatorSeverity = 'warn' | 'block';

export interface ValidatorFinding {
  rule: string;
  severity: ValidatorSeverity;
  message: string;
  excerpt?: string;
}

export interface ValidatorReport {
  verdict: 'pass' | 'warn' | 'block';
  findings: ValidatorFinding[];
  checkedAt: string; // ISO timestamp
}

export type ValidatorContext = 'marketing' | 'review_reply' | 'handout';

// ── Dictionaries (maintained in repo – sources: ŠÚKL/ÚŠKVBL, KVL SR) ──

/** Rx substances / APIs banned in public marketing (SR/EU). */
export const RX_SUBSTANCES = [
  'amoxicil', 'ivermekt', 'meloxicam', 'fenbendazol', 'enrofloxac', 'marbofloxac',
  'cefovecin', 'prednison', 'prednizolon', 'doxycyklin', 'metronidazol', 'fluralaner',
  'sarolaner', 'afoxolaner', 'lotilaner', 'selamectin', 'moxidectin', 'milbemycin',
  'praziquantel', 'kortikoid', 'antibiotik', 'bravecto', 'nexgard', 'simparica',
  'frontline', 'stronghold', 'advocate', 'drontal', 'milbemax',
];

/** Guaranteed treatment outcomes – violates KVL SR ethical code. */
export const GUARANTEE_WORDS = [
  'vyliečime', 'vylieči', '100 %', '100%', 'zaručene', 'garantujeme', 'garancia',
  'istota', 'bez rizika', 'stoprocentne', 'guaranteed', 'cure',
];

/** Comparative denigration – violates advertising law & KVL SR code. */
export const COMPARISON_WORDS = [
  'najlepšia klinika', 'najlepší veterinár', 'lepšie než', 'lepší ako in',
  'na rozdiel od iných', 'najlacnejš', 'best clinic', 'better than',
];

const PRICE_PATTERN = /(^|\s)\d{1,4}([.,]\d{1,2})?\s?(€|eur\b|euro|eura)/i;
const STATS_WITHOUT_SOURCE = /\d{1,3}\s?%/;
const SOURCE_MARK = /zdroj|source:|\(.*\d{4}.*\)/i;

const DIAGNOSIS_PATTERNS = [
  /váš(eho|ej)?\s+(pes|mačka|papagáj|zakrsl|králik|morča|zviera|pacient)\s+(má|trpí|bolí)/i,
  /diagnóz[au]\s+(vášho|vašej)/i,
  /your\s+(dog|cat|pet)\s+(has|suffers)/i,
];

const ADVICE_REPLACEMENT_PATTERNS = [
  /podajte\s+\d/i,
  /dávkujte\s/i,
  /dávku\s+(zvýšte|znížte|vynechajte)/i,
  /nemusíte\s+(ísť|prísť)\s+(k\s+)?veterinár/i,
];

const FEAR_PATTERNS = [
  /zomr(ie|elo|iete|ieť)/i,
  /smrteľn(é|á|ý)\s+nebezpe/i,
  /ak\s+nekona(te|jete)\s+ihneď/i,
];

export interface ValidateInput {
  text: string;
  context: ValidatorContext;
  allowPrice?: boolean;
  allowedClientNames?: string[];
  knownClientNames?: string[];
}

/**
 * Validates marketing text against Slovak veterinary advertising rules.
 * Returns a ValidatorReport with verdict 'pass' | 'warn' | 'block'.
 * 'block' means the content MUST NOT be approvable in the UI.
 */
export function validateMarketingText(input: ValidateInput): ValidatorReport {
  const findings: ValidatorFinding[] = [];
  const { text, context, allowPrice = false, allowedClientNames = [], knownClientNames = [] } = input;
  const lower = text.toLowerCase();

  // BLOCK: Rx substances in marketing context
  if (context === 'marketing') {
    for (const substance of RX_SUBSTANCES) {
      if (lower.includes(substance)) {
        const idx = lower.indexOf(substance);
        findings.push({
          rule: 'rx_substance',
          severity: 'block',
          message: `Obsah obsahuje názov Rx liečiva alebo účinnej látky ("${substance}"). Propagácia Rx prípravkov voči verejnosti je zakázaná (Zákon 139/1998 Z. z., §8).`,
          excerpt: text.slice(Math.max(0, idx - 20), idx + 40),
        });
        break; // report first hit only
      }
    }
  }

  // BLOCK: Guaranteed outcomes
  for (const word of GUARANTEE_WORDS) {
    if (lower.includes(word.toLowerCase())) {
      findings.push({
        rule: 'guarantee',
        severity: 'block',
        message: `Zaručené výsledky liečby sú v rozpore s Etickým kódexom KVL SR. Odstráňte tvrdenie: "${word}".`,
        excerpt: word,
      });
      break;
    }
  }

  // BLOCK: Comparative denigration
  for (const phrase of COMPARISON_WORDS) {
    if (lower.includes(phrase.toLowerCase())) {
      findings.push({
        rule: 'comparison',
        severity: 'block',
        message: `Porovnávanie s inými klinikami je v rozpore so Zákonom o reklame a Etickým kódexom KVL SR.`,
        excerpt: phrase,
      });
      break;
    }
  }

  // BLOCK: Individual animal diagnosis in marketing
  if (context === 'marketing') {
    for (const pattern of DIAGNOSIS_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        findings.push({
          rule: 'diagnosis',
          severity: 'block',
          message: 'Obsah obsahuje diagnostické tvrdenie o konkrétnom zvierati. Marketingový obsah musí byť všeobecný.',
          excerpt: match[0],
        });
        break;
      }
    }
  }

  // BLOCK: Price without approved price list
  if (!allowPrice && PRICE_PATTERN.test(text)) {
    findings.push({
      rule: 'price_without_list',
      severity: 'block',
      message: 'Obsah obsahuje cenu. Cenové tvrdenia v marketingu vyžadujú schválený cenník. Aktivujte možnosť "má schválený cenník" alebo cenu odstráňte.',
    });
  }

  // WARN: Statistics without source
  if (STATS_WITHOUT_SOURCE.test(text) && !SOURCE_MARK.test(text)) {
    findings.push({
      rule: 'stats_without_source',
      severity: 'warn',
      message: 'Obsah obsahuje percentuálne tvrdenie bez uvedeného zdroja. Doplňte citáciu (napr. "zdroj: ŠVPS SR 2024").',
    });
  }

  // WARN: Advice replacing consultation
  for (const pattern of ADVICE_REPLACEMENT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      findings.push({
        rule: 'advice_replacement',
        severity: 'warn',
        message: 'Obsah môže nahrádzať veterinárnu konzultáciu. Uistite কাশী, že text nenabáda na samoliečbu.',
        excerpt: match[0],
      });
      break;
    }
  }

  // WARN: Fear-based marketing
  if (context === 'marketing') {
    for (const pattern of FEAR_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        findings.push({
          rule: 'fear_marketing',
          severity: 'warn',
          message: 'Obsah môže využívať strach ako motivátor. Zvážte empatickejšiu formuláciu.',
          excerpt: match[0],
        });
        break;
      }
    }
  }

  // BLOCK: Client/patient names without explicit consent
  for (const name of knownClientNames) {
    if (name.length >= 3 && lower.includes(name.toLowerCase())) {
      if (!allowedClientNames.some((allowed) => allowed.toLowerCase() === name.toLowerCase())) {
        findings.push({
          rule: 'name_without_consent',
          severity: 'block',
          message: `Obsah obsahuje meno klienta/pacienta "${name}" bez evidovaného súhlasu. Doplňte súhlas alebo meno odstráňte.`,
          excerpt: name,
        });
      }
    }
  }

  const hasBlock = findings.some((f) => f.severity === 'block');
  const hasWarn = findings.some((f) => f.severity === 'warn');
  const verdict = hasBlock ? 'block' : hasWarn ? 'warn' : 'pass';

  return { verdict, findings, checkedAt: new Date().toISOString() };
}
