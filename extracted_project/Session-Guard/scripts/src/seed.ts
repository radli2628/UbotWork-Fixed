import { db, botsTable, plansTable, botSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const SEED_BOT_ID = 1;

async function seedPlans(botId: number) {
  const existing = await db.select().from(plansTable).where(eq(plansTable.botId, botId));
  if (existing.length > 0) {
    console.log(`Plans already seeded for bot ${botId}, skipping.`);
    return;
  }

  const plans = [
    { name: "1 Month", durationMonths: 1, price: "Rp8.000" },
    { name: "2 Months", durationMonths: 2, price: "Rp16.000" },
    { name: "3 Months", durationMonths: 3, price: "Rp24.000" },
    { name: "6 Months", durationMonths: 6, price: "Rp42.000" },
  ];

  await db.insert(plansTable).values(plans.map((p) => ({ ...p, botId })));
  console.log(`Seeded ${plans.length} plans for bot ${botId}.`);
}

async function seedPaymentMethods(botId: number) {
  const [existing] = await db
    .select()
    .from(botSettingsTable)
    .where(eq(botSettingsTable.botId, botId));

  const paymentMethods = [
    { type: "BLU BCA", accountNumber: "003326282628", holderName: "Riz** Ad*****n" },
    { type: "GOPAY", accountNumber: "082287038683", holderName: "Riz** Ad*****n" },
  ];

  if (!existing) {
    await db.insert(botSettingsTable).values({
      botId,
      paymentMethods,
    });
    console.log(`Seeded payment methods for bot ${botId}.`);
  } else if (!existing.paymentMethods || (existing.paymentMethods as unknown[]).length === 0) {
    await db
      .update(botSettingsTable)
      .set({ paymentMethods })
      .where(eq(botSettingsTable.botId, botId));
    console.log(`Updated payment methods for bot ${botId}.`);
  } else {
    console.log(`Payment methods already seeded for bot ${botId}, skipping.`);
  }
}

async function main() {
  const [existingBot] = await db.select().from(botsTable).where(eq(botsTable.id, SEED_BOT_ID));
  if (!existingBot) {
    console.log(`Bot with id=${SEED_BOT_ID} not found. Register a bot first, then re-run the seed.`);
    process.exit(0);
  }

  await seedPlans(SEED_BOT_ID);
  await seedPaymentMethods(SEED_BOT_ID);

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
