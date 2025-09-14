import { unstable_cache } from "@/lib/unstable-cache";
import { promises as fs } from "node:fs";
import path from "node:path";

// Inventory queries from JSON
export interface GetInventorySchema {
  page: number;
  perPage: number;
  sort: Array<{ id: "markeskod" | "artikelnummer" | "benamning" | "status" | "lagerplats"; desc: boolean }>;
  filterFlag?: "advancedFilters" | "commandFilters" | "simple";
  // simple filters
  q?: string; // matches artikelnr, benamning, benamning2
  status?: string[];
  mk?: string[];
  // advanced/command filters
  filters?: Array<{
    id: string;
    value: unknown;
    variant?: string;
    operator?: string;
  }>;
  joinOperator?: "och" | "eller";
}

function normalizeStatusTokenToCode(token: string): string | null {
  const t = token.trim();
  if (!t) return null;
  // Already a one-letter code
  if (t.length === 1) return t.toUpperCase();
  // Accept common Swedish labels (case-insensitive)
  const s = t.toLowerCase();
  switch (s) {
    case "lagervara":
      return "J";
    case "utgående":
      return "U";
    case "hemtagen":
      return "H";
    case "avskriven":
      return "A";
    case "rörelseregistrerad":
      return "R";
    case "ej lagerförd":
      return "N";
    default:
      return null;
  }
}

interface RawKorsnummer { "markeskod": string; "artikelnummer": string }
interface RawInventoryItem {
  markeskod: string;
  artikelnummer: string;
  benamning?: string | null;
  benamning2?: string | null;
  status?: string | null;
  lagerplats?: string | null;
  paket?: string[] | null;
  fordon?: string[] | null;
  ersatter?: string | string[] | null;
  ersatt_av?: string | string[] | null;
  korsnummer?: RawKorsnummer[] | null;
  extra_info?: string | null;
  bild?: boolean | null;
  // Raw JSON may include additional keys we don't map; they are ignored here
  [key: string]: unknown;
}

export interface InventoryRowUIShape {
  id: string;
  markeskod: string;
  artikelnummer: string;
  benamning: string | null;
  benamning_alt: string | null;
  status: string | null;
  lagerplats: string | null;
  ersatter: string[] | null;
  ersatt_av: string[] | null;
  korsnummer: Array<{ markeskod: string; artikelnummer: string }> | null;
  fordon: string[] | null;
  paket: string[] | null;
  extra_info: string | null;
  bild: boolean | null;
}

async function readLager(): Promise<unknown> {
  const filePath = path.join(process.cwd(), "public", "db", "lager.json");
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

function mapToRows(json: unknown): InventoryRowUIShape[] {
  const rows: InventoryRowUIShape[] = [];
  function toStringArray(v: unknown): string[] | null {
    if (v == null) return null;
    if (Array.isArray(v)) {
      const out = v.map((x) => String(x)).filter(Boolean);
      return out.length ? out : null;
    }
    const s = String(v);
    return s ? [s] : null;
  }
  if (Array.isArray(json)) {
    for (const itRaw of json as RawInventoryItem[]) {
      const it = itRaw ?? ({} as RawInventoryItem);
      const id = `${it.markeskod} ${it.artikelnummer}`;
      rows.push({
        id,
        markeskod: it.markeskod ?? "",
        artikelnummer: it.artikelnummer ?? "",
        benamning: (it["benamning"] as string | undefined) ?? null,
        benamning_alt: (it["benamning_alt"] as string | undefined) ?? null,
        status: (() => {
          const s = it["status"] as string | undefined;
          return typeof s === "string" ? s.trim() : null;
        })(),
        lagerplats: (it["lagerplats"] as string | undefined) ?? null,
        ersatter: toStringArray(it["ersatter"]),
        ersatt_av: toStringArray(it["ersatt_av"]),
        korsnummer: (it["korsnummer"] as RawKorsnummer[] | undefined) ?? null,
        fordon: (it["fordon"] as string[] | undefined) ?? null,
        paket: (it["paket"] as string[] | undefined) ?? null,
        extra_info: (it["extra_info"] as string | undefined) ?? null,
        bild: (it["bild"] as boolean | undefined) ?? null,
      });
    }
  } else if (json && typeof json === "object") {
    for (const items of Object.values(json as Record<string, RawInventoryItem[]>)) {
      if (!Array.isArray(items)) continue;
      for (const it of items as RawInventoryItem[]) {
        const id = `${it.markeskod} ${it.artikelnummer}`;
        rows.push({
          id,
          markeskod: it.markeskod ?? "",
          artikelnummer: it.artikelnummer ?? "",
          benamning: (it["benamning"] as string | undefined) ?? null,
          benamning_alt: (it["benamning_alt"] as string | undefined) ?? null,
          status: (() => {
            const s = it["status"] as string | undefined;
            return typeof s === "string" ? s.trim() : null;
          })(),
          lagerplats: (it["lagerplats"] as string | undefined) ?? null,
          ersatter: toStringArray(it["ersatter"]),
          ersatt_av: toStringArray(it["ersatt_av"]),
          korsnummer: (it["korsnummer"] as RawKorsnummer[] | undefined) ?? null,
          paket: (it["paket"] as string[] | undefined) ?? null,
          fordon: (it["fordon"] as string[] | undefined) ?? null,
          extra_info: (it["extra_info"] as string | undefined) ?? null,
          bild: (it["bild"] as boolean | undefined) ?? null,
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
  const mkSet = new Set(input.mk ?? []);

  const isCmdLike = input.filterFlag === "advancedFilters" || input.filterFlag === "commandFilters";
  const overridden = new Set<string>(
    isCmdLike && input.filters
      ? input.filters
          .map((f) => f.id)
          .filter((id): id is "markeskod" | "status" => id === "markeskod" || id === "status")
      : [],
  );

  let out = rows.filter((r) => {
    if (hasQ) {
      const inArt = r.artikelnummer.toLowerCase().includes(q);
      const inName = (r.benamning ?? "").toLowerCase().includes(q);
      const inName2 = (r.benamning_alt ?? "").toLowerCase().includes(q);
      if (!(inArt || inName || inName2)) return false;
    }
    if (!overridden.has("status") && statusSet.size > 0 && (!r.status || !statusSet.has(r.status))) return false;
    if (!overridden.has("markeskod") && mkSet.size > 0 && !mkSet.has(r.markeskod)) return false;
    return true;
  });

  // Advanced/command filters (limited support for mk/status)
  if ((input.filterFlag === "advancedFilters" || input.filterFlag === "commandFilters") && input.filters?.length) {
    const joinOr = input.joinOperator === "eller";
    const preds = input.filters
      .map((f) => {
        const op = (f.operator ?? "inArray") as string;
        const values = Array.isArray(f.value)
          ? (f.value as string[])
          : [String(f.value ?? "")].filter(Boolean);

        switch (f.id) {
          case "markeskod": {
            if (op === "isEmpty") return (r: InventoryRowUIShape) => !r.markeskod;
            if (op === "isNotEmpty") return (r: InventoryRowUIShape) => !!r.markeskod;
            if (values.length === 0) return null;
            if (op === "notInArray") return (r: InventoryRowUIShape) => !values.includes(r.markeskod);
            return (r: InventoryRowUIShape) => values.includes(r.markeskod);
          }
          case "artikelnummer": {
            const get = (r: InventoryRowUIShape) => r.artikelnummer ?? "";
            if (op === "isEmpty") return (r: InventoryRowUIShape) => get(r).trim() === "";
            if (op === "isNotEmpty") return (r: InventoryRowUIShape) => get(r).trim() !== "";
            if (values.length === 0) return null;
            const v = String(values[0]);
            if (op === "eq") return (r: InventoryRowUIShape) => get(r) === v;
            if (op === "ne") return (r: InventoryRowUIShape) => get(r) !== v;
            if (op === "iLike") return (r: InventoryRowUIShape) => get(r).toLowerCase().includes(v.toLowerCase());
            if (op === "notILike") return (r: InventoryRowUIShape) => !get(r).toLowerCase().includes(v.toLowerCase());
            return null;
          }
          case "lagerplats": {
            const get = (r: InventoryRowUIShape) => r.lagerplats ?? "";
            if (op === "isEmpty") return (r: InventoryRowUIShape) => get(r).trim() === "";
            if (op === "isNotEmpty") return (r: InventoryRowUIShape) => get(r).trim() !== "";
            if (values.length === 0) return null;
            const v = String(values[0]);
            if (op === "eq") return (r: InventoryRowUIShape) => get(r) === v;
            if (op === "ne") return (r: InventoryRowUIShape) => get(r) !== v;
            if (op === "iLike") return (r: InventoryRowUIShape) => get(r).toLowerCase().includes(v.toLowerCase());
            if (op === "notILike") return (r: InventoryRowUIShape) => !get(r).toLowerCase().includes(v.toLowerCase());
            return null;
          }
          case "status": {
            if (op === "isEmpty") return (r: InventoryRowUIShape) => !r.status;
            if (op === "isNotEmpty") return (r: InventoryRowUIShape) => !!r.status;
            if (values.length === 0) return null;
            const normValues = values
              .map((v) => normalizeStatusTokenToCode(v))
              .filter((v): v is string => !!v);
            if (normValues.length === 0) return null;
            if (op === "notInArray") return (r: InventoryRowUIShape) => !r.status || !normValues.includes(r.status);
            return (r: InventoryRowUIShape) => !!r.status && normValues.includes(r.status);
          }
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
  if (!sort || sort.length === 0) return [...rows].sort((a, b) => a.artikelnummer.localeCompare(b.artikelnummer));
  const cmp = (a: InventoryRowUIShape, b: InventoryRowUIShape, id: GetInventorySchema["sort"][number]["id"], desc: boolean) => {
    const dir = desc ? -1 : 1;
    switch (id) {
      case "markeskod":
        return dir * a.markeskod.localeCompare(b.markeskod);
      case "artikelnummer":
        return dir * a.artikelnummer.localeCompare(b.artikelnummer);
      case "status":
        return dir * ((a.status ?? "").localeCompare(b.status ?? ""));
      case "benamning":
        return dir * ((a.benamning ?? "").localeCompare(b.benamning ?? ""));
      case "lagerplats":
        return dir * ((a.lagerplats ?? "").localeCompare(b.lagerplats ?? ""));
      default:
        return dir * a.artikelnummer.localeCompare(b.artikelnummer);
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
          if (!r.markeskod) continue;
          map.set(r.markeskod, (map.get(r.markeskod) ?? 0) + 1);
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
