import { unstable_cache } from "@/lib/unstable-cache";
import { promises as fs } from "node:fs";
import path from "node:path";

// Inventory queries from JSON
export interface GetInventorySchema {
  page: number;
  perPage: number;
  sort: Array<{ id: "createdAt" | "mk" | "artikelnr" | "location" | "status" | "benamning" | "lagerplats"; desc: boolean }>;
  filterFlag?: "advancedFilters" | "commandFilters" | "simple";
  // simple filters
  q?: string; // matches artikelnr, benamning, benamning2
  status?: string[];
  location?: string[];
  mk?: string[];
  // advanced/command filters
  filters?: Array<{
    id: string;
    value: unknown;
    variant?: string;
    operator?: string;
  }>;
  joinOperator?: "and" | "or";
}

interface RawAlternativArt { "märkeskod": string; "artikelnummer": string }
interface RawInventoryItem {
  MK: string;
  Artikelnr: string;
  Status?: string | null;
  Lagerplats?: string | null;
  Bild?: boolean | null;
  Paket?: string[] | null;
  Fordon?: string[] | null;
  AlternativArt?: RawAlternativArt[] | null;
  // Names & extra info
  Benämning?: string | null;
  Benämning2?: string | null;
  ExtraInfo?: string | null;
  // Optional misc keys we keep in articleData
  [key: string]: unknown;
}

interface InventoryRowUIShape {
  id: string;
  mk: string;
  artikelnr: string;
  benamning: string | null;
  benamning2: string | null;
  location: string;
  status: string | null;
  lagerplats: string | null;
  extrainfo: string | null;
  bild: boolean | null;
  paket: string[] | null;
  fordon: string[] | null;
  alternativart: Array<{ märkeskod: string; artikelnummer: string }> | null;
  articleData?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date | null;
}

async function readLager(): Promise<unknown> {
  const filePath = path.join(process.cwd(), "public", "db", "lager.json");
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

function mapToRows(json: unknown): InventoryRowUIShape[] {
  const rows: InventoryRowUIShape[] = [];
  if (Array.isArray(json)) {
    for (const itRaw of json as RawInventoryItem[]) {
      const it = itRaw ?? ({} as RawInventoryItem);
      const location = "";
      const id = `${it.MK ?? ""}:${it.Artikelnr ?? ""}:${location}`;
      rows.push({
        id,
        mk: it.MK ?? "",
        artikelnr: it.Artikelnr ?? "",
        benamning: (it["Benämning"] as string | undefined) ?? null,
        benamning2: (it["Benämning2"] as string | undefined) ?? null,
        extrainfo: (it["ExtraInfo"] as string | undefined) ?? null,
        status: (it["Status"] as string | undefined) ?? null,
        lagerplats: (it["Lagerplats"] as string | undefined) ?? null,
        bild: (it["Bild"] as boolean | undefined) ?? null,
        paket: (it["Paket"] as string[] | undefined) ?? null,
        fordon: (it["Fordon"] as string[] | undefined) ?? null,
        alternativart: (it["AlternativArt"] as RawAlternativArt[] | undefined) ?? null,
        articleData: { ...it },
        location,
        createdAt: new Date(0),
        updatedAt: null,
      });
    }
  } else if (json && typeof json === "object") {
    for (const [location, items] of Object.entries(json as Record<string, RawInventoryItem[]>)) {
      if (!Array.isArray(items)) continue;
      for (const it of items) {
        const id = `${it.MK ?? ""}:${it.Artikelnr ?? ""}:${location}`;
        rows.push({
          id,
          mk: it.MK ?? "",
          artikelnr: it.Artikelnr ?? "",
          benamning: (it["Benämning"] as string | undefined) ?? null,
          benamning2: (it["Benämning2"] as string | undefined) ?? null,
          extrainfo: (it["ExtraInfo"] as string | undefined) ?? null,
          status: (it["Status"] as string | undefined) ?? null,
          lagerplats: (it["Lagerplats"] as string | undefined) ?? null,
          bild: (it["Bild"] as boolean | undefined) ?? null,
          paket: (it["Paket"] as string[] | undefined) ?? null,
          fordon: (it["Fordon"] as string[] | undefined) ?? null,
          alternativart: (it["AlternativArt"] as RawAlternativArt[] | undefined) ?? null,
          articleData: { ...it },
          location,
          createdAt: new Date(0),
          updatedAt: null,
        });
      }
    }
  }
  return rows;
}

function applyFilters(rows: InventoryRowUIShape[], input: GetInventorySchema): InventoryRowUIShape[] {
  const q = (input.q ?? "").trim().toLowerCase();
  const hasQ = q.length > 0;
  const statusSet = new Set(input.status ?? []);
  const locationSet = new Set(input.location ?? []);
  const mkSet = new Set(input.mk ?? []);

  let out = rows.filter((r) => {
    if (hasQ) {
      const inArt = r.artikelnr.toLowerCase().includes(q);
      const inName = (r.benamning ?? "").toLowerCase().includes(q);
      const inName2 = (r.benamning2 ?? "").toLowerCase().includes(q);
      if (!(inArt || inName || inName2)) return false;
    }
    if (statusSet.size > 0 && (!r.status || !statusSet.has(r.status))) return false;
    if (locationSet.size > 0 && !locationSet.has(r.location)) return false;
    if (mkSet.size > 0 && !mkSet.has(r.mk)) return false;
    return true;
  });

  // Advanced/command filters (limited support for mk/location/status)
  if ((input.filterFlag === "advancedFilters" || input.filterFlag === "commandFilters") && input.filters?.length) {
    const joinOr = input.joinOperator === "or";
    const preds = input.filters
      .map((f) => {
        const values = Array.isArray(f.value) ? (f.value as string[]) : [String(f.value ?? "")].filter(Boolean);
        if (values.length === 0) return null;
        switch (f.id) {
          case "mk":
            return (r: InventoryRowUIShape) => values.includes(r.mk);
          case "location":
            return (r: InventoryRowUIShape) => values.includes(r.location);
          case "status":
            return (r: InventoryRowUIShape) => !!r.status && values.includes(r.status);
          default:
            return null;
        }
      })
      .filter((p): p is (r: InventoryRowUIShape) => boolean => !!p);
    if (preds.length > 0) {
      out = out.filter((r) => (joinOr ? preds.some((p) => p(r)) : preds.every((p) => p(r))));
    }
  }

  return out;
}

function applySorting(rows: InventoryRowUIShape[], sort: GetInventorySchema["sort"] | undefined): InventoryRowUIShape[] {
  if (!sort || sort.length === 0) return [...rows].sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  const cmp = (a: InventoryRowUIShape, b: InventoryRowUIShape, id: GetInventorySchema["sort"][number]["id"], desc: boolean) => {
    const dir = desc ? -1 : 1;
    switch (id) {
      case "mk":
        return dir * a.mk.localeCompare(b.mk);
      case "artikelnr":
        return dir * a.artikelnr.localeCompare(b.artikelnr);
      case "location":
        return dir * a.location.localeCompare(b.location);
      case "status":
        return dir * ((a.status ?? "").localeCompare(b.status ?? ""));
      case "benamning":
        return dir * ((a.benamning ?? "").localeCompare(b.benamning ?? ""));
      case "lagerplats":
        return dir * ((a.lagerplats ?? "").localeCompare(b.lagerplats ?? ""));
      case "createdAt":
      default:
        return dir * (Number(a.createdAt) - Number(b.createdAt));
    }
  };

  const sorts = sort.slice();
  return [...rows].sort((a, b) => {
    for (const s of sorts) {
      const c = cmp(a, b, s.id, s.desc);
      if (c !== 0) return c;
    }
    return 0;
  });
}

export async function getInventory(input: GetInventorySchema) {
  return await unstable_cache(
    async () => {
      try {
        const all = mapToRows(await readLager());
        const filtered = applyFilters(all, input);
        const sorted = applySorting(filtered, input.sort);
        const total = sorted.length;
        const start = Math.max(0, (input.page - 1) * input.perPage);
        const end = start + input.perPage;
        const page = sorted.slice(start, end);
        const pageCount = Math.ceil(total / input.perPage);
        return { data: page, pageCount };
      } catch (_err) {
        return { data: [], pageCount: 0 };
      }
    },
    ["inventory", JSON.stringify(input)],
    { revalidate: 1, tags: ["inventory"] },
  )();
}

// Option providers for faceted filters
export async function getInventoryMkCounts() {
  return unstable_cache(
    async () => {
      try {
        const all = mapToRows(await readLager());
        const map = new Map<string, number>();
        for (const r of all) {
          if (!r.mk) continue;
          map.set(r.mk, (map.get(r.mk) ?? 0) + 1);
        }
        return Array.from(map.entries())
          .map(([value, count]) => ({ value, label: value, count }))
          .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label));
      } catch (_err) {
        return [] as Array<{ value: string; label: string; count: number }>;
      }
    },
    ["inventory-mk-counts"],
    { revalidate: 300 },
  )();
}

export async function getInventoryLocationCounts() {
  return unstable_cache(
    async () => {
      try {
        const all = mapToRows(await readLager());
        const map = new Map<string, number>();
        for (const r of all) {
          if (!r.location) continue;
          map.set(r.location, (map.get(r.location) ?? 0) + 1);
        }
        return Array.from(map.entries())
          .map(([value, count]) => ({ value, label: value, count }))
          .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label));
      } catch (_err) {
        return [] as Array<{ value: string; label: string; count: number }>;
      }
    },
    ["inventory-location-counts"],
    { revalidate: 300 },
  )();
}

export async function getInventoryStatusCounts() {
  return unstable_cache(
    async () => {
      try {
        const all = mapToRows(await readLager());
        return all.reduce<Record<string, number>>((acc, r) => {
          if (!r.status) return acc;
          acc[r.status] = (acc[r.status] ?? 0) + 1;
          return acc;
        }, {});
      } catch (_err) {
        return {} as Record<string, number>;
      }
    },
    ["inventory-status-counts"],
    { revalidate: 300 },
  )();
}
