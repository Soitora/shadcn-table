import { promises as fs } from "fs";
import path from "path";

import { db } from "@/db/index";
import { inventory, type InventoryRow } from "@/db/schema";

interface LagerJson {
    [location: string]: unknown[];
}

function toRows(data: LagerJson): InventoryRow[] {
    const rows: InventoryRow[] = [];
    for (const [location, items] of Object.entries(data)) {
        if (!Array.isArray(items)) continue;
        for (const item of items) {
            rows.push({ location, item: item as Record<string, unknown> });
        }
    }
    return rows;
}

export async function seedInventoryFromFile(relFile = "src/db/lager.json") {
    const filePath = path.isAbsolute(relFile) ? relFile : path.join(process.cwd(), relFile);

    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as LagerJson;

    const rows = toRows(parsed);

    // Clear existing data
    await db.delete(inventory);

    // Batch insert to avoid huge single payloads
    const BATCH_SIZE = 1000;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        await db.insert(inventory).values(batch);
    }
}
