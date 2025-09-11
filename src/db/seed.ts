import { seedInventoryFromFile } from "@/db/seed-inventory";

async function runSeed() {
  console.log("⏳ Running seed...");

  const start = Date.now();

  // Seed inventory from src/db/lager.json into JSONB table
  await seedInventoryFromFile("src/db/lager.json");

  const end = Date.now();

  console.log(`✅ Seed completed in ${end - start}ms`);

  process.exit(0);
}

runSeed().catch((err) => {
  console.error("❌ Seed failed");
  console.error(err);
  process.exit(1);
});
