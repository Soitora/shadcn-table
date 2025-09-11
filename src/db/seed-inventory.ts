import { promises as fs } from "fs";
import path from "path";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020";

import { db } from "@/db/index";
import { articles, inventory, type InventoryRow, type NewArticle } from "@/db/schema";

interface LagerJson {
  [location: string]: unknown[];
}

async function loadSchema(): Promise<Record<string, unknown>> {
  const schemaPath = path.join(process.cwd(), "src/db/lager.schema.json");
  const raw = await fs.readFile(schemaPath, "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

function createRootValidator(schema: Record<string, unknown>): ValidateFunction<unknown> {
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

      // Immutable article fields
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

      // Per-location inventory fields
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

export async function seedInventoryFromFile(relFile = "src/db/lager.json") {
  const filePath = path.isAbsolute(relFile) ? relFile : path.join(process.cwd(), relFile);

  const [schema, jsonRaw] = await Promise.all([loadSchema(), fs.readFile(filePath, "utf8")]);

  const validateRoot = createRootValidator(schema);
  const parsed = JSON.parse(jsonRaw) as LagerJson;
  // Remove any unknown props so schema's additionalProperties: false is satisfied
  const cleaned = sanitizeData(parsed);
  const ok = validateRoot(cleaned);
  if (!ok) {
    console.error("Schema validation failed", { errors: validateRoot.errors?.slice(0, 10) });
    throw new Error("lager.json does not match lager.schema.json");
  }

  const { articles: articleRows, inventory: inventoryRows } = splitRows(cleaned);

  // Clear existing data for a clean seed
  await db.delete(inventory);
  await db.delete(articles);

  // Insert articles in batches
  const ARTICLE_BATCH = 1000;
  for (let i = 0; i < articleRows.length; i += ARTICLE_BATCH) {
    const batch = articleRows.slice(i, i + ARTICLE_BATCH);
    await db.insert(articles).values(batch).onConflictDoNothing();
  }

  // Insert inventory in batches
  const INV_BATCH = 1000;
  for (let i = 0; i < inventoryRows.length; i += INV_BATCH) {
    const batch = inventoryRows.slice(i, i + INV_BATCH);
    await db.insert(inventory).values(batch).onConflictDoNothing();
  }
}
