import type { controlledSubstanceLog, treatmentTemplates } from "../../schema/index";

type CsLogRow = typeof controlledSubstanceLog.$inferInsert;
type TemplateRow = typeof treatmentTemplates.$inferInsert;

const practiceId = "";
const samplePatients: any[] = [{ id: "" }, { id: "" }, { id: "" }, { id: "" }, { id: "" }];
const vetUsers: any[] = [{ id: "" }, { id: "" }, { id: "" }];
const techUsers: any[] = [{ id: "" }, { id: "" }, { id: "" }];
const daysAgo = (n: number) => new Date();

export const usersData = [
  {
    email: "admin@vetsykora.sk",
    name: "Správca kliniky (Manažment)",
    role: "admin" as const,
    isVeterinarian: false,
    licenseNumber: null,
    phone: "+421 905 123 000",
  },
  {
    email: "zuzana.horvathova@vetsykora.sk",
    name: "MVDr. Zuzana Horváthová",
    role: "veterinarian" as const,
    isVeterinarian: true,
    licenseNumber: "KVL-SK-28491",
    phone: "+421 905 867 501",
  },
  {
    email: "marek.kovac@vetsykora.sk",
    name: "MVDr. Marek Kováč",
    role: "veterinarian" as const,
    isVeterinarian: true,
    licenseNumber: "KVL-SK-31057",
    phone: "+421 905 867 502",
  },
  {
    email: "ema.vargova@vetsykora.sk",
    name: "MVDr. Ema Vargová",
    role: "veterinarian" as const,
    isVeterinarian: true,
    licenseNumber: "KVL-SK-34219",
    phone: "+421 905 867 503",
  },
  {
    email: "jan.molnar@vetsykora.sk",
    name: "Ján Molnár",
    role: "technician" as const,
    isVeterinarian: false,
    licenseNumber: "VT-SK-7823",
    phone: "+421 905 867 521",
  },
  {
    email: "alexandra.nagyova@vetsykora.sk",
    name: "Alexandra Nagyová",
    role: "technician" as const,
    isVeterinarian: false,
    licenseNumber: "VT-SK-8104",
    phone: "+421 905 867 522",
  },
  {
    email: "monika.balazova@vetsykora.sk",
    name: "Monika Balážová",
    role: "front_desk" as const,
    isVeterinarian: false,
    licenseNumber: null,
    phone: "+421 905 867 531",
  },
  {
    email: "katarina.rychla@vetsykora.sk",
    name: "Katarína Rychlá",
    role: "front_desk" as const,
    isVeterinarian: false,
    licenseNumber: null,
    phone: "+421 905 867 532",
  },
  {
    email: "veterinar@vetsykora.sk",
    name: "Demo Veterinár (Ordinácia)",
    role: "veterinarian" as const,
    isVeterinarian: true,
    licenseNumber: "KVL-SK-99901",
    phone: "+421 905 123 457",
  },
  {
    email: "sestricka@vetsykora.sk",
    name: "Demo Veterinárna Sestrička (Hospitalizácia)",
    role: "technician" as const,
    isVeterinarian: false,
    licenseNumber: "VT-SK-99902",
    phone: "+421 905 123 458",
  },
  {
    email: "recepcia@vetsykora.sk",
    name: "Demo Recepčná (Príjem & Pokladňa)",
    role: "front_desk" as const,
    isVeterinarian: false,
    licenseNumber: null,
    phone: "+421 905 123 459",
  },
  {
    email: "klient@vetsykora.sk",
    name: "Demo Klient (Jozef Petrík - pes Rex)",
    role: "viewer" as const,
    isVeterinarian: false,
    licenseNumber: null,
    phone: "+421 905 010 001",
  },
];

export const clientsData = [
  { firstName: "Jozef", lastName: "Petrík", address: "Ružinovská 12", city: "Bratislava", state: "SK", zip: "821 01", phone: "+421 905 010 001", email: "jozef.petrik@example.com" },
  { firstName: "Mária", lastName: "Kováčová", address: "Štúrova 45", city: "Bratislava", state: "SK", zip: "811 02", phone: "+421 905 010 002", email: "maria.kovacova@example.com" },
  { firstName: "Róbert", lastName: "Tomek", address: "Hlavná 78", city: "Košice", state: "SK", zip: "040 01", phone: "+421 905 010 003", email: "robert.tomek@example.com" },
  { firstName: "Jana", lastName: "Oravcová", address: "Mlynská 234", city: "Trnava", state: "SK", zip: "917 01", phone: "+421 905 010 004", email: "jana.oravcova@example.com" },
  { firstName: "Michal", lastName: "Rosina", address: "Hlinkova 56", city: "Žilina", state: "SK", zip: "010 01", phone: "+421 905 010 005", email: "michal.rosina@example.com" },
  { firstName: "Zuzana", lastName: "Parková", address: "Obchodná 89", city: "Bratislava", state: "SK", zip: "811 06", phone: "+421 905 010 006", email: "zuzana.parkova@example.com" },
  { firstName: "Dávid", lastName: "Mlynár", address: "SNP 123", city: "Banská Bystrica", state: "SK", zip: "974 01", phone: "+421 905 010 007", email: "david.mlynar@example.com" },
  { firstName: "Linda", lastName: "Hoffmannová", address: "Štefánikova 456", city: "Nitra", state: "SK", zip: "949 01", phone: "+421 905 010 008", email: "linda.hoffmannova@example.com" },
  { firstName: "Viliam", lastName: "Andraščík", address: "Vysokoškolákov 22", city: "Žilina", state: "SK", zip: "010 08", phone: "+421 905 010 009", email: "viliam.andrascik@example.com" },
  { firstName: "Patrícia", lastName: "Liptáková", address: "Levočská 67", city: "Prešov", state: "SK", zip: "080 01", phone: "+421 905 010 010", email: "patricia.liptakova@example.com" },
  { firstName: "Richard", lastName: "Németh", address: "Okružná 301", city: "Trnava", state: "SK", zip: "917 01", phone: "+421 905 010 011", email: "richard.nemeth@example.com" },
  { firstName: "Barbora", lastName: "Šmidová", address: "Kúpeľná 15", city: "Piešťany", state: "SK", zip: "921 01", phone: "+421 905 010 012", email: "barbora.smidova@example.com" },
  { firstName: "Tomáš", lastName: "Višňovský", address: "Partizánska 88", city: "Poprad", state: "SK", zip: "058 01", phone: "+421 905 010 013", email: "tomas.visnovsky@example.com" },
  { firstName: "Alžbeta", lastName: "Martinová", address: "Jilemnického 42", city: "Martin", state: "SK", zip: "036 01", phone: "+421 905 010 014", email: "alzbeta.martinova@example.com" },
  { firstName: "Karol", lastName: "Tkáč", address: "Hronská 19", city: "Zvolen", state: "SK", zip: "960 01", phone: "+421 905 010 015", email: "karol.tkac@example.com" },
  { firstName: "Katarína", lastName: "Dobišová", address: "Družstevná 200", city: "Trenčín", state: "SK", zip: "911 01", phone: "+421 905 010 016", email: "katarina.dobisova@example.com" },
  { firstName: "Daniel", lastName: "Chovan", address: "Bernolákova 77", city: "Nové Zámky", state: "SK", zip: "940 01", phone: "+421 905 010 017", email: "daniel.chovan@example.com" },
  { firstName: "Nataša", lastName: "Lukáčová", address: "Fatranská 33", city: "Žilina", state: "SK", zip: "010 08", phone: "+421 905 010 018", email: "natasa.lukacova@example.com" },
  { firstName: "Jozef", lastName: "Valenta", address: "Jesenského 55", city: "Košice", state: "SK", zip: "040 01", phone: "+421 905 010 019", email: "jozef.valenta@example.com" },
  { firstName: "Margaréta", lastName: "Jankovičová", address: "Karpatská 99", city: "Bratislava", state: "SK", zip: "831 01", phone: "+421 905 010 020", email: "margareta.jankovicova@example.com" },
  { firstName: "Štefan", lastName: "Halás", address: "Dunajská 144", city: "Bratislava", state: "SK", zip: "811 08", phone: "+421 905 010 021", email: "stefan.halas@example.com" },
  { firstName: "Dorota", lastName: "Adamcová", address: "Sládkovičova 28", city: "Banská Bystrica", state: "SK", zip: "974 05", phone: "+421 905 010 022", email: "dorota.adamcova@example.com" },
  { firstName: "Andrej", lastName: "Kráľ", address: "Mierová 61", city: "Bratislava", state: "SK", zip: "821 05", phone: "+421 905 010 023", email: "andrej.kral@example.com" },
  { firstName: "Sandra", lastName: "Vargová", address: "Kukučínova 73", city: "Košice", state: "SK", zip: "040 01", phone: "+421 905 010 024", email: "sandra.vargova@example.com" },
  { firstName: "Kevin", lastName: "Lupták", address: "Saratovská 180", city: "Bratislava", state: "SK", zip: "841 02", phone: "+421 905 010 025", email: "kevin.luptak@example.com" },
];

export const patientsData: {
  clientIdx: number;
  name: string;
  species: "canine" | "feline" | "avian" | "rabbit" | "reptile";
  breed: string;
  sex: "male" | "female" | "male_neutered" | "female_spayed";
  dob: string;
  color: string;
  weightKg: string;
}[] = [
    // Dogs (20)
    { clientIdx: 0, name: "Max", species: "canine", breed: "Zlatý retriever", sex: "male_neutered", dob: "2020-03-15", color: "Zlatá", weightKg: "31.8" },
    { clientIdx: 1, name: "Luna", species: "canine", breed: "Nemecký ovčiak", sex: "female_spayed", dob: "2019-08-22", color: "Čierna s pálením", weightKg: "28.6" },
    { clientIdx: 2, name: "Charlie", species: "canine", breed: "Labradorský retriever", sex: "male_neutered", dob: "2021-01-10", color: "Čokoládová", weightKg: "33.2" },
    { clientIdx: 3, name: "Bella", species: "canine", breed: "Francúzsky buldoček", sex: "female_spayed", dob: "2022-05-18", color: "Plavá", weightKg: "11.3" },
    { clientIdx: 4, name: "Cooper", species: "canine", breed: "Bígľ", sex: "male_neutered", dob: "2020-11-03", color: "Trojfarebná", weightKg: "10.9" },
    { clientIdx: 5, name: "Daisy", species: "canine", breed: "Pudel", sex: "female_spayed", dob: "2018-06-25", color: "Biela", weightKg: "6.8" },
    { clientIdx: 6, name: "Rocky", species: "canine", breed: "Rottweiler", sex: "male", dob: "2021-09-14", color: "Čierna s hnedou", weightKg: "45.4" },
    { clientIdx: 7, name: "Sisi", species: "canine", breed: "Kavalier King Charles Španiel", sex: "female_spayed", dob: "2022-02-28", color: "Blenheim", weightKg: "7.3" },
    { clientIdx: 8, name: "Bruno", species: "canine", breed: "Austrálsky ovčiak", sex: "male_neutered", dob: "2020-07-12", color: "Blue Merle", weightKg: "25.0" },
    { clientIdx: 9, name: "Molly", species: "canine", breed: "Boxer", sex: "female_spayed", dob: "2019-04-05", color: "Pásikavá", weightKg: "27.2" },
    { clientIdx: 10, name: "Blesk", species: "canine", breed: "Bernský salašnícky pes", sex: "male_neutered", dob: "2021-12-01", color: "Trojfarebná", weightKg: "43.5" },
    { clientIdx: 11, name: "Rozka", species: "canine", breed: "Kokeršpaniel", sex: "female_spayed", dob: "2020-10-17", color: "Plavá", weightKg: "12.7" },
    { clientIdx: 12, name: "Neron", species: "canine", breed: "Nemecká doga", sex: "male", dob: "2022-08-09", color: "Modrá", weightKg: "54.4" },
    { clientIdx: 13, name: "Pipa", species: "canine", breed: "Shih-Tzu", sex: "female_spayed", dob: "2019-01-20", color: "Zlatobiela", weightKg: "5.9" },
    { clientIdx: 14, name: "Ben", species: "canine", breed: "Border kólia", sex: "male_neutered", dob: "2021-04-30", color: "Čierno-biela", weightKg: "18.6" },
    { clientIdx: 15, name: "Zoe", species: "canine", breed: "Jazvečík", sex: "female_spayed", dob: "2020-02-14", color: "Červená", weightKg: "5.4" },
    { clientIdx: 16, name: "Hugo", species: "canine", breed: "Malý bradáč", sex: "male_neutered", dob: "2022-11-25", color: "Korenie a soľ", weightKg: "7.7" },
    { clientIdx: 0, name: "Orest", species: "canine", breed: "Kríženec", sex: "male_neutered", dob: "2018-09-08", color: "Hnedá", weightKg: "22.7" },
    { clientIdx: 3, name: "Nelka", species: "canine", breed: "Yorkshirský teriér", sex: "female", dob: "2023-03-12", color: "Modro-hnedá", weightKg: "3.2" },
    { clientIdx: 7, name: "Winston", species: "canine", breed: "Anglický buldog", sex: "male_neutered", dob: "2021-06-15", color: "Bielo-červená", weightKg: "22.0" },
    // Cats (15)
    { clientIdx: 1, name: "Ryško", species: "feline", breed: "Európska krátkosrstá", sex: "male_neutered", dob: "2019-05-10", color: "Oranžová pásikavá", weightKg: "5.0" },
    { clientIdx: 4, name: "Mína", species: "feline", breed: "Siamská mačka", sex: "female_spayed", dob: "2020-12-05", color: "Seal Point", weightKg: "3.9" },
    { clientIdx: 6, name: "Tieň", species: "feline", breed: "Európska dlhosrstá", sex: "male_neutered", dob: "2018-03-18", color: "Čierna", weightKg: "5.9" },
    { clientIdx: 9, name: "Tigrík", species: "feline", breed: "Mainská mývalia mačka", sex: "male", dob: "2021-07-22", color: "Hnedá pásikavá", weightKg: "7.3" },
    { clientIdx: 11, name: "Cleo", species: "feline", breed: "Ruská modrá mačka", sex: "female_spayed", dob: "2020-09-30", color: "Modrá", weightKg: "4.1" },
    { clientIdx: 14, name: "Oliver", species: "feline", breed: "Britská krátkosrstá", sex: "male_neutered", dob: "2022-01-14", color: "Modrá", weightKg: "5.4" },
    { clientIdx: 17, name: "Nala", species: "feline", breed: "Abesínska mačka", sex: "female_spayed", dob: "2021-11-08", color: "Divoko sfarbená", weightKg: "3.6" },
    { clientIdx: 18, name: "Simba", species: "feline", breed: "Perzská mačka", sex: "male_neutered", dob: "2019-06-17", color: "Biela", weightKg: "4.5" },
    { clientIdx: 19, name: "Lily", species: "feline", breed: "Ragdoll", sex: "female_spayed", dob: "2020-04-25", color: "Modrá dvojfarebná", weightKg: "4.8" },
    { clientIdx: 20, name: "Kasper", species: "feline", breed: "Bengálska mačka", sex: "male_neutered", dob: "2022-06-03", color: "Hnedá škvrnitá", weightKg: "5.0" },
    { clientIdx: 21, name: "Mochi", species: "feline", breed: "Škótska klapouchá", sex: "female_spayed", dob: "2021-02-20", color: "Sivá", weightKg: "3.8" },
    { clientIdx: 22, name: "Felix", species: "feline", breed: "Európska krátkosrstá", sex: "male_neutered", dob: "2018-10-11", color: "Čierno-biela", weightKg: "5.7" },
    { clientIdx: 23, name: "Sisi", species: "feline", breed: "Sfinga", sex: "female", dob: "2023-01-05", color: "Ružová", weightKg: "3.4" },
    { clientIdx: 24, name: "Oreo", species: "feline", breed: "Európska krátkosrstá", sex: "male_neutered", dob: "2020-08-15", color: "Čierno-biela", weightKg: "4.9" },
    { clientIdx: 5, name: "Kaliko", species: "feline", breed: "Trojfarebná mačka", sex: "female_spayed", dob: "2019-12-01", color: "Trojfarebná", weightKg: "4.0" },
    // Rabbits (2)
    { clientIdx: 10, name: "Dupko", species: "rabbit", breed: "Holandský baranček", sex: "male_neutered", dob: "2022-04-10", color: "Korytnačinová", weightKg: "1.8" },
    { clientIdx: 16, name: "Ďatelinka", species: "rabbit", breed: "Mini Rex", sex: "female_spayed", dob: "2023-02-14", color: "Castor", weightKg: "1.5" },
    // Birds (2)
    { clientIdx: 13, name: "Kiwi", species: "avian", breed: "Korela chochlatá", sex: "male", dob: "2021-08-05", color: "Sivo-žltá", weightKg: "0.09" },
    { clientIdx: 19, name: "Slnečko", species: "avian", breed: "Aratinga slnečná", sex: "female", dob: "2022-03-20", color: "Žlto-oranžová", weightKg: "0.11" },
    // Reptile (1)
    { clientIdx: 20, name: "Rex", species: "reptile", breed: "Agama bradatá", sex: "male", dob: "2021-05-15", color: "Hnedo-žltá", weightKg: "0.45" },
  ];

export const apptTypesData = [
  { name: "Preventívna prehliadka", durationMinutes: 30, color: "#0d9488", requiresDoctor: 1, defaultRoomType: "exam" as const },
  { name: "Vyšetrenie chorého zvieraťa", durationMinutes: 30, color: "#dc2626", requiresDoctor: 1, defaultRoomType: "exam" as const },
  { name: "Vakcinácia", durationMinutes: 15, color: "#2563eb", requiresDoctor: 1, defaultRoomType: "exam" as const },
  { name: "Chirurgický zákrok", durationMinutes: 60, color: "#7c3aed", requiresDoctor: 1, defaultRoomType: "surgery" as const },
  { name: "Zubné ošetrenie", durationMinutes: 45, color: "#ea580c", requiresDoctor: 1, defaultRoomType: "exam" as const },
  { name: "Kontrola", durationMinutes: 15, color: "#16a34a", requiresDoctor: 1, defaultRoomType: "exam" as const },
];

export const soapTemplates = [
  {
    subjective: "Majiteľ hlási, že pacient normálne žerie a pije. Bez zvracania alebo hnačky. Normálna aktivita. Aktuálna prevencia proti blchám a kliešťom.",
    objective: "T: 38.4C, HR: 80/min, RR: 20. BCS: 5/9. Bdelý, vnímavý. Srsť v dobrom stave. Fyzikálne vyšetrenie bez patologických nálezov. Mierny zubný kameň na stoličkách.",
    assessment: "Zdravý pacient, bežná preventívna prehliadka. Zistený mierny zubný kameň - odporúčané čistenie zubov do 6 mesiacov.",
    plan: "Pokračovať v súčasnej strave a pohybe. Naplánovať čistenie zubov. Očkovanie podľa protokolu. Kontrola o 1 rok alebo podľa potreby.",
  },
  {
    subjective: "Majiteľ udáva zníženú chuť do jedla už 2 dni. Pacient pôsobí letargicky. Bez zvracania, ale bola spozorovaná mäkká stolica. Pije vodu normálne.",
    objective: "T: 39.3C, HR: 110/min, RR: 28. BCS: 4/9. Mierna dehydratácia. Brucho pri palpácii mierne napäté. Hmatateľné masy nezistené. Mierny diskomfort v kraniálnej časti brucha.",
    assessment: "Podozrenie na gastroenteritídu. Diferenciálna diagnóza zahŕňa diétnu chybu, pankreatitídu, cudzie teleso. Odporúčaný krvný obraz a sledovanie.",
    plan: "Odoslaný krvný obraz/biochémia. Bezzvyšková diéta (varené kura s ryžou) na 3-5 dní. Podaná Cerenia 1mg/kg SQ. Kontrola o 48 hodín v prípade nezlepšenia. Pohotovosť v prípade zvracania alebo zhoršenia letargie.",
  },
  {
    subjective: "Každoročné očkovanie. Majiteľ neudáva žiadne problémy. Pacient užíva mesačne Heartgard a NexGard.",
    objective: "T: 38.2C, HR: 90/min, RR: 18. BCS: 6/9. Mierna nadváha. Všetky systémy pri vyšetrení v norme. Srdce a pľúca pri auskultácii bez nálezu.",
    assessment: "Zdravý pacient, mierna nadváha. Dnes zaočkovaný.",
    plan: "Podané vakcíny DHPP a besnota. Odporúčané znížiť dennú dávku krmiva o 10 % a zvýšiť pohyb. Kontrola hmotnosti o 3 mesiace. Ďalšia preventívna prehliadka o rok.",
  },
  {
    subjective: "Pacient privedený pre krívanie na pravú hrudnú končatinu, majiteľ spozoroval po včerajšom hraní v parku. Bez známej traumy. Do rána bez zlepšenia.",
    objective: "T: 38.6C, HR: 95/min, RR: 22. Krívanie pravej hrudnej končatiny 2/5. Bolesť pri flexii pravého lakťa. Mierny opuch mäkkých tkanív na laterálnej strane lakťa. Bez krepitácie. Dobrý rozsah pohybu v ramene a karpe.",
    assessment: "Krívanie pravej hrudnej končatiny, pravdepodobne poranenie mäkkých tkanív v oblasti lakťa. RTG bez nálezu - nezistená zlomenina ani OCD lézia.",
    plan: "Rimadyl 2mg/kg 2x denne na 7 dní s jedlom. Prísny kľud na 2 týždne - len prechádzky na vôdzke. Studený obklad 10 min 3x denne prvé 3 dni. Kontrola o 2 týždne. V prípade nezlepšenia zvážiť odporučenie na pokročilé zobrazovacie vyšetrenie.",
  },
  {
    subjective: "Rutinné čistenie zubov v anestézii. Predoperačné vyšetrenie krvi vykonané minulý týždeň s výsledkami v norme. Hladovka od 22:00 včera v noci.",
    objective: "Predoperačné vitálne funkcie: T: 38.3C, HR: 88/min, RR: 16. ASA trieda I. Ochorenie zubov stupňa 2 s miernym zubným kameňom na premolároch a molároch. Mierna gingivitída. Zhotovené kompletné intraorálne RTG snímky.",
    assessment: "Ochorenie zubov stupňa 2. Stredné hromadenie zubného kameňa. Na RTG snímkach bez abscesu koreňa zuba. Všetky zuby neporušené a vitálne.",
    plan: "Vykonaná kompletná zubná profylaxia v celkovej anestézii (úvod propofolom, udržiavanie izofluránom). Zubný kameň úplne odstránený. Zuby vyleštené. Aplikované ošetrenie fluoridom. Zotavenie bez komplikácií. Prepustenie dnes večer s odporúčaním mäkkej stravy na 3 dni.",
  },
];

export const vaccineData = [
  { name: "DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)", manufacturer: "Zoetis", nextDueMonths: 12 },
  { name: "Rabies (3-year)", manufacturer: "Boehringer Ingelheim", nextDueMonths: 36 },
  { name: "Bordetella", manufacturer: "Zoetis", nextDueMonths: 12 },
  { name: "Lyme (Borrelia burgdorferi)", manufacturer: "Zoetis", nextDueMonths: 12 },
  { name: "Canine Influenza (H3N2/H3N8)", manufacturer: "Zoetis", nextDueMonths: 12 },
  { name: "Leptospirosis", manufacturer: "Nobivac", nextDueMonths: 12 },
  { name: "FVRCP (Feline Viral Rhinotracheitis/Calicivirus/Panleukopenia)", manufacturer: "Boehringer Ingelheim", nextDueMonths: 12 },
  { name: "FeLV (Feline Leukemia)", manufacturer: "Boehringer Ingelheim", nextDueMonths: 12 },
  { name: "Rabies (1-year, feline)", manufacturer: "Boehringer Ingelheim", nextDueMonths: 12 },
];

export const prescriptionData = [
  { medicationName: "Rimadyl (Carprofen)", dosage: "75mg", frequency: "BID with food", quantity: 60, instructions: "Give one tablet by mouth twice daily with food. Monitor for GI upset. Do not use with other NSAIDs or corticosteroids." },
  { medicationName: "Metacam (Meloxicam)", dosage: "0.1mg/kg", frequency: "SID", quantity: 30, instructions: "Administer orally once daily. Use provided syringe for accurate dosing. Give with food." },
  { medicationName: "Clavamox (Amoxicillin/Clavulanate)", dosage: "250mg", frequency: "BID", quantity: 28, instructions: "Give one tablet by mouth twice daily for 14 days. Complete full course of antibiotics even if symptoms improve." },
  { medicationName: "Apoquel (Oclacitinib)", dosage: "16mg", frequency: "BID x14d then SID", quantity: 42, instructions: "Give one tablet twice daily for 14 days, then once daily for maintenance. Monitor for infections." },
  { medicationName: "Gabapentin", dosage: "100mg", frequency: "BID", quantity: 60, instructions: "Give one capsule by mouth twice daily for pain management. May cause sedation initially." },
  { medicationName: "Cerenia (Maropitant)", dosage: "24mg", frequency: "SID x5d", quantity: 5, instructions: "Give one tablet once daily for up to 5 days for nausea/vomiting. Can be given with or without food." },
  { medicationName: "Trazodone", dosage: "50mg", frequency: "BID PRN", quantity: 30, instructions: "Give one tablet by mouth twice daily as needed for anxiety. May cause sedation." },
  { medicationName: "Prednisone", dosage: "10mg", frequency: "SID tapering", quantity: 21, instructions: "Day 1-7: 2 tablets daily. Day 8-14: 1 tablet daily. Day 15-21: 1 tablet every other day. Give with food." },
  { medicationName: "Vetmedin (Pimobendan)", dosage: "2.5mg", frequency: "BID", quantity: 60, instructions: "Give one tablet by mouth twice daily, 1 hour before food. Do not give with food. Essential for cardiac function." },
  { medicationName: "Convenia (Cefovecin)", dosage: "8mg/kg", frequency: "Single injection", quantity: 1, instructions: "Single subcutaneous injection administered in clinic. Provides 14 days of antibiotic coverage." },
  { medicationName: "Metronidazole", dosage: "250mg", frequency: "BID x10d", quantity: 20, instructions: "Give one tablet by mouth twice daily for 10 days. May cause decreased appetite. Complete full course." },
  { medicationName: "Fortiflora (Probiotic)", dosage: "1 sachet", frequency: "SID", quantity: 30, instructions: "Sprinkle one sachet on food once daily. Can be used long-term for GI health." },
];

export const labTestData = [
  { testName: "CBC (Complete Blood Count)", unit: "x10^9/L", low: "5.5", high: "16.9", normalValue: () => (5.5 + Math.random() * 11.4).toFixed(1) },
  { testName: "BUN (Blood Urea Nitrogen)", unit: "mg/dL", low: "7.0", high: "27.0", normalValue: () => (7 + Math.random() * 20).toFixed(1) },
  { testName: "Creatinine", unit: "mg/dL", low: "0.5", high: "1.8", normalValue: () => (0.5 + Math.random() * 1.3).toFixed(2) },
  { testName: "ALT (Alanine Aminotransferase)", unit: "U/L", low: "10.0", high: "125.0", normalValue: () => (10 + Math.random() * 115).toFixed(0) },
  { testName: "Glucose", unit: "mg/dL", low: "74.0", high: "143.0", normalValue: () => (74 + Math.random() * 69).toFixed(0) },
  { testName: "Total Protein", unit: "g/dL", low: "5.2", high: "8.2", normalValue: () => (5.2 + Math.random() * 3).toFixed(1) },
  { testName: "Urinalysis - Specific Gravity", unit: "", low: "1.015", high: "1.045", normalValue: () => (1.015 + Math.random() * 0.03).toFixed(3) },
  { testName: "T4 (Thyroid)", unit: "ug/dL", low: "1.0", high: "4.0", normalValue: () => (1 + Math.random() * 3).toFixed(1) },
  { testName: "Alkaline Phosphatase (ALP)", unit: "U/L", low: "23.0", high: "212.0", normalValue: () => (23 + Math.random() * 189).toFixed(0) },
  { testName: "Albumin", unit: "g/dL", low: "2.3", high: "4.0", normalValue: () => (2.3 + Math.random() * 1.7).toFixed(1) },
];

export const procedureData = [
  { name: "Zubná profylaxia", description: "Kompletné čistenie zubov s odstránením zubného kameňa a leštením v celkovej anestézii", anesthesiaUsed: "Izoflurán + úvod propofolom", durationMinutes: 60 },
  { name: "Odstránenie nádoru", description: "Chirurgické odstránenie podkožného útvaru na pravom boku, odoslané na histopatológiu", anesthesiaUsed: "Izoflurán + lokálny blok lidokaínom", durationMinutes: 45 },
  { name: "Ošetrenie tržnej rany", description: "Toaleta rany a primárne uzavretie 4 cm tržnej rany na ľavej hrudnej končatine", anesthesiaUsed: "Sedácia (Dexdomitor) + lokálny lidokaín", durationMinutes: 30 },
  { name: "Odstránenie cudzieho telesa", description: "Endoskopické odstránenie kusu ponožky zo žalúdka", anesthesiaUsed: "Celková izofluránová anestézia", durationMinutes: 90 },
  { name: "Kastrácia (Ovariohysterektómia)", description: "Rutinná ovariohysterektómia z prístupu v strednej línii", anesthesiaUsed: "Izoflurán + úvod propofolom + meloxikam", durationMinutes: 45 },
  { name: "Kastrácia (Orchiektómia)", description: "Rutinná kastrácia, preskrotálny prístup, uzavretá technika", anesthesiaUsed: "Izoflurán + úvod propofolom", durationMinutes: 25 },
  { name: "Cystotómia", description: "Chirurgické odstránenie močových kameňov pomocou ventrálnej cystotómie", anesthesiaUsed: "Celková izofluránová anestézia + epidurál", durationMinutes: 75 },
];

export const servicesData = [
  { name: "Preventívna prehliadka", code: "EXAM-WE", category: "Vyšetrenie", defaultPrice: "65.00" },
  { name: "Vyšetrenie chorého zvieraťa", code: "EXAM-SV", category: "Vyšetrenie", defaultPrice: "75.00" },
  { name: "Chirurgická konzultácia", code: "EXAM-SC", category: "Vyšetrenie", defaultPrice: "85.00" },
  { name: "Zubná profylaxia", code: "DENT-01", category: "Zubné", defaultPrice: "350.00" },
  { name: "Extrakcia zuba (jednoduchá)", code: "DENT-02", category: "Zubné", defaultPrice: "150.00" },
  { name: "Kastrácia samice (do 22 kg)", code: "SURG-01", category: "Chirurgia", defaultPrice: "400.00" },
  { name: "Kastrácia samca (do 22 kg)", code: "SURG-02", category: "Chirurgia", defaultPrice: "300.00" },
  { name: "Odstránenie nádoru", code: "SURG-03", category: "Chirurgia", defaultPrice: "500.00" },
  { name: "Röntgen (2 projekcie)", code: "DIAG-01", category: "Diagnostika", defaultPrice: "185.00" },
  { name: "Krvný obraz/Biochémia", code: "LAB-01", category: "Laboratórium", defaultPrice: "145.00" },
  { name: "Rozbor moču", code: "LAB-02", category: "Laboratórium", defaultPrice: "55.00" },
  { name: "Koprologické vyšetrenie", code: "LAB-03", category: "Laboratórium", defaultPrice: "35.00" },
  { name: "Vakcína DHPP", code: "VAX-01", category: "Vakcíny", defaultPrice: "28.00" },
  { name: "Vakcína proti besnote", code: "VAX-02", category: "Vakcíny", defaultPrice: "22.00" },
  { name: "Vakcína proti kotercovému kašľu", code: "VAX-03", category: "Vakcíny", defaultPrice: "25.00" },
  { name: "Vakcína FVRCP", code: "VAX-04", category: "Vakcíny", defaultPrice: "28.00" },
  { name: "Vakcína FeLV", code: "VAX-05", category: "Vakcíny", defaultPrice: "30.00" },
  { name: "Strihanie pazúrov", code: "GROO-01", category: "Úprava srsti", defaultPrice: "18.00" },
  { name: "Vytlačenie análnych žliaz", code: "GROO-02", category: "Úprava srsti", defaultPrice: "25.00" },
  { name: "Čipovanie", code: "MISC-01", category: "Rôzne", defaultPrice: "55.00" },
];

export const productsData = [
  // Medications
  { name: "Rimadyl 75mg (60ct)", sku: "MED-001", category: "Lieky", unitPrice: "85.00", costPrice: "42.00", stockQuantity: 45, reorderPoint: 15 },
  { name: "Metacam 1.5mg/mL Oral Suspension (32mL)", sku: "MED-002", category: "Lieky", unitPrice: "65.00", costPrice: "32.00", stockQuantity: 30, reorderPoint: 10 },
  { name: "Clavamox 250mg (28ct)", sku: "MED-003", category: "Lieky", unitPrice: "48.00", costPrice: "22.00", stockQuantity: 50, reorderPoint: 15 },
  { name: "Apoquel 16mg (30ct)", sku: "MED-004", category: "Lieky", unitPrice: "125.00", costPrice: "78.00", stockQuantity: 25, reorderPoint: 10 },
  { name: "Gabapentin 100mg (60ct)", sku: "MED-005", category: "Lieky", unitPrice: "35.00", costPrice: "12.00", stockQuantity: 60, reorderPoint: 20 },
  { name: "Cerenia 24mg (4ct)", sku: "MED-006", category: "Lieky", unitPrice: "95.00", costPrice: "55.00", stockQuantity: 20, reorderPoint: 8 },
  { name: "Trazodone 50mg (30ct)", sku: "MED-007", category: "Lieky", unitPrice: "28.00", costPrice: "10.00", stockQuantity: 40, reorderPoint: 15 },
  { name: "Prednisone 10mg (30ct)", sku: "MED-008", category: "Lieky", unitPrice: "15.00", costPrice: "5.00", stockQuantity: 55, reorderPoint: 20 },
  { name: "Vetmedin 2.5mg (50ct)", sku: "MED-009", category: "Lieky", unitPrice: "145.00", costPrice: "88.00", stockQuantity: 15, reorderPoint: 5 },
  { name: "Metronidazole 250mg (30ct)", sku: "MED-010", category: "Lieky", unitPrice: "22.00", costPrice: "8.00", stockQuantity: 50, reorderPoint: 15 },
  { name: "Doxycycline 100mg (30ct)", sku: "MED-011", category: "Lieky", unitPrice: "32.00", costPrice: "12.00", stockQuantity: 40, reorderPoint: 15 },
  { name: "Enrofloxacin 68mg (50ct)", sku: "MED-012", category: "Lieky", unitPrice: "55.00", costPrice: "28.00", stockQuantity: 30, reorderPoint: 10 },
  { name: "Cephalexin 500mg (100ct)", sku: "MED-013", category: "Lieky", unitPrice: "45.00", costPrice: "18.00", stockQuantity: 35, reorderPoint: 12 },
  { name: "Tramadol 50mg (60ct)", sku: "MED-014", category: "Lieky", unitPrice: "38.00", costPrice: "15.00", stockQuantity: 25, reorderPoint: 10 },
  { name: "Enalapril 5mg (60ct)", sku: "MED-015", category: "Lieky", unitPrice: "25.00", costPrice: "8.00", stockQuantity: 30, reorderPoint: 10 },
  // Preventives
  { name: "Heartgard Plus (26-50 lbs, 6ct)", sku: "PREV-001", category: "Prevencia", unitPrice: "55.00", costPrice: "32.00", stockQuantity: 40, reorderPoint: 15 },
  { name: "NexGard (24.1-60 lbs, 6ct)", sku: "PREV-002", category: "Prevencia", unitPrice: "120.00", costPrice: "72.00", stockQuantity: 35, reorderPoint: 12 },
  { name: "Simparica Trio (22.1-44 lbs, 6ct)", sku: "PREV-003", category: "Prevencia", unitPrice: "135.00", costPrice: "82.00", stockQuantity: 28, reorderPoint: 10 },
  { name: "Revolution Plus (5.6-11 lbs cat, 6ct)", sku: "PREV-004", category: "Prevencia", unitPrice: "125.00", costPrice: "75.00", stockQuantity: 25, reorderPoint: 10 },
  { name: "Bravecto (22-44 lbs, 1ct)", sku: "PREV-005", category: "Prevencia", unitPrice: "58.00", costPrice: "35.00", stockQuantity: 30, reorderPoint: 10 },
  // Supplements
  { name: "Fortiflora Canine (30 sachets)", sku: "SUP-001", category: "Doplnky", unitPrice: "32.00", costPrice: "18.00", stockQuantity: 45, reorderPoint: 15 },
  { name: "Fortiflora Feline (30 sachets)", sku: "SUP-002", category: "Doplnky", unitPrice: "32.00", costPrice: "18.00", stockQuantity: 35, reorderPoint: 12 },
  { name: "Dasuquin Advanced (84ct)", sku: "SUP-003", category: "Doplnky", unitPrice: "65.00", costPrice: "38.00", stockQuantity: 25, reorderPoint: 8 },
  { name: "Welactin Omega-3 (120 softgels)", sku: "SUP-004", category: "Doplnky", unitPrice: "42.00", costPrice: "22.00", stockQuantity: 20, reorderPoint: 8 },
  { name: "Cosequin DS Plus MSM (132ct)", sku: "SUP-005", category: "Doplnky", unitPrice: "55.00", costPrice: "30.00", stockQuantity: 22, reorderPoint: 8 },
  // Food
  { name: "Hill's Science Diet Adult (30 lb)", sku: "FOOD-001", category: "Krmivo", unitPrice: "72.00", costPrice: "45.00", stockQuantity: 15, reorderPoint: 5 },
  { name: "Royal Canin GI Low Fat (17.6 lb)", sku: "FOOD-002", category: "Krmivo", unitPrice: "85.00", costPrice: "52.00", stockQuantity: 12, reorderPoint: 4 },
  { name: "Hill's Prescription Diet k/d (8.5 lb)", sku: "FOOD-003", category: "Krmivo", unitPrice: "48.00", costPrice: "28.00", stockQuantity: 10, reorderPoint: 4 },
  { name: "Royal Canin Urinary SO (17.6 lb)", sku: "FOOD-004", category: "Krmivo", unitPrice: "78.00", costPrice: "48.00", stockQuantity: 8, reorderPoint: 3 },
  { name: "Hill's Science Diet Kitten (7 lb)", sku: "FOOD-005", category: "Krmivo", unitPrice: "32.00", costPrice: "18.00", stockQuantity: 10, reorderPoint: 4 },
  { name: "Purina Pro Plan Sensitive Skin (30 lb)", sku: "FOOD-006", category: "Krmivo", unitPrice: "62.00", costPrice: "38.00", stockQuantity: 12, reorderPoint: 4 },
  { name: "Royal Canin Hydrolyzed Protein (17.6 lb)", sku: "FOOD-007", category: "Krmivo", unitPrice: "92.00", costPrice: "58.00", stockQuantity: 6, reorderPoint: 3 },
  { name: "Hill's i/d Digestive Care (8.5 lb)", sku: "FOOD-008", category: "Krmivo", unitPrice: "45.00", costPrice: "26.00", stockQuantity: 14, reorderPoint: 5 },
  // Supplies
  { name: "Ochranný golier (Stredný)", sku: "SUP-S01", category: "Zdravotnícky materiál", unitPrice: "15.00", costPrice: "5.00", stockQuantity: 30, reorderPoint: 10 },
  { name: "Ochranný golier (Veľký)", sku: "SUP-S02", category: "Zdravotnícky materiál", unitPrice: "18.00", costPrice: "6.00", stockQuantity: 25, reorderPoint: 10 },
  { name: "Pamlsky na tabletky - Kuracie (30ks)", sku: "SUP-S03", category: "Zdravotnícky materiál", unitPrice: "12.00", costPrice: "6.00", stockQuantity: 50, reorderPoint: 15 },
  { name: "Pamlsky na tabletky - Arašidové maslo (30ks)", sku: "SUP-S04", category: "Zdravotnícky materiál", unitPrice: "12.00", costPrice: "6.00", stockQuantity: 45, reorderPoint: 15 },
  { name: "Ohlávka Gentle Leader (Stredná)", sku: "SUP-S05", category: "Zdravotnícky materiál", unitPrice: "22.00", costPrice: "12.00", stockQuantity: 15, reorderPoint: 5 },
  { name: "Mikročip (HomeAgain)", sku: "SUP-S06", category: "Zdravotnícky materiál", unitPrice: "35.00", costPrice: "18.00", stockQuantity: 40, reorderPoint: 15 },
  { name: "Bandáž Vetrap (10 cm x 4.5 m)", sku: "SUP-S07", category: "Zdravotnícky materiál", unitPrice: "4.00", costPrice: "1.50", stockQuantity: 100, reorderPoint: 30 },
  { name: "Lepiaca páska", sku: "SUP-S08", category: "Zdravotnícky materiál", unitPrice: "6.00", costPrice: "2.00", stockQuantity: 80, reorderPoint: 25 },
  { name: "Čistič uší (236 ml)", sku: "SUP-S09", category: "Zdravotnícky materiál", unitPrice: "14.00", costPrice: "7.00", stockQuantity: 35, reorderPoint: 10 },
  { name: "Chlórhexidínový roztok (236 ml)", sku: "SUP-S10", category: "Zdravotnícky materiál", unitPrice: "16.00", costPrice: "8.00", stockQuantity: 30, reorderPoint: 10 },
  { name: "Zubné tyčinky (Veľké, 30ks)", sku: "SUP-S11", category: "Zdravotnícky materiál", unitPrice: "28.00", costPrice: "14.00", stockQuantity: 25, reorderPoint: 8 },
  { name: "Striekačky 3ml (100ks)", sku: "SUP-S12", category: "Zdravotnícky materiál", unitPrice: "18.00", costPrice: "8.00", stockQuantity: 20, reorderPoint: 5 },
  { name: "Vnútrožilový katéter 20G (50ks)", sku: "SUP-S13", category: "Zdravotnícky materiál", unitPrice: "45.00", costPrice: "22.00", stockQuantity: 15, reorderPoint: 5 },
  { name: "Chirurgické rukavice (Stredné, 100ks)", sku: "SUP-S14", category: "Zdravotnícky materiál", unitPrice: "25.00", costPrice: "12.00", stockQuantity: 18, reorderPoint: 5 },
  { name: "Lubrikačný gél (113g)", sku: "SUP-S15", category: "Zdravotnícky materiál", unitPrice: "8.00", costPrice: "3.00", stockQuantity: 20, reorderPoint: 8 },
  { name: "Nádobka na trus (50ks)", sku: "SUP-S16", category: "Zdravotnícky materiál", unitPrice: "15.00", costPrice: "6.00", stockQuantity: 25, reorderPoint: 8 },
  { name: "Kliešte na pazúry (Profesionálne)", sku: "SUP-S17", category: "Zdravotnícky materiál", unitPrice: "18.00", costPrice: "8.00", stockQuantity: 10, reorderPoint: 3 },
];

export const emailSubjects = [
  { subject: "Termín každoročnej preventívnej prehliadky vášho zvieratka", content: "Je čas na každoročnú preventívnu prehliadku. Odpovedzte na tento e-mail alebo zavolajte na kliniku pre dohodnutie termínu." },
  { subject: "Pripomienka preočkovania", content: "Vaše zvieratko by malo byť tento mesiac preočkované vakcínou DHPP. Máme voľné termíny v utorok a štvrtok poobede." },
  { subject: "Re: Doplnenie receptu na Rimadyl", content: "Ďakujeme za žiadosť o recept. Schválili sme dávku na 30 dní — môžete si ju vyzdvihnúť kedykoľvek tento týždeň počas ordinačných hodín." },
  { subject: "Kópia faktúry — nedávna návšteva", content: "V prílohe nájdete podrobnú faktúru z vašej nedávnej návštevy. Dajte nám vedieť, ak máte nejaké otázky." },
];

export const portalMessages = [
  { subject: "Otázka k liekom pre Lunu", content: "Môžem dať Lune Rimadyl s jedlom? Zdá sa, že má po ňom na lačno podráždený žalúdok." },
  { subject: "Zmena utorkového termínu", content: "Dobrý deň — zmenil sa mi pracovný rozvrh. Mohli by sme utorkový termín presunúť na neskôr v týždni?" },
  { subject: "Záznamy o očkovaní pre hotel pre psov", content: "Cez víkend dávame Maxa do psieho hotela. Mohli by ste im poslať jeho očkovací preukaz?" },
];

export const callLogs = [
  { content: "Klient volal ohľadom krívania na ľavú zadnú nohu, ktoré začalo dnes ráno. Odporučené prísť dnes — objednané na 15:00.", direction: "inbound" as const },
  { content: "Volané pre potvrdenie súhlasu so zajtrajším zubným zákrokom. Klient potvrdil príchod o 7:30, hladovka od 22:00.", direction: "outbound" as const },
  { content: "Pooperačná kontrola po telefóne — pacient žerie normálne, stehy sú čisté. Kontrola naplánovaná o 10 dní.", direction: "outbound" as const },
];

export const getCsEntries = (practiceId: string, samplePatients: any[], vetUsers: any[], techUsers: any[], daysAgo: (n: number) => Date): CsLogRow[] => [
  {
    practiceId,
    drugName: "Tramadol HCl 50mg",
    deaSchedule: "IV",
    action: "administered",
    quantity: "2.000",
    unit: "tablet",
    patientId: samplePatients[0]!.id,
    performedBy: vetUsers[0]!.id,
    witnessedBy: techUsers[0]!.id,
    lotNumber: "TR-2026-0318-A",
    notes: "Pooperačná kontrola bolesti, extrakcia zuba",
    performedAt: daysAgo(2),
  },
  {
    practiceId,
    drugName: "Buprenorphine 0.3 mg/mL",
    deaSchedule: "III",
    action: "administered",
    quantity: "0.500",
    unit: "mL",
    patientId: samplePatients[1]!.id,
    performedBy: vetUsers[1]!.id,
    witnessedBy: techUsers[0]!.id,
    lotNumber: "BUP-2026-Q1-7",
    notes: "Predoperačná analgézia",
    performedAt: daysAgo(4),
  },
  {
    practiceId,
    drugName: "Phenobarbital 30mg",
    deaSchedule: "IV",
    action: "administered",
    quantity: "30.000",
    unit: "tablet",
    patientId: samplePatients[2]!.id,
    performedBy: vetUsers[0]!.id,
    witnessedBy: techUsers[1]!.id,
    lotNumber: "PB-2026-0201",
    notes: "Vydané balenie na 30 dní na kontrolu záchvatov",
    performedAt: daysAgo(6),
  },
  {
    practiceId,
    drugName: "Ketamine 100 mg/mL",
    deaSchedule: "III",
    action: "administered",
    quantity: "1.200",
    unit: "mL",
    patientId: samplePatients[3]!.id,
    performedBy: vetUsers[2]!.id,
    witnessedBy: techUsers[0]!.id,
    lotNumber: "KET-2026-0405",
    notes: "Úvod do anestézie pre kastráciu",
    performedAt: daysAgo(1),
  },
  {
    practiceId,
    drugName: "Morphine 15 mg/mL",
    deaSchedule: "II",
    action: "wasted",
    quantity: "0.200",
    unit: "mL",
    patientId: null,
    performedBy: vetUsers[0]!.id,
    witnessedBy: vetUsers[1]!.id,
    lotNumber: "MOR-2026-0112",
    notes: "Likvidácia zvyšku z ampulky po príprave dávky — znehodnotené so svedkom",
    performedAt: daysAgo(3),
  },
  {
    practiceId,
    drugName: "Gabapentin 100mg",
    deaSchedule: "V",
    action: "administered",
    quantity: "60.000",
    unit: "capsule",
    patientId: samplePatients[4]!.id,
    performedBy: vetUsers[1]!.id,
    witnessedBy: techUsers[1]!.id,
    lotNumber: "GAB-2026-0227",
    notes: "Vydané balenie na 30 dní pre manažment chronickej bolesti",
    performedAt: daysAgo(8),
  },
];

export const getTemplatesData = (practiceId: string): Array<TemplateRow & { items: Array<{ description: string; defaultQuantity: number; defaultUnitPrice: string }> }> => [
  {
    practiceId,
    name: "Preventívna prehliadka — Dospelý pes",
    description: "Štandardná každoročná preventívna prehliadka pre dospelých psov. Zahrňuje fyzikálne vyšetrenie, test na srdcové červy a koprológiu.",
    category: "Prevencia",
    isActive: true,
    items: [
      { description: "Fyzikálne vyšetrenie (15 min)", defaultQuantity: 1, defaultUnitPrice: "65.00" },
      { description: "Antigénny test na srdcové červy", defaultQuantity: 1, defaultUnitPrice: "45.00" },
      { description: "Koprologické vyšetrenie (flotácia)", defaultQuantity: 1, defaultUnitPrice: "35.00" },
    ],
  },
  {
    practiceId,
    name: "Šteňa - Preočkovanie DHPP",
    description: "Rutinná návšteva pre šteňatá — preočkovanie DHPP s krátkym vyšetrením.",
    category: "Vakcinácia",
    isActive: true,
    items: [
      { description: "Krátke vyšetrenie (10 min)", defaultQuantity: 1, defaultUnitPrice: "45.00" },
      { description: "DHPP vaccine", defaultQuantity: 1, defaultUnitPrice: "32.00" },
    ],
  },
  {
    practiceId,
    name: "Zubná profylaxia — Štandard",
    description: "Rutinné čistenie zubov v anestézii. Zahrňuje predoperačné vyšetrenie krvi, odstránenie zubného kameňa a leštenie.",
    category: "Zubné",
    isActive: true,
    items: [
      { description: "Predoperačný krvný panel", defaultQuantity: 1, defaultUnitPrice: "95.00" },
      { description: "Celková anestézia (prvých 30 min)", defaultQuantity: 1, defaultUnitPrice: "180.00" },
      { description: "Odstránenie zubného kameňa a leštenie", defaultQuantity: 1, defaultUnitPrice: "220.00" },
      { description: "Intravenózna tekutinová terapia", defaultQuantity: 1, defaultUnitPrice: "55.00" },
    ],
  },
  {
    practiceId,
    name: "Kastrácia fenky — Do 18 kg",
    description: "Rutinná ovariohysterektómia pre malé/stredné fenky. Zahrňuje anestéziu, chirurgický zákrok a lieky od bolesti na 3 dni.",
    category: "Chirurgia",
    isActive: true,
    items: [
      { description: "Predoperačné vyšetrenie a krvný obraz", defaultQuantity: 1, defaultUnitPrice: "135.00" },
      { description: "Kastrácia fenky — do 18 kg", defaultQuantity: 1, defaultUnitPrice: "385.00" },
      { description: "Celková anestézia (60 min)", defaultQuantity: 1, defaultUnitPrice: "220.00" },
      { description: "Lieky od bolesti domov (na 3 dni)", defaultQuantity: 1, defaultUnitPrice: "28.00" },
      { description: "Ochranný golier", defaultQuantity: 1, defaultUnitPrice: "18.00" },
    ],
  },
];


export const miscTranslations = {
  practice: {
    name: "Súkromná veterinárna klinika MVDr. Martin Sýkora",
    address: "Lúčna 15, 821 08 Bratislava",
  },
  location: {
    name: "Hlavná klinika",
    address: "Lúčna 15, 821 08 Bratislava",
  },
  rooms: [
    "Ordinácia 1",
    "Ordinácia 2",
    "Ordinácia 3"
  ],
  allergies: [
    { allergen: "Penicilín", reaction: "Žihľavka, opuch tváre" },
    { allergen: "Kuracie mäso", reaction: "Tráviace ťažkosti, svrbenie" },
    { allergen: "Včelie bodnutie", reaction: "Anafylaxia" },
    { allergen: "Latex", reaction: "Kontaktná dermatitída" }
  ],
  appointment: {
    notes: "Majiteľ nehlási žiadne ťažkosti"
  },
  procedure: {
    notesTemplate: (duration: number) => `Pacient sa dobre zotavil. Pooperačné sledovanie po dobu ${duration} minút. Prepusťený so štandardnými pooperačnými pokynmi.`
  },
  communication: {
    smsReminderTemplate: (firstName: string) => `Dobrý deň ${firstName}, SVK MVDr. Martin Sýkora Vám pripomína zajtrajší termín. Odpovedzte C pre potvrdenie alebo R pre zmenu termínu.`
  }
};

export const wellnessPlansData = [
  {
    name: "Základný Wellness Plán",
    description: "Základná preventívna starostlivosť vrátane ročných prehliadok, povinných očkovaní a koprogramu.",
    price: "29.99",
    billingInterval: "monthly" as const,
  },
  {
    name: "Prémiový Wellness Plán",
    description: "Kompletný preventívny balík vrátane 2x ročne prehliadky, čistenia zubov, odberu krvi a bezpoplatkových kontrol.",
    price: "49.99",
    billingInterval: "monthly" as const,
  },
  {
    name: "Senior Care Plán",
    description: "Špecializovaný balík pre staršie zvieratá: 2x ročne kompletný krvný profil, kĺbová výživa a RTG vyšetrenie.",
    price: "69.99",
    billingInterval: "monthly" as const,
  },
];

export const consentFormsData = [
  {
    slug: "surgical-anesthesia",
    title: "Súhlas s chirurgickým zákrokom a celkovou anestéziou",
    body: "Týmto dávam súhlas veterinárnym lekárom a personálu Susedskej Veterinárnej Kliniky na vykonanie chirurgického zákroku a podanie celkovej anestézie podľa potreby. Rozumiem možným rizikám spojeným s anestéziou a operačným zákrokom.",
    sortOrder: 1,
  },
  {
    slug: "dental-procedure",
    title: "Súhlas so stomatologickým ošetrením a extrakciou",
    body: "Súhlasím so stomatologickým vyšetrením, odstránením zubného kameňa ultrazvukom a prípadnými extrakciami poškodených zubov v celkovej anestézii. Súhlasím s predoperačným vyšetrením krvi.",
    sortOrder: 2,
  },
  {
    slug: "high-risk-procedure",
    title: "Súhlas s vysokorizikovým zákrokom a intenzívnou starostlivosťou",
    body: "Beriem na vedomie, že zdravotný stav môjho zvieraťa predstavuje zvýšené klinické riziko. Dávam súhlas na neodkladné lekárske zásahy, monitorovanie na JIS a potrebné diagnostické úkony.",
    sortOrder: 3,
  },
];

export const fileTemplatesData = [
  { fileName: "Potvrdenie_Ockovanie_Besnota.pdf", mimeType: "application/pdf", fileSizeBytes: 245000, category: "certificate" },
  { fileName: "RTG_Hrudnika_AP_Lateral.jpg", mimeType: "image/jpeg", fileSizeBytes: 2450000, category: "radiology" },
  { fileName: "Krvny_Obraz_CBC_Nalez.pdf", mimeType: "application/pdf", fileSizeBytes: 512000, category: "lab" },
  { fileName: "Podpisany_Suhlas_Operacia.pdf", mimeType: "application/pdf", fileSizeBytes: 180000, category: "consent" },
  { fileName: "USG_Vysetrenie_Brucha.pdf", mimeType: "application/pdf", fileSizeBytes: 1200000, category: "radiology" },
  { fileName: "Ockovaci_Preukaz_Kopia.pdf", mimeType: "application/pdf", fileSizeBytes: 320000, category: "certificate" },
  { fileName: "RTG_Chrupu_Celuste.jpg", mimeType: "image/jpeg", fileSizeBytes: 1850000, category: "radiology" },
  { fileName: "Echokardiografia_Sprava.pdf", mimeType: "application/pdf", fileSizeBytes: 890000, category: "lab" },
  { fileName: "Koprologicke_Vysetrenie_Parasity.pdf", mimeType: "application/pdf", fileSizeBytes: 150000, category: "lab" },
  { fileName: "Histopatologia_Biopsia_Nalez.pdf", mimeType: "application/pdf", fileSizeBytes: 410000, category: "lab" },
];

export const problemListData = [
  { patientIdx: 0, description: "Osteoartritída (Obojstranná dysplázia bedrových kĺbov)", status: "chronic" as const, onsetDaysAgo: 365, resolvedDaysAgo: null },
  { patientIdx: 0, description: "Parodontitída 2. stupňa", status: "active" as const, onsetDaysAgo: 120, resolvedDaysAgo: null },
  { patientIdx: 1, description: "Chronické ochorenie obličiek (IRIS štádium II)", status: "chronic" as const, onsetDaysAgo: 240, resolvedDaysAgo: null },
  { patientIdx: 2, description: "Ochorenie dolných močových ciest mačiek (FLUTD)", status: "resolved" as const, onsetDaysAgo: 180, resolvedDaysAgo: 30 },
  { patientIdx: 3, description: "Atopická dermatitída (Environmentálne alergény)", status: "active" as const, onsetDaysAgo: 90, resolvedDaysAgo: null },
  { patientIdx: 4, description: "Hypotyreóza", status: "chronic" as const, onsetDaysAgo: 300, resolvedDaysAgo: null },
  { patientIdx: 5, description: "Hypertyreóza mačiek", status: "active" as const, onsetDaysAgo: 60, resolvedDaysAgo: null },
];

export const allergyPoolData = [
  { allergen: "Penicilín / Amoxicilín", reaction: "Žihľavka, opuch tváre, akútna dýchacia tieseň", severity: "severe" as const },
  { allergen: "Kuracie mäso", reaction: "Svrbenie, erytematózna koža, chronická hnačka", severity: "moderate" as const },
  { allergen: "Hovädzie mäso", reaction: "Kožné vyrážky, opakovaná otitída", severity: "moderate" as const },
  { allergen: "Blšie sliny (FAD)", reaction: "Silná dermatitída v krížovej oblasti, vypadávanie srsti", severity: "severe" as const },
  { allergen: "Environmentálny peľ", reaction: "Sezónne kýchanie, pododermatitída, slzenie očí", severity: "mild" as const },
  { allergen: "Vakcínový adjuvant", reaction: "Povaočkovacia letargia, lokálny opuch v mieste vpichu", severity: "mild" as const },
  { allergen: "Neomycín topický", reaction: "Lokálna kontaktná precitlivenosť, začervenanie", severity: "moderate" as const },
  { allergen: "Mliečna bielkovina / Laktoóza", reaction: "Zvracanie, kŕče v bruchu, riedka stolica", severity: "mild" as const },
  { allergen: "Skladiskové roztoče (Tyrophagus)", reaction: "Generalizovaná papulózna dermatitída", severity: "moderate" as const },
  { allergen: "Šijací materiál (Chrómový ketgut)", reaction: "Kaskádová tkanivová reakcia, sterilný absces", severity: "severe" as const },
];

export const treatmentPlansData = [
  {
    title: "Plán stomatologického ošetrenia",
    description: "Viacstupňový plán dentálnej hygieny vrátane odstránenia zubného kameňa a pooperačného monitoringu.",
    status: "active" as const,
    templateIdx: 1,
    items: [
      { description: "Predoperačné vyšetrenie a krvný obraz", instructions: "Zhodnoťte funkciu pečene a obličiek pred sedáciou.", status: "done" as const },
      { description: "Celková anestézia (60 min)", instructions: "Priebežne monitorujte tep, SpO2 a krvný tlak.", status: "done" as const },
      { description: "Odstránenie zubného kameňa a leštenie", instructions: "Vykonajte supragingiválne a subgingiválne čistenie.", status: "in_progress" as const },
      { description: "Pooperačný manažment bolesti a prepustenie", instructions: "Podávajte analgetiká podľa pokynov.", status: "pending" as const },
    ],
  },
  {
    title: "Kastrácia a pooperačná starostlivosť",
    description: "Chirurgické zotavenie a pooperačný monitorovací plán pre rutinnú kastráciu fenky.",
    status: "active" as const,
    templateIdx: 2,
    items: [
      { description: "Predoperačné vyšetrenie a krvný obraz", instructions: "Overte vitálne funkcie a výsledky krvi.", status: "done" as const },
      { description: "Kastrácia fenky — do 18 kg", instructions: "Vykonajte rutinnú ovariohysterektómiu.", status: "done" as const },
      { description: "Lieky od bolesti domov (na 3 dni)", instructions: "Vydajte oralnu suspenziu Meloxicam.", status: "done" as const },
      { description: "Nasadzanie ochranného goliera a pokyny", instructions: "Zabezpečte prísny kľudový režim na 10-14 dní.", status: "in_progress" as const },
      { description: "Kontrola stehov po 10-14 dňoch", instructions: "Skontrolujte hojenie operačnej rany.", status: "pending" as const },
    ],
  },
  {
    title: "Manažment seniora a kĺbová starostlivosť",
    description: "Komplexný manažment osteoartritídy a podpory mobility pre staršie psov.",
    status: "active" as const,
    templateIdx: 0,
    items: [
      { description: "Geriatrický krvný profil a rozbor moču", instructions: "Vyscreenujte funkcie obličiek a pečene.", status: "done" as const },
      { description: "Kĺbová výživa a NSAID režim", instructions: "Zaveďte kĺbové doplnky a dennú protizápalovú liečbu.", status: "in_progress" as const },
      { description: "Ortopedická reevaluácia (po 6 mesiacoch)", instructions: "Zhodnoťte chôdzu, bolestivosť kĺbov a zlepšenie mobility.", status: "pending" as const },
    ],
  },
];


// ---------------------------------------------------------------------------
// Phase 2 — locale seed data (Slovak). Moved verbatim from the marketing,
// automations, and canvas routers; practiceId/authorId are appended by each
// seed mutation at the call site. Keep in sync with data/en/index.ts.
// ---------------------------------------------------------------------------

export const marketingTemplatesData = [
  {
    name: "Jarná prevencia: Kliešte a parazity",
    category: "Preventive Care & Wellness",
    description: "Sezónna pripomienka na ochranu pred kliešťami a parazitmi.",
    platforms: ["IG", "FB", "GBP"],
    aspectRatios: ["1:1", "4:5"],
    mediaType: "image",
    promptSkeleton:
      "Vytvor edukačný príspevok o ochrane pred kliešťami a vonkajšími parazitmi. Klinika: {{clinicName}}. Tón: profesionálny, empatický, Fear-Free. Žiadna diagnostika, len prevencia.",
    exampleCaption:
      "🌿 Jar je tu — a s ňou aj sezóna kliešťov! Postarajte sa o ochranu vášho miláčika ešte pred prvou prechádzkou do prírody. Pýtajte sa nás na aktuálne antiparazitiká. #FearFree #Prevencia",
  },
  {
    name: "Fear-Free: Prečo nás navštíviť bez stresu",
    category: "Practice & Team",
    description: "Prezentácia Fear-Free prístupu kliniky.",
    platforms: ["IG", "FB"],
    aspectRatios: ["1:1", "4:5", "16:9"],
    mediaType: "image",
    promptSkeleton:
      "Napíš príspevok vysvetľujúci Fear-Free filozofiu kliniky {{clinicName}}. Zdôrazni upokojujúce prostredie, použitie feroménov, pomalé pohyby a odmeny. Tón: vrúcny, dôveryhodný.",
    exampleCaption:
      "💚 Vieme, že návšteva veterinára môže byť pre vášho miláčika stresujúca. Preto u nás nájdete oddelené čakárne, upokojujúcu hudbu a difuzéry Adaptil/Feliway. Váš štvornohý priateľ si zaslúži pokojnú starostlivosť. #FearFree",
  },
  {
    name: "Wellness Plán: Investícia do zdravia",
    category: "Promotions & Announcements",
    description: "Propagácia mesačných wellness plánov (subscription model).",
    platforms: ["IG", "FB", "GBP"],
    aspectRatios: ["1:1", "4:5"],
    mediaType: "image",
    promptSkeleton:
      "Napíš príspevok propagujúci wellness plán kliniky {{clinicName}}. Zahŕňa: preventívne prehliadky, vakcinácie, zubná kontrola. Mesačný poplatok. Tón: hodnota za peniaze, moderný.",
    exampleCaption:
      "🐾 Wellness Plán — starostlivosť bez prekvapení! Pravidelné prehliadky, vakcinácie a zubná hygiena za fixný mesačný poplatok. Opýtajte sa nás na detaily. Zdravie vášho miláčika je naša priorita. #WellnessPlan",
  },
  {
    name: "Tím ambulancie: Spoznajte nás",
    category: "Practice & Team",
    description: "Predstavenie veterinárneho tímu — personalizácia značky.",
    platforms: ["IG", "FB"],
    aspectRatios: ["1:1", "4:5"],
    mediaType: "image",
    promptSkeleton:
      "Napíš príspevok predstavujúci veterinárny tím kliniky {{clinicName}}. Meno veterinára: {{vetName}}. Tón: vrúcny, osobný, dôveryhodný. Zdôrazni vášeň pre zvieratá.",
    exampleCaption:
      "👨‍⚕️ Dovoľte nám sa predstaviť! Sme tím, ktorý sa každý deň stará o vaše štvornohé rodiny s láskou a odbornosťou. Radi vás privítame! #NášTím #VeterinárnaAmbulancia",
  },
  {
    name: "5-hviezdičková recenzia: Poďakovanie",
    category: "Client & Patient Engagement",
    description: "Zdieľanie pozitívnej recenzie s poďakovaním klientovi.",
    platforms: ["IG", "FB", "GBP"],
    aspectRatios: ["1:1", "4:5"],
    mediaType: "image",
    promptSkeleton:
      "Na základe tejto recenzie klienta: {{reviewText}} — napíš vrúcny post s poďakovaním. Klinika: {{clinicName}}. Nepoužívaj meno pacienta bez súhlasu. Tón: vďačný, komunitný.",
    exampleCaption:
      "💛 Takéto slová nás napĺňajú radosťou! Ďakujeme za vašu dôveru — práve pre vás a vašich miláčikov tu sme každý deň. #Recenzia #Dôvera",
  },
  {
    name: "Sezónna rada: Letná bezpečnosť",
    category: "Educational",
    description: "Edukačný tip na ochranu zvierat v letných mesiacoch.",
    platforms: ["IG", "FB", "GBP"],
    aspectRatios: ["1:1", "4:5"],
    mediaType: "image",
    promptSkeleton:
      "Napíš edukačný príspevok o letnej bezpečnosti zvierat pre kliniku {{clinicName}}: prehriatje v aute, hydratácia, poranenia labiek na horúcom asfalte. ŽIADNA diagnostika. Tón: starostlivý.",
    exampleCaption:
      "☀️ Horúce dni sú tu! Nezabudnite: nikdy nenechávajte zviera v zaparkovanom aute. Pravidelná hydratácia a tienisté miesta sú základ. Pôjdete spolu von? Nezabudnite na vodu! #LetnáBezpečnosť",
  },
];

export const crmAutomationsData = [
  {
    name: "Pripomienka po prepustení (24h)",
    triggerType: "APPOINTMENT_DISCHARGE",
    conditions: { delayDays: 1 },
    actionType: "sms",
    actionPayload: {
      templatePrompt:
        "Napíš priateľskú SMS pacientovi po veterinárnej návšteve. Opýtaj sa, ako sa miláčik cíti, a ponúkni pomoc. Maximálne 160 znakov. Fear-Free tón. SK jazyk.",
    },
    isActive: true,
  },
  {
    name: "Žiadosť o Google recenziu (3 dni po návšteve)",
    triggerType: "REVIEW_REQUEST",
    conditions: { delayDays: 3 },
    actionType: "sms",
    actionPayload: {
      templatePrompt:
        "Napíš krátku SMS žiadajúcu klienta o zanechanie Google recenzie po spokojnej návšteve veterinára. Max 160 znakov. SK jazyk.",
    },
    isActive: true,
  },
  {
    name: "Ročná preventívna prehliadka",
    triggerType: "ANNUAL_REMINDER",
    conditions: { delayDays: 365 },
    actionType: "email",
    actionPayload: {
      templatePrompt:
        "Napíš e-mail pripomínajúci klientovi ročnú preventívnu prehliadku ich miláčika. Vrúcny, Fear-Free tón. SK jazyk.",
    },
    isActive: false,
  },
  {
    name: "Narodeniny pacienta",
    triggerType: "BIRTHDAY",
    conditions: { delayDays: 0 },
    actionType: "sms",
    actionPayload: {
      templatePrompt:
        "Napíš milú narodeninú SMS pre miláčika klienta od veterinárnej kliniky. Zábavná, Fear-Free. Max 160 znakov. SK jazyk.",
    },
    isActive: true,
  },
];

export const canvasMasterDocumentsData = [
  {
    title: "Master Strategický Plán v8.0",
    docType: "STRATEGY",
    status: "published",
    tags: ["Stratégia", "Rast", "Marketing"],
    isRagSource: true,
    content: `<h1>Stratégia rozvoja a operačná modernizácia kliniky v8.0</h1>
<h2>1. Exekutívne Zhrnutie</h2>
<p>Komplexný, dátami podložený strategický plán pre digitálnu transformáciu súkromnej veterinárnej kliniky. Cieľom je vybudovanie silnej lokálnej značky, zavedenie Fear-Free štandardov a implementácia predplatiteľského modelu (Wellness Plány).</p>
<h2>2. Piliere rastu</h2>
<ul>
  <li>Lokálna digitálna dominancia a Google Business Profile optimalizácia</li>
  <li>Sociálne siete a osobná značka lekára (Instagram, Facebook)</li>
  <li>Wellness Plány — predplatiteľský (subscription) model starostlivosti</li>
  <li>Fear-Free prístup — certifikácia a diferenciácia od konkurencie</li>
  <li>OpenVPM — digitálna správa ambulancie end-to-end</li>
</ul>
<h2>3. Transformačná Mapa (Gate 1 → Gate 4)</h2>
<ul>
  <li><strong>Gate 1 (Mesiac 1):</strong> GBP & Web Ready — optimalizovaný Google Business, nová webstránka, fotogaléria</li>
  <li><strong>Gate 2 (Mesiac 3):</strong> AI Scribe Proven — OpenVPM SOAP poznámky, automatické SMS, prvé Reels</li>
  <li><strong>Gate 3 (Mesiac 6):</strong> Wellness Adoption &gt; 3% — minimálne 3% klientov na Wellness Pláne</li>
  <li><strong>Gate 4 (Mesiac 12):</strong> Full OpenVPM Migration — kompletný prechod na digitálnu správu ambulancie</li>
</ul>
<h2>4. Client Acquisition to Retention Flow</h2>
<pre class="mermaid">
graph TD
    A[Sociálne Siete / Lokálne SEO] --> B[Zavolanie / Online Rezervácia]
    B --> C[Fear-Free Návšteva v ambulancii]
    C --> D[Discharge Ask — žiadosť o Google recenziu]
    D --> E[Ponuka Wellness Plánu]
    E --> F[Lojálny dlhodobý klient]
    F --> A
</pre>
<h2>5. KPI Dashboard (ciele na 12 mesiacov)</h2>
<ul>
  <li>Google recenzie: +50 nových, priemerné hodnotenie &gt; 4.8★</li>
  <li>Instagram sledovatelia: +500 organicky</li>
  <li>Wellness Plán enrollment: &gt; 3% aktívnych pacientov</li>
  <li>Priemerná hodnota návštevy: +15% YoY</li>
</ul>`,
  },
  {
    title: "Klinický SOP: Senzorický Fear-Free Protokol",
    docType: "SOP",
    status: "published",
    tags: ["Fear-Free", "SOP", "Personál"],
    isRagSource: false,
    content: `<h1>Klinický SOP: Senzorický Fear-Free Protokol</h1>
<p><strong>Verzia:</strong> 2.0 | <strong>Platnosť:</strong> Všetok personál ambulancie</p>
<p>Základné pravidlá pre minimalizáciu stresu zvierat v prostredí veterinárnej kliniky. Fear-Free prístup je diferenciačný faktor ambulancie — musí byť viditeľný každému klientovi.</p>
<h2>Ranné povinnosti recepcie (pred otvorením)</h2>
<ul class="contains-task-list">
  <li class="task-list-item">[ ] Zapnutie difuzérov <strong>Adaptil</strong> (pre psov) a <strong>Feliway</strong> (pre mačky) v čakárni aj ambulancii — min. 30 minút pred otvorením.</li>
  <li class="task-list-item">[ ] Nastavenie upokojujúcej hudby v čakárni — klasická hudba alebo špeciálne Pet Acoustics playlist. <strong>Žiadne komerčné rádio.</strong></li>
  <li class="task-list-item">[ ] Príprava <strong>vyvýšených odkladacích plôch</strong> pre mačacie prepravky — mačky nesmú byť na podlahe na úrovni psov.</li>
  <li class="task-list-item">[ ] Vizuálne bariéry medzi psíkárnou a mačacou zónou v čakárni (napr. zástena, kartón).</li>
  <li class="task-list-item">[ ] Pripravenie <strong>protišmykových podložiek</strong> na všetky vyšetrovacie stoly.</li>
  <li class="task-list-item">[ ] LickiMat podložky s arašidovým maslom alebo pastou priravené pre odoberanie krvi a vakcinácie.</li>
</ul>
<h2>Princípy Low-Stress manipulácie</h2>
<ul>
  <li><strong>Pomalé pohyby:</strong> Žiadne náhle gestá, hlasné zvuky. Priblíženie sa k zvieraťu vždy z boku, nie spredu.</li>
  <li><strong>Odmeny počas zákrokov:</strong> Arašidové maslo, lízanka, pamlsky — pozitívna asociácia s ambulanciou.</li>
  <li><strong>Minimálna fixácia:</strong> Zviera sa nikdy nesmie brutálne pridržiavať. Ak je zviera príliš stresované, odložiť zákrok.</li>
  <li><strong>Teplé osvetlenie:</strong> Studené LED svetlá v ambulancii nahradiť teplejšími (3000K). Prípadne stlmiť svetlá počas vyšetrenia mačiek.</li>
  <li><strong>Mačky z prepravky:</strong> Nikdy nevyberáme mačku za zvieranie — ponúkneme pamlsok a počkáme, kým vyjde sama, prípadne rozoberieme prepravku.</li>
</ul>
<h2>Komunikácia s klientom</h2>
<p>Personál vždy vysvetlí klientovi, čo sa bude diať a prečo — transparentnosť buduje dôveru. Vyhýbame sa vetám ako <em>"Nebojte sa"</em> (negácia strachu je neúčinná) — namiesto toho: <em>"Urobíme všetko preto, aby bol váš miláčik čo najpohodlnejší."</em></p>`,
  },
  {
    title: "Komunikačný a Krízový Manuál: Google Recenzie",
    docType: "MANUAL",
    status: "published",
    tags: ["Reputácia", "Google", "Krízová komunikácia", "RAG"],
    isRagSource: true,
    content: `<h1>Komunikačný a Krízový Manuál: Google Recenzie</h1>
<p>Zásady odpovedania na online spätnú väzbu a riešenie krízových situácií. <strong>Tento dokument je zdrojom RAG kontextu pre AI asistenta pri navrhovaní odpovedí.</strong></p>
<h2>Základné pravidlá</h2>
<ul>
  <li>Na každú recenziu odpovieme do <strong>48 hodín</strong>.</li>
  <li>Nikdy nie sme agresívni, obraňujúci sa ani sarkastickí.</li>
  <li>Nepoužívame meno pacienta ani diagnózu v odpovedi (GDPR).</li>
  <li>Každá odpoveď je podpísaná menom lekára alebo "Tím ambulancie".</li>
</ul>
<h2>Matica odpovedí podľa typu recenzie</h2>
<table border="1" style="border-collapse: collapse; width: 100%;">
  <thead>
    <tr style="background: #f0f0f0;">
      <th style="padding: 10px; text-align: left;">Typ Recenzie</th>
      <th style="padding: 10px; text-align: left;">Tón Odpovede</th>
      <th style="padding: 10px; text-align: left;">Príklad Odpovede (SK)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 10px;">Sťažnosť na vysokú cenu (1–2★)</td>
      <td style="padding: 10px;">Profesionálny, hranice, transparentnosť, bez ospravedlnenia za kvalitu</td>
      <td style="padding: 10px;"><em>"Dobrý deň, mrzí nás Vaša nespokojnosť. Veterinárna medicína, ak sa má robiť bezpečne a správne, vyžaduje špičkové prístroje, certifikované lieky a kontinuálne vzdelávanie. Detaily Vášho účtu s Vami kedykoľvek radi prejdeme, no znižovať kvalitu starostlivosti o pacienta len preto, aby bol účet nižší, na našej klinike nikdy nebudeme. — Tím ambulancie"</em></td>
    </tr>
    <tr>
      <td style="padding: 10px;">Sťažnosť na čakaciu dobu</td>
      <td style="padding: 10px;">Empatie, vysvetlenie, ponuka riešenia</td>
      <td style="padding: 10px;"><em>"Dobrý deň, ospravedlňujeme sa za čakanie. Každý pacient si u nás zaslúži plnú pozornosť, čo niekedy spôsobí oneskorenie. Pracujeme na zavedení online rezervácií, aby sme minimalizovali Vaše čakanie. Ďakujeme za trpezlivosť. — Tím ambulancie"</em></td>
    </tr>
    <tr>
      <td style="padding: 10px;">Úmrtie pacienta (aj s 5★)</td>
      <td style="padding: 10px;">Extrémna empatia, súcit, žiadna obrana, krátke</td>
      <td style="padding: 10px;"><em>"Vážená rodina, strata zasiahla aj nás. Boli ste skvelí majitelia, ktorí urobili pre svojho miláčika maximum až do úplného konca. Bolo nám cťou sa o neho starať v jeho najťažších chvíľach. Sme s Vami v smútku. — MVDr. Sýkora"</em></td>
    </tr>
    <tr>
      <td style="padding: 10px;">5★ pochvala</td>
      <td style="padding: 10px;">Vďačnosť, osobné, komunitné, pozvanie na ďalšiu návštevu</td>
      <td style="padding: 10px;"><em>"Ďakujeme veľmi pekne za Vaše krásne slová a dôveru! Takáto spätná väzba nás napĺňa radosťou a motivuje nás každý deň robiť svoju prácu s láskou. Tešíme sa na Vašu ďalšiu návštevu! 🐾 — Tím ambulancie"</em></td>
    </tr>
    <tr>
      <td style="padding: 10px;">Falošná / zámerná negatívna recenzia</td>
      <td style="padding: 10px;">Pokojný, faktický, bez emotívnosti, nahlásenie Googlu</td>
      <td style="padding: 10px;"><em>"Dobrý deň, v našom systéme nenachádzame žiadnu návštevu spojenú s Vaším menom. Ak máte konkrétny podnet, prosíme kontaktujte nás priamo na [email]. Recenziu sme nahlásili Googlu na preverenie. — Tím ambulancie"</em></td>
    </tr>
  </tbody>
</table>`,
  },
  {
    title: "SOP: Obsluha a Export pre Edukačnú TV",
    docType: "SOP",
    status: "published",
    tags: ["TV", "Marketing", "Technika", "SOP"],
    isRagSource: false,
    content: `<h1>SOP: Obsluha a Export pre Edukačnú TV v čakárni</h1>
<p><strong>Zodpovednosť:</strong> Recepcia | <strong>Frekvencia aktualizácie:</strong> Mesačne</p>
<h2>Technický Setup</h2>
<ul>
  <li><strong>Hardvér:</strong> TV s voľným HDMI vstupom + Android TV Stick (Chromecast s Google TV, Raspberry Pi 4, alebo Xiaomi Mi TV Stick 4K).</li>
  <li><strong>Softvér:</strong> <a href="https://yodeck.com" target="_blank">Yodeck</a> (odporúčané) alebo Screenly pre správu digitálneho obsahu na TV. Alternatíva: jednoduchý video prehrávač v loope cez USB kľúč.</li>
  <li><strong>Obsah:</strong> Vytváraný v Canva (šablóny 1920×1080px / 16:9) alebo priamo v module <strong>Marketing &amp; Rast</strong> v OpenVPM.</li>
</ul>
<h2>Proces exportu z Marketingového Plánovača (OpenVPM)</h2>
<ol>
  <li>Otvorte modul <strong>Marketingové Štúdio</strong> v OpenVPM.</li>
  <li>Prejdite na sekciu <em>Šablóny</em> a vyfiltrujte kategóriu <strong>"TV Slides (16:9)"</strong>.</li>
  <li>Vyberte aktuálny sezónny slide a upravte text. <br><strong>Pravidlo:</strong> Maximálne <strong>15 slov</strong> na jeden slide. Text musí byť čitateľný z 3 metrov (min. veľkosť 60pt).</li>
  <li>Kliknite <em>Exportovať</em> → vyberte formát <strong>MP4 (1080p, 10s loop)</strong> alebo <strong>PNG (sada obrázkov)</strong>.</li>
  <li>Nahrajte súbor priamo do <a href="https://app.yodeck.com" target="_blank">Yodeck administrácie</a> alebo do zdieľanej Google Drive zložky TV.</li>
</ol>
<h2>Sezónny kalendár obsahu</h2>
<ul>
  <li><strong>Január–Február:</strong> Zubná hygiena (Pet Dental Health Month), zimná starostlivosť</li>
  <li><strong>Marec–Máj:</strong> Ochrana pred kliešťami a parazitmi, jar</li>
  <li><strong>Jún–August:</strong> Letná bezpečnosť, prehriatje, hydratácia</li>
  <li><strong>September–November:</strong> Jesenná prevencia, príprava na zimu</li>
  <li><strong>December:</strong> Stres a pyrotechnika, straty v prírode, Vianoce a čokoláda (toxicita)</li>
</ul>`,
  },
  {
    title: "Klientske Persony (Slovak & Hungarian demographics)",
    docType: "STRATEGY",
    status: "published",
    tags: ["Marketing", "Persony", "AI kontext", "RAG"],
    isRagSource: true,
    content: `<h1>Klientske Persony (Región Juh — Rimavská Sobota a okolie)</h1>
<p>Detailný rozbor cieľových skupín pre presné cielenie komunikačného tónu AI generátora a marketingových kampaní. Tieto persony slúžia ako <strong>RAG kontext pre AI</strong> pri generovaní obsahu.</p>
<h2>Persona 1: Lokálny Senior — "János / Mária"</h2>
<ul>
  <li><strong>Vek:</strong> 60+ rokov</li>
  <li><strong>Jazyk:</strong> Prevažne maďarsky hovoriaci obyvatelia regiónu</li>
  <li><strong>Správanie:</strong> Extrémne cenovo senzitívny segment, no nesmierne lojálny po získaní dôvery. Vyžaduje vysokú mieru osobnej dôvery a priamu autoritu lekára. Neuznáva digitálnu komunikáciu ako primárnu.</li>
  <li><strong>Motivátory:</strong> Dôvera k lekárovi osobne, odporúčanie od susedov/priateľov, stabilita a tradícia</li>
  <li><strong>Komunikácia:</strong> Preferuje osobný kontakt, telefonické rozhovory a papierové letáky v čakárni. <strong>Kľúčové: bilingválna (SK/HU) komunikácia</strong> na recepcii a základných materiáloch. Reaguje na konzervatívny, rešpektujúci a trpezlivý tón.</li>
  <li><strong>Bariéry:</strong> Cena, nedôvera k novým procedúram, jazyková bariéra (slovenčina)</li>
</ul>
<h2>Persona 2: Mladá Rodina / Mileniál — "Tomáš a Lucia"</h2>
<ul>
  <li><strong>Vek:</strong> 25–40 rokov</li>
  <li><strong>Jazyk:</strong> Slovensky hovoriaci alebo bilingválni (SK/HU)</li>
  <li><strong>Správanie:</strong> Vnímajú psa alebo mačku ako plnohodnotného "chlpatého" člena rodiny. Ochotní investovať nadštandardné prostriedky do prevencie, diagnostiky a prémiových služieb. Oceňujú transparentnosť a digitálny prístup.</li>
  <li><strong>Motivátory:</strong> Welfare zvieraťa, Fear-Free prístup, moderná klinika, online pohodlie, prevencia nad liečbou</li>
  <li><strong>Komunikácia:</strong> Digital-first — online rezervácie, SMS pripomienky, atraktívny Instagram (Reels, Stories), edukatívny obsah, recenzie na Google. Hlavná cieľová skupina pre <strong>Wellness Plány</strong>.</li>
  <li><strong>Bariéry:</strong> Vzdialenosť (preferujú kliniku v meste), cena bez vnímania hodnoty</li>
</ul>
<h2>Jazykové pokyny pre AI generátor</h2>
<ul>
  <li><strong>Persona 1 (HU):</strong> Formálny, rešpektujúci tón. Vyhýbať sa slangu. Kratšie vety. Oslovovať "Önök" (Vy). Príklady z tradičného života.</li>
  <li><strong>Persona 2 (SK):</strong> Moderný, vrúcny tón. Môže byť emocionálny. Emojis sú vhodné na sociálnych sieťach. Tykanie v neformálnych kontextoch.</li>
</ul>`,
  },
];

export { websiteTemplatesData } from "./website-templates";
