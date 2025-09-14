import { unstable_cache } from "@/lib/unstable-cache";
import { promises as fs } from "node:fs";
import path from "node:path";

// Inventory queries from JSON
export interface GetInventorySchema {
  page: number;
  perPage: number;
  sort: Array<{ id: "MK" | "Artikelnr" | "Benämning" | "Status" | "Lagerplats"; desc: boolean }>;
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
    case "Lagervara":
      return "J";
    case "Utgående":
      return "U";
    case "Hemtagen":
      return "H";
    case "Avskriven":
      return "A";
    case "Rörelseregistrerad":
      return "R";
    case "Ej lagerförd":
      return "N";
    default:
      return null;
  }
}

interface RawAlternativArt { "märkeskod": string; "artikelnummer": string }
interface RawInventoryItem {
  MK: string;
  Artikelnr: string;
  Benämning?: string | null;
  Benämning2?: string | null;
  Status?: string | null;
  Lagerplats?: string | null;
  Paket?: string[] | null;
  Fordon?: string[] | null;
  Ersätter?: string[] | null;
  ErsattAv?: string[] | null;
  AlternativArt?: RawAlternativArt[] | null;
  ExtraInfo?: string | null;
  Bild?: boolean | null;
  // Raw JSON may include additional keys we don't map; they are ignored here
  [key: string]: unknown;
}

export interface InventoryRowUIShape {
  ID: string;
  MK: string;
  Artikelnr: string;
  Benämning: string | null;
  Benämning2: string | null;
  Status: string | null;
  Lagerplats: string | null;
  Ersätter: string[] | null;
  ErsattAv: string[] | null;
  AlternativArt: Array<{ märkeskod: string; artikelnummer: string }> | null;
  Fordon: string[] | null;
  Paket: string[] | null;
  ExtraInfo: string | null;
  Bild: boolean | null;
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
      const id = `${it.MK} ${it.Artikelnr}`;
      rows.push({
        ID: id,
        MK: it.MK ?? "",
        Artikelnr: it.Artikelnr ?? "",
        Benämning: (it["Benämning"] as string | undefined) ?? null,
        Benämning2: (it["Benämning2"] as string | undefined) ?? null,
        Status: (() => {
          const s = it["Status"] as string | undefined;
          return typeof s === "string" ? s.trim() : null;
        })(),
        Lagerplats: (it["Lagerplats"] as string | undefined) ?? null,
        Ersätter: (it.Ersätter as string[] | undefined) ?? null,
        ErsattAv: (it.ErsattAv as string[] | undefined) ?? null,
        AlternativArt: (it["AlternativArt"] as RawAlternativArt[] | undefined) ?? null,
        Fordon: (it["Fordon"] as string[] | undefined) ?? null,
        Paket: (it["Paket"] as string[] | undefined) ?? null,
        ExtraInfo: (it["ExtraInfo"] as string | undefined) ?? null,
        Bild: (it["Bild"] as boolean | undefined) ?? null,
      });
    }
  } else if (json && typeof json === "object") {
    for (const items of Object.values(json as Record<string, RawInventoryItem[]>)) {
      if (!Array.isArray(items)) continue;
      for (const it of items) {
        const id = `${it.MK} ${it.Artikelnr}`;
        rows.push({
          ID: id,
          MK: it.MK ?? "",
          Artikelnr: it.Artikelnr ?? "",
          Benämning: (it["Benämning"] as string | undefined) ?? null,
          Benämning2: (it["Benämning2"] as string | undefined) ?? null,
          Status: (() => {
            const s = it["Status"] as string | undefined;
            return typeof s === "string" ? s.trim() : null;
          })(),
          Lagerplats: (it["Lagerplats"] as string | undefined) ?? null,
          Ersätter: (it.Ersätter as string[] | undefined) ?? null,
          ErsattAv: (it.ErsattAv as string[] | undefined) ?? null,
          AlternativArt: (it["AlternativArt"] as RawAlternativArt[] | undefined) ?? null,
          Paket: (it["Paket"] as string[] | undefined) ?? null,
          Fordon: (it["Fordon"] as string[] | undefined) ?? null,
          ExtraInfo: (it["ExtraInfo"] as string | undefined) ?? null,
          Bild: (it["Bild"] as boolean | undefined) ?? null,
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
          .filter((id): id is "MK" | "Status" => id === "MK" || id === "Status")
      : [],
  );

  let out = rows.filter((r) => {
    if (hasQ) {
      const inArt = r.Artikelnr.toLowerCase().includes(q);
      const inName = (r.Benämning ?? "").toLowerCase().includes(q);
      const inName2 = (r.Benämning2 ?? "").toLowerCase().includes(q);
      if (!(inArt || inName || inName2)) return false;
    }
    if (!overridden.has("Status") && statusSet.size > 0 && (!r.Status || !statusSet.has(r.Status))) return false;
    if (!overridden.has("MK") && mkSet.size > 0 && !mkSet.has(r.MK)) return false;
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
          case "MK": {
            if (op === "isEmpty") return (r: InventoryRowUIShape) => !r.MK;
            if (op === "isNotEmpty") return (r: InventoryRowUIShape) => !!r.MK;
            if (values.length === 0) return null;
            if (op === "notInArray") return (r: InventoryRowUIShape) => !values.includes(r.MK);
            return (r: InventoryRowUIShape) => values.includes(r.MK);
          }
          case "Artikelnr": {
            const get = (r: InventoryRowUIShape) => r.Artikelnr ?? "";
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
          case "Lagerplats": {
            const get = (r: InventoryRowUIShape) => r.Lagerplats ?? "";
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
          case "Status": {
            if (op === "isEmpty") return (r: InventoryRowUIShape) => !r.Status;
            if (op === "isNotEmpty") return (r: InventoryRowUIShape) => !!r.Status;
            if (values.length === 0) return null;
            const normValues = values
              .map((v) => normalizeStatusTokenToCode(v))
              .filter((v): v is string => !!v);
            if (normValues.length === 0) return null;
            if (op === "notInArray") return (r: InventoryRowUIShape) => !r.Status || !normValues.includes(r.Status);
            return (r: InventoryRowUIShape) => !!r.Status && normValues.includes(r.Status);
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
  if (!sort || sort.length === 0) return [...rows].sort((a, b) => a.Artikelnr.localeCompare(b.Artikelnr));
  const cmp = (a: InventoryRowUIShape, b: InventoryRowUIShape, id: GetInventorySchema["sort"][number]["id"], desc: boolean) => {
    const dir = desc ? -1 : 1;
    switch (id) {
      case "MK":
        return dir * a.MK.localeCompare(b.MK);
      case "Artikelnr":
        return dir * a.Artikelnr.localeCompare(b.Artikelnr);
      case "Status":
        return dir * ((a.Status ?? "").localeCompare(b.Status ?? ""));
      case "Benämning":
        return dir * ((a.Benämning ?? "").localeCompare(b.Benämning ?? ""));
      case "Lagerplats":
        return dir * ((a.Lagerplats ?? "").localeCompare(b.Lagerplats ?? ""));
      default:
        return dir * a.Artikelnr.localeCompare(b.Artikelnr);
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
          if (!r.MK) continue;
          map.set(r.MK, (map.get(r.MK) ?? 0) + 1);
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
          if (!r.Status) return acc;
          acc[r.Status] = (acc[r.Status] ?? 0) + 1;
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
