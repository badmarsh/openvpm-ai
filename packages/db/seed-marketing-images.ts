import { config } from "dotenv";
config({ path: "../../.env" });
import { db } from "./client";
import { eq, and } from "drizzle-orm";
import {
  practices,
  users,
  extMarketingMediaAssets,
  extMarketingContentItems,
} from "./schema/index";

const IMAGES = [
  {
    postTitleMatch: "kliešte",
    url: "/marketing/tick-prevention.jpg",
    kind: "photo" as const,
    caption: "Zlatý retriever na jarnej lúke - prevencia kliešťov",
    altText: "Zdravý zlatý retriever behá po zelenej kvitnúcej lúke v slnečný jarný deň.",
    tags: ["kliešte", "prevencia", "pes", "jar", "antiparazitiká"],
  },
  {
    postTitleMatch: "Zápach z papuľky",
    url: "/marketing/dental-hygiene.jpg",
    kind: "photo" as const,
    caption: "Veterinárna kontrola chrupu a zubnej hygieny",
    altText: "Lekárka jemne kontroluje zdravé čisté zuby a ďasná psa na veterinárnej klinike.",
    tags: ["stomatológia", "zuby", "zubný kameň", "prevencia", "pes"],
  },
  {
    postTitleMatch: "Seniorský profil",
    url: "/marketing/senior-pet-care.jpg",
    kind: "photo" as const,
    caption: "Starostlivosť o psa seniora na veterinárnej klinike",
    altText: "Pokojný starší labrador s veterinárkou v príjemnom prostredí kliniky.",
    tags: ["senior", "geriatria", "pes", "prevencia", "kĺby"],
  },
  {
    postTitleMatch: "čipovanie",
    url: "/marketing/pet-microchipping.svg",
    kind: "brand_graphic" as const,
    caption: "Povinné čipovanie zvierat - CRSZ",
    altText: "Grafika k povinnému čipovaniu psov a mačiek podľa legislatívy SR.",
    tags: ["čipovanie", "crsz", "legislatíva", "bezpečie"],
  },
  {
    postTitleMatch: "výživa po kastrácii",
    url: "/marketing/pet-nutrition.svg",
    kind: "brand_graphic" as const,
    caption: "Výživa a kontrola hmotnosti po kastrácii",
    altText: "Grafika o optimalizácii kŕmnej dávky a ochrane kĺbov po kastrácii.",
    tags: ["výživa", "kastrácia", "hmotnosť", "kĺby"],
  },
  {
    postTitleMatch: "cestovanie",
    url: "/marketing/travel-petpass.svg",
    kind: "brand_graphic" as const,
    caption: "Cestovanie so zvieraťom - PetPass a prevencia",
    altText: "Grafika o príprave na dovolenku so psom, PetPass a odčervenie.",
    tags: ["cestovanie", "petpass", "dovolenka", "ockovanie"],
  },
  {
    postTitleMatch: "čokoládou",
    url: "/marketing/toxic-chocolate.svg",
    kind: "brand_graphic" as const,
    caption: "Varovanie: Toxicita čokolády a teobromínu u zvierat",
    altText: "Bezpečnostné varovanie pre majiteľov psov pred jedovatosťou čokolády.",
    tags: ["toxicita", "čokoláda", "prvá pomoc", "pohotovosť"],
  },
];

async function seedMarketingImages() {
  console.log("📸 Priraďujem vygenerované obrázky k príspevkom v marketing/plan...");

  const allPractices = await db.select().from(practices);
  if (allPractices.length === 0) {
    console.error("Žiadna klinika nenájdená!");
    return;
  }

  for (const practice of allPractices) {
    const user = await db.query.users.findFirst({
      where: eq(users.practiceId, practice.id),
    });
    if (!user) continue;

    const allPosts = await db
      .select()
      .from(extMarketingContentItems)
      .where(eq(extMarketingContentItems.practiceId, practice.id));

    if (allPosts.length === 0) continue;

    console.log(`\nKlinika: ${practice.name} (${allPosts.length} príspevkov)`);

  for (const img of IMAGES) {
    const matchingPost = allPosts.find((p) =>
      p.title.toLowerCase().includes(img.postTitleMatch.toLowerCase())
    );

    if (!matchingPost) {
      console.log(`⚠️ Príspevok pre '${img.postTitleMatch}' sa nenašiel.`);
      continue;
    }

    // Check if media asset already exists
    let [asset] = await db
      .select()
      .from(extMarketingMediaAssets)
      .where(
        and(
          eq(extMarketingMediaAssets.practiceId, practice.id),
          eq(extMarketingMediaAssets.url, img.url)
        )
      )
      .limit(1);

    if (!asset) {
      const [newAsset] = await db
        .insert(extMarketingMediaAssets)
        .values({
          practiceId: practice.id,
          uploadedBy: user.id,
          url: img.url,
          kind: img.kind,
          caption: img.caption,
          altText: img.altText,
          subjectsPresent: false,
          tags: img.tags,
        })
        .returning();
      asset = newAsset;
      console.log(`✅ Vytvorené médium: ${img.caption} (${asset.id})`);
    } else {
      console.log(`ℹ️ Médium už existuje: ${img.caption} (${asset.id})`);
    }

    // Link asset to content item
    await db
      .update(extMarketingContentItems)
      .set({ mediaAssetId: asset.id })
      .where(eq(extMarketingContentItems.id, matchingPost.id));

    console.log(`🔗 Priradený obrázok k príspevku: "${matchingPost.title}"`);
    }
  }

  console.log("✨ Všetky relevantné obrázky boli úspešne vygenerované a prepojené s plánom!");
}

seedMarketingImages()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Chyba:", err);
    process.exit(1);
  });
