import { config } from "dotenv";
config({ path: "../../.env" });
import { db } from "./client";
import { eq } from "drizzle-orm";
import {
  practices,
  locations,
  users,
  clients,
  patients,
  rooms,
  appointmentTypes,
  services,
  products,
  ekasaConfig,
  wellnessPlans,
} from "./schema/index";
import {
  usersData as skUsers,
  clientsData as skClients,
  patientsData as skPatients,
  servicesData as skServices,
  productsData as skProducts,
  apptTypesData as skApptTypes,
  miscTranslations as skMisc,
  wellnessPlansData as skWellnessPlans,
} from "./data/sk/index";

const PASSWORD_HASH =
  "$2a$10$1Ui3ssO.fTXmUiyu4B7n0.EWb/M9fGHlZ5mjCXaq.Xqf1OdXwLs/K"; // password123

async function seedSlovak() {
  console.log("Seeding Slovak clinic data for openvpm_ai...\n");

  // Check if clinic already exists
  const existingPractice = await db.query.practices.findFirst({
    where: eq(practices.name, "Súkromná veterinárna klinika MVDr. Martin Sýkora"),
  });

  let practiceId: string;

  if (existingPractice) {
    practiceId = existingPractice.id;
    await db
      .update(practices)
      .set({
        website: "https://vetsykora.sk",
        timezone: "Europe/Bratislava",
        country: "SK",
        currency: "eur",
        taxRatePercent: "20.00",
        vatNumber: "SK2020293057",
        settings: {
          ...((existingPractice.settings as object) || {}),
          onboardingCompletedAt: new Date().toISOString(),
          onboardingState: {
            jurisdictionCountry: "SK",
            jurisdictionSelectedAt: new Date().toISOString(),
            jurisdictionSource: "settings",
          },
        },
      })
      .where(eq(practices.id, practiceId));
    console.log(`✓ Using and updated existing practice: ${existingPractice.name} (${practiceId})`);
  } else {
    // 1. Practice
    const [practice] = await db
      .insert(practices)
      .values({
        name: "Súkromná veterinárna klinika MVDr. Martin Sýkora",
        address: "Železničná 14, 979 01 Rimavská Sobota",
        phone: "+421 905 123 456",
        email: "ambulancia@vetsykora.sk",
        website: "https://vetsykora.sk",
        timezone: "Europe/Bratislava",
        country: "SK",
        currency: "eur",
        taxRatePercent: "20.00",
        vatNumber: "SK2020293057",
        subscriptionTier: "cloud",
        settings: {
          onboardingCompletedAt: new Date().toISOString(),
          onboardingState: {
            jurisdictionCountry: "SK",
            jurisdictionSelectedAt: new Date().toISOString(),
            jurisdictionSource: "settings",
          },
        },
      })
      .returning();

    practiceId = practice!.id;
    console.log(`✓ Practice created: ${practice!.name} (${practiceId})`);
  }

  // 2. Location
  const existingLocation = await db.query.locations.findFirst({
    where: eq(locations.practiceId, practiceId),
  });

  let locationId: string;
  if (existingLocation) {
    locationId = existingLocation.id;
    console.log(`✓ Location exists: ${existingLocation.name}`);
  } else {
    const [location] = await db
      .insert(locations)
      .values({
        practiceId,
        name: "Hlavná ambulancia Rimavská Sobota",
        address: "Železničná 14, 979 01 Rimavská Sobota",
        phone: "+421 905 123 456",
        isPrimary: true,
      })
      .returning();

    locationId = location!.id;
    console.log(`✓ Location: ${location!.name}`);

    // Rooms
    for (const name of skMisc.rooms) {
      await db.insert(rooms).values({
        practiceId,
        locationId,
        name,
      });
    }
    console.log(`✓ Rooms: ${skMisc.rooms.length} created`);
  }

  // 3. Default e-Kasa Config
  const existingConfig = await db.query.ekasaConfig.findFirst({
    where: eq(ekasaConfig.practiceId, practiceId),
  });

  if (!existingConfig) {
    await db.insert(ekasaConfig).values({
      practiceId,
      dic: "2020293057",
      icDph: "SK2020293057",
      pokladnicaId: "8881234567890",
      pokladnicaType: "CLOUD",
      ekasaApiUrl: "https://ekasa.financnasprava.sk/oto/api",
      offlineModeEnabled: false,
      cashlessEnabled: true,
      isActive: true,
    });
    console.log(`✓ e-Kasa: Default configuration active`);
  }

  // 4. Users
  // Head vet
  const existingVet = await db.query.users.findFirst({
    where: eq(users.email, "martin.sykora@vetsykora.sk"),
  });
  if (!existingVet) {
    await db.insert(users).values({
      practiceId,
      name: "MVDr. Martin Sýkora",
      email: "martin.sykora@vetsykora.sk",
      role: "admin",
      isVeterinarian: true,
      emailVerifiedAt: new Date(),
      passwordHash: PASSWORD_HASH,
      phone: "+421 905 123 456",
      licenseNumber: "KVL-SK-19842",
    });
  }

  for (const u of skUsers) {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, u.email),
    });
    if (!existing) {
      await db.insert(users).values({
        practiceId,
        name: u.name,
        email: u.email,
        role: u.role,
        isVeterinarian: u.isVeterinarian ?? false,
        emailVerifiedAt: new Date(),
        passwordHash: PASSWORD_HASH,
        phone: u.phone,
        licenseNumber: u.licenseNumber,
      });
    }
  }
  console.log(`✓ Slovak clinic staff ready (admin login: martin.sykora@vetsykora.sk / password123)`);

  // 5. Clients & Patients
  const existingClients = await db.query.clients.findMany({
    where: eq(clients.practiceId, practiceId),
  });

  let createdClients = existingClients;
  if (existingClients.length === 0) {
    createdClients = await db
      .insert(clients)
      .values(
        skClients.map((c) => ({
          practiceId,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email ? c.email.replace("@example.com", "@vetsykora-clients.sk") : undefined,
          phone: c.phone,
          address: c.address,
          city: c.city,
          state: "Slovensko",
          zip: c.zip,
        }))
      )
      .returning();

    console.log(`✓ Clients: ${createdClients.length} created`);

    for (let i = 0; i < skPatients.length; i++) {
      const p = skPatients[i]!;
      const client = createdClients[i % createdClients.length]!;
      await db.insert(patients).values({
        practiceId,
        clientId: client.id,
        name: p.name,
        species: p.species,
        breed: p.breed,
        sex: p.sex,
        dob: p.dob,
        color: p.color,
        status: "active",
      });
    }
    console.log(`✓ Patients: ${skPatients.length} created`);
  }

  // 6. Appointment Types
  const existingAppt = await db.query.appointmentTypes.findFirst({
    where: eq(appointmentTypes.practiceId, practiceId),
  });
  if (!existingAppt) {
    for (const at of skApptTypes) {
      await db.insert(appointmentTypes).values({
        practiceId,
        name: at.name,
        durationMinutes: at.durationMinutes,
        color: at.color,
        requiresDoctor: at.requiresDoctor,
        defaultRoomType: at.defaultRoomType,
      });
    }
    console.log(`✓ Appointment types: ${skApptTypes.length} created`);
  }

  // 7. Services & Products
  const existingService = await db.query.services.findFirst({
    where: eq(services.practiceId, practiceId),
  });
  if (!existingService) {
    for (const s of skServices) {
      await db.insert(services).values({
        practiceId,
        name: s.name,
        code: s.code,
        defaultPrice: (s as any).unitPrice ?? (s as any).defaultPrice ?? "25.00",
        category: (s as any).category ?? "General",
      });
    }
    console.log(`✓ Services: ${skServices.length} Slovak veterinary services created`);

    for (const p of skProducts) {
      await db.insert(products).values({
        practiceId,
        name: p.name,
        sku: p.sku,
        unitPrice: p.unitPrice ?? "10.00",
        costPrice: p.costPrice,
        category: (p as any).category ?? "Medication",
      });
    }
    console.log(`✓ Products: ${skProducts.length} medications and diets created`);
  }

  // 8. Wellness Plans
  const existingWp = await db.query.wellnessPlans.findFirst({
    where: eq(wellnessPlans.practiceId, practiceId),
  });
  if (!existingWp) {
    for (const wp of skWellnessPlans) {
      await db.insert(wellnessPlans).values({
        practiceId,
        name: wp.name,
        description: wp.description,
        price: wp.price,
        billingInterval: wp.billingInterval,
      });
    }
    console.log(`✓ Wellness plans: ${skWellnessPlans.length} packages created`);
  }

  console.log("\nSlovak seed completed successfully in openvpm_ai database!");
}

seedSlovak().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
