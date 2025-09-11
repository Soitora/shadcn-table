import { promises as fs } from "fs";
import path from "path";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020";

import { db } from "@/db/index";
import { articles, inventory, type InventoryRow, type NewArticle } from "@/db/schema";
import { inArray } from "drizzle-orm";

interface LagerJson {
  [location: string]: unknown[];
}

async function loadSchema(): Promise<Record<string, unknown>> {
  const schemaPath = path.join(process.cwd(), "src/db/lager.schema.json");
  const raw = await fs.readFile(schemaPath, "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

function createValidator(schema: Record<string, unknown>): ValidateFunction<unknown> {
  const ajv = new Ajv2020({ allErrors: true });
  return ajv.compile(schema as any);
}

function sanitizeData(data: LagerJson): LagerJson {
  const allowedKeys = new Set([
    "MK",
    "Artikelnr",
    "Benämning",
    "Benämning2",
    "Status",
    "ExtraInfo",
    "Lagerplats",
    "Bild",
    "Paket",
    "Fordon",
    "AlternativArt",
  ]);

  const cleaned: LagerJson = {};
  for (const [location, items] of Object.entries(data)) {
    if (!Array.isArray(items)) continue;
    cleaned[location] = items.map((it) => {
      const obj = (it ?? {}) as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of allowedKeys) {
        if (k in obj) out[k] = obj[k];
      }
      return out;
    });
  }
  return cleaned;
}

function splitRows(
  data: LagerJson,
): { articles: NewArticle[]; inventory: InventoryRow[] } {
  const articleMap = new Map<string, NewArticle>();
  const inventoryRows: InventoryRow[] = [];

  for (const [location, items] of Object.entries(data)) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const obj = item as Record<string, unknown>;
      const mk = String(obj.MK ?? "");
      const artikelnr = String(obj.Artikelnr ?? "");
      if (!mk || !artikelnr) {
        console.warn("Skipping item missing required fields", { location });
        continue;
      }

      const a: NewArticle = {
        mk,
        artikelnr,
        benamning: (obj["Benämning"] as string | undefined) ?? undefined,
        benamning2: (obj["Benämning2"] as string | undefined) ?? undefined,
        extrainfo: (obj["ExtraInfo"] as string | undefined) ?? undefined,
        bild: (obj["Bild"] as boolean | undefined) ?? undefined,
        paket: (obj["Paket"] as string[] | undefined) ?? undefined,
        fordon: (obj["Fordon"] as string[] | undefined) ?? undefined,
        alternativart: (obj["AlternativArt"] as
          | Array<{ märkeskod: string; artikelnummer: string }>
          | undefined) ?? undefined,
        data: {
          MK: obj.MK,
          Artikelnr: obj.Artikelnr,
          Benämning: obj["Benämning"],
          Benämning2: obj["Benämning2"],
          ExtraInfo: obj["ExtraInfo"],
          Bild: obj["Bild"],
          Paket: obj["Paket"],
          Fordon: obj["Fordon"],
          AlternativArt: obj["AlternativArt"],
        },
      };

      const key = `${mk}::${artikelnr}`;
      if (!articleMap.has(key)) articleMap.set(key, a);

      const status = (obj["Status"] as string | undefined) ?? undefined;
      const lagerplats = (obj["Lagerplats"] as string | undefined) ?? undefined;

      inventoryRows.push({
        location,
        mk,
        artikelnr,
        status,
        lagerplats,
        locationData: { Status: status, Lagerplats: lagerplats },
      });
    }
  }

  return { articles: Array.from(articleMap.values()), inventory: inventoryRows };
}

async function main() {
  console.log("⏳ Sync inventory from src/db/lager.json → DB");
  const start = Date.now();

  const jsonPath = path.join(process.cwd(), "src/db/lager.json");
  const [schema, jsonRaw] = await Promise.all([
    loadSchema(),
    fs.readFile(jsonPath, "utf8"),
  ]);
  const validate = createValidator(schema);

  const parsed = JSON.parse(jsonRaw) as LagerJson;
  const cleaned = sanitizeData(parsed);
  const ok = validate(cleaned);
  if (!ok) {
    console.error("Schema validation failed", { errors: validate.errors?.slice(0, 10) });
    throw new Error("lager.json does not match lager.schema.json");
  }
  const { articles: articleRows, inventory: inventoryRows } = splitRows(cleaned);

  // Build identity sets
  const desiredArticleKeys = new Set(articleRows.map((a) => `${a.mk}::${a.artikelnr}`));
  const desiredInvKeys = new Set(
    inventoryRows.map((r) => `${r.mk}::${r.artikelnr}::${r.location}`),
  );

  // Delete inventory rows not present anymore
  const existingInv = await db
    .select({ id: inventory.id, mk: inventory.mk, artikelnr: inventory.artikelnr, location: inventory.location })
    .from(inventory);

  const toDeleteInvIds: string[] = [];
  for (const row of existingInv) {
    const key = `${row.mk}::${row.artikelnr}::${row.location}`;
    if (!desiredInvKeys.has(key)) toDeleteInvIds.push(row.id);
  }
  if (toDeleteInvIds.length > 0) {
    const BATCH = 1000;
    for (let i = 0; i < toDeleteInvIds.length; i += BATCH) {
      const batch = toDeleteInvIds.slice(i, i + BATCH);
      await db.delete(inventory).where(inArray(inventory.id, batch));
    }
    console.log(`🗑️ Deleted inventory rows: ${toDeleteInvIds.length}`);
  }

  // Delete articles not present anymore (safe only if no inventory references; we delete inventory first)
  const existingArticles = await db
    .select({ id: articles.id, mk: articles.mk, artikelnr: articles.artikelnr })
    .from(articles);
  const toDeleteArticleIds: string[] = [];
  for (const row of existingArticles) {
    const key = `${row.mk}::${row.artikelnr}`;
    if (!desiredArticleKeys.has(key)) toDeleteArticleIds.push(row.id);
  }
  if (toDeleteArticleIds.length > 0) {
    const BATCH = 1000;
    for (let i = 0; i < toDeleteArticleIds.length; i += BATCH) {
      const batch = toDeleteArticleIds.slice(i, i + BATCH);
      await db.delete(articles).where(inArray(articles.id, batch));
    }
    console.log(`🗑️ Deleted articles: ${toDeleteArticleIds.length}`);
  }

  // Upsert articles
  const ARTICLE_BATCH = 500;
  for (let i = 0; i < articleRows.length; i += ARTICLE_BATCH) {
    const batch = articleRows.slice(i, i + ARTICLE_BATCH);
    await db
      .insert(articles)
      .values(batch)
      .onConflictDoUpdate({
        target: [articles.mk, articles.artikelnr],
        set: {
          benamning: (articles as any).benamning,
          benamning2: (articles as any).benamning2,
          extrainfo: (articles as any).extrainfo,
          bild: (articles as any).bild,
          paket: (articles as any).paket,
          fordon: (articles as any).fordon,
          alternativart: (articles as any).alternativart,
          data: (articles as any).data,
          updatedAt: new Date(),
        },
      });
  }

  // Upsert inventory per location
  const INV_BATCH = 500;
  for (let i = 0; i < inventoryRows.length; i += INV_BATCH) {
    const batch = inventoryRows.slice(i, i + INV_BATCH);
    await db
      .insert(inventory)
      .values(batch)
      .onConflictDoUpdate({
        target: [inventory.mk, inventory.artikelnr, inventory.location],
        set: {
          status: (inventory as any).status,
          lagerplats: (inventory as any).lagerplats,
          locationData: (inventory as any).locationData,
          updatedAt: new Date(),
        },
      });
  }

  const end = Date.now();
  console.log(`✅ Sync completed in ${end - start}ms`);
}

main().catch((err) => {
  console.error("❌ Sync failed");
  console.error(err);
  process.exit(1);
});
