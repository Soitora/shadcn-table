import { unstable_cache } from "@/lib/unstable-cache";

// Option providers for faceted filters
export async function getInventoryMkCounts() {
  return unstable_cache(
    async () => {
      try {
        const rows = await db
          .select({ mk: inventory.mk, count: count() })
          .from(inventory)
          .groupBy(inventory.mk)
          .having(gt(count(inventory.mk), 0));
        return rows
          .filter((r) => !!r.mk)
          .map((r) => ({ value: r.mk as string, label: r.mk as string, count: r.count }))
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
        const rows = await db
          .select({ location: inventory.location, count: count() })
          .from(inventory)
          .groupBy(inventory.location)
          .having(gt(count(inventory.location), 0));
        return rows
          .filter((r) => !!r.location)
          .map((r) => ({ value: r.location as string, label: r.location as string, count: r.count }))
          .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label));
      } catch (_err) {
        return [] as Array<{ value: string; label: string; count: number }>;
      }
    },
    ["inventory-location-counts"],
    { revalidate: 300 },
  )();
}

// Inventory queries
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

export async function getInventory(input: GetInventorySchema) {
  return await unstable_cache(
    async () => {
      try {
        const offset = (input.page - 1) * input.perPage;

        function buildAdvancedWhere() {
          if (!input.filters || input.filters.length === 0) return undefined;
          const parts = input.filters.map((f) => {
            switch (f.id) {
              case "mk": {
                const values = Array.isArray(f.value) ? (f.value as string[]) : [String(f.value ?? "")].filter(Boolean);
                return values.length ? inArray(inventory.mk, values) : undefined;
              }
              case "location": {
                const values = Array.isArray(f.value) ? (f.value as string[]) : [String(f.value ?? "")].filter(Boolean);
                return values.length ? inArray(inventory.location, values) : undefined;
              }
              case "status": {
                const values = Array.isArray(f.value) ? (f.value as string[]) : [String(f.value ?? "")].filter(Boolean);
                return values.length ? inArray(inventory.status, values) : undefined;
              }
              case "updatedAt": {
                const values = Array.isArray(f.value) ? (f.value as string[]) : [];
                if (values.length === 2) {
                  const [from, to] = values;
                  const fromDate = from ? new Date(Number(from)) : undefined;
                  const toDate = to ? new Date(Number(to)) : undefined;
                  return and(
                    fromDate ? gte(inventory.updatedAt, fromDate) : undefined,
                    toDate ? lte(inventory.updatedAt, toDate) : undefined,
                  );
                }
                return undefined;
              }
              default:
                return undefined;
            }
          }).filter(Boolean);
          if (parts.length === 0) return undefined;
          return input.joinOperator === "or" ? (or as any)(...parts) : and(...parts);
        }

        const isAdvanced = input.filterFlag === "advancedFilters" || input.filterFlag === "commandFilters";

        const basicWhere = and(
          input.q
            ? or(
                ilike(articles.benamning, `%${input.q}%`),
                ilike(articles.benamning2, `%${input.q}%`),
                ilike(inventory.artikelnr, `%${input.q}%`),
              )
            : undefined,
          input.status && input.status.length > 0 ? inArray(inventory.status, input.status) : undefined,
          input.location && input.location.length > 0 ? inArray(inventory.location, input.location) : undefined,
          input.mk && input.mk.length > 0 ? inArray(inventory.mk, input.mk) : undefined,
        );

        const where = isAdvanced ? buildAdvancedWhere() ?? basicWhere : basicWhere;

        const orderBy =
          input.sort && input.sort.length > 0
            ? input.sort.map((item) => {
                const col =
                  item.id === "mk"
                    ? inventory.mk
                    : item.id === "artikelnr"
                      ? inventory.artikelnr
                      : item.id === "location"
                        ? inventory.location
                        : item.id === "status"
                          ? inventory.status
                          : item.id === "benamning"
                            ? articles.benamning
                            : item.id === "lagerplats"
                              ? inventory.lagerplats
                              : inventory.createdAt;
                return item.desc ? desc(col) : asc(col);
              })
            : [desc(inventory.createdAt)];

        const { data, total } = await db.transaction(async (tx) => {
          const data = await tx
            .select({
              MK: inventory.mk,
              Artikelnr: inventory.artikelnr,
              Location: inventory.location,
              Status: inventory.status,
              Lagerplats: inventory.lagerplats,
              Benamning: articles.benamning,
              Benamning2: articles.benamning2,
              Extrainfo: articles.extrainfo,
              Bild: articles.bild,
              Paket: articles.paket,
              Fordon: articles.fordon,
              Alternativart: articles.alternativart,
            })
            .from(inventory)
            .leftJoin(
              articles,
              and(
                eq(articles.MK, inventory.MK),
                eq(articles.Artikelnr, inventory.Artikelnr),
              ),
            )
            .where(where)
            .limit(input.perPage)
            .offset(offset)
            .orderBy(...orderBy);

          const total = await tx
            .select({ count: count() })
            .from(inventory)
            .leftJoin(
              articles,
              and(
                eq(articles.MK, inventory.MK),
                eq(articles.Artikelnr, inventory.Artikelnr),
              ),
            )
            .where(where)
            .execute()
            .then((res) => res[0]?.count ?? 0);

          return { data, total };
        });

        const pageCount = Math.ceil(total / input.perPage);
        return { data, pageCount };
      } catch (_err) {
        return { data: [], pageCount: 0 };
      }
    },
    ["inventory", JSON.stringify(input)],
    { revalidate: 1, tags: ["inventory"] },
  )();
}

export async function getInventoryStatusCounts() {
  return unstable_cache(
    async () => {
      try {
        return await db
          .select({ status: inventory.Status, count: count() })
          .from(inventory)
          .groupBy(inventory.Status)
          .having(gt(count(inventory.Status), 0))
          .then((res) =>
            res.reduce<Record<string, number>>((acc, { status, count }) => {
              if (!status) return acc;
              acc[status] = count;
              return acc;
            }, {}),
          );
      } catch (_err) {
        return {} as Record<string, number>;
      }
    },
    ["inventory-status-counts"],
    { revalidate: 300 },
  )();
}
