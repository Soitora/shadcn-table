import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import { articles, inventory, tasks } from "@/db/schema";

import { filterColumns } from "@/lib/filter-columns";
import { unstable_cache } from "@/lib/unstable-cache";

import type { GetTasksSchema } from "./validations";

export async function getTasks(input: GetTasksSchema) {
  return await unstable_cache(
    async () => {
      try {
        const offset = (input.page - 1) * input.perPage;
        const advancedTable =
          input.filterFlag === "advancedFilters" ||
          input.filterFlag === "commandFilters";

        const advancedWhere = filterColumns({
          table: tasks,
          filters: input.filters,
          joinOperator: input.joinOperator,
        });

        const where = advancedTable
          ? advancedWhere
          : and(
              input.title ? ilike(tasks.title, `%${input.title}%`) : undefined,
              input.status.length > 0
                ? inArray(tasks.status, input.status)
                : undefined,
              input.priority.length > 0
                ? inArray(tasks.priority, input.priority)
                : undefined,
              input.estimatedHours.length > 0
                ? and(
                    input.estimatedHours[0]
                      ? gte(tasks.estimatedHours, input.estimatedHours[0])
                      : undefined,
                    input.estimatedHours[1]
                      ? lte(tasks.estimatedHours, input.estimatedHours[1])
                      : undefined,
                  )
                : undefined,
              input.createdAt.length > 0
                ? and(
                    input.createdAt[0]
                      ? gte(
                          tasks.createdAt,
                          (() => {
                            const date = new Date(input.createdAt[0]);
                            date.setHours(0, 0, 0, 0);
                            return date;
                          })(),
                        )
                      : undefined,
                    input.createdAt[1]
                      ? lte(
                          tasks.createdAt,
                          (() => {
                            const date = new Date(input.createdAt[1]);
                            date.setHours(23, 59, 59, 999);
                            return date;
                          })(),
                        )
                      : undefined,
                  )
                : undefined,
            );

        const orderBy =
          input.sort.length > 0
            ? input.sort.map((item) =>
                item.desc ? desc(tasks[item.id]) : asc(tasks[item.id]),
              )
            : [asc(tasks.createdAt)];

        const { data, total } = await db.transaction(async (tx) => {
          const data = await tx
            .select()
            .from(tasks)
            .limit(input.perPage)
            .offset(offset)
            .where(where)
            .orderBy(...orderBy);

          const total = await tx
            .select({
              count: count(),
            })
            .from(tasks)
            .where(where)
            .execute()
            .then((res) => res[0]?.count ?? 0);

          return {
            data,
            total,
          };
        });

        const pageCount = Math.ceil(total / input.perPage);
        return { data, pageCount };
      } catch (_err) {
        return { data: [], pageCount: 0 };
      }
    },
    [JSON.stringify(input)],
    {
      revalidate: 1,
      tags: ["tasks"],
    },
  )();
}

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
          .map((r) => ({ value: r.mk as string, label: r.mk as string, count: r.count }));
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
          .map((r) => ({ value: r.location as string, label: r.location as string, count: r.count }));
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
  sort: Array<{ id: "createdAt" | "updatedAt" | "mk" | "artikelnr" | "location" | "status"; desc: boolean }>;
  filterFlag?: "advancedFilters" | "commandFilters" | "simple";
  // simple filters
  q?: string; // matches artikelnr, benamning, benamning2
  status?: string[];
  locations?: string[];
}

export async function getInventory(input: GetInventorySchema) {
  return await unstable_cache(
    async () => {
      try {
        const offset = (input.page - 1) * input.perPage;

        const where = and(
          input.q
            ? or(
                ilike(articles.benamning, `%${input.q}%`),
                ilike(articles.benamning2, `%${input.q}%`),
                ilike(inventory.artikelnr, `%${input.q}%`),
              )
            : undefined,
          input.status && input.status.length > 0
            ? inArray(inventory.status, input.status)
            : undefined,
          input.locations && input.locations.length > 0
            ? inArray(inventory.location, input.locations)
            : undefined,
        );

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
                          : item.id === "updatedAt"
                            ? inventory.updatedAt
                            : inventory.createdAt;
                return item.desc ? desc(col) : asc(col);
              })
            : [desc(inventory.updatedAt)];

        const { data, total } = await db.transaction(async (tx) => {
          const data = await tx
            .select({
              id: inventory.id,
              mk: inventory.mk,
              artikelnr: inventory.artikelnr,
              location: inventory.location,
              status: inventory.status,
              lagerplats: inventory.lagerplats,
              createdAt: inventory.createdAt,
              updatedAt: inventory.updatedAt,
              benamning: articles.benamning,
              benamning2: articles.benamning2,
            })
            .from(inventory)
            .leftJoin(
              articles,
              and(
                eq(articles.mk, inventory.mk),
                eq(articles.artikelnr, inventory.artikelnr),
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
                eq(articles.mk, inventory.mk),
                eq(articles.artikelnr, inventory.artikelnr),
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
          .select({ status: inventory.status, count: count() })
          .from(inventory)
          .groupBy(inventory.status)
          .having(gt(count(inventory.status), 0))
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


export async function getTaskStatusCounts() {
  return unstable_cache(
    async () => {
      try {
        return await db
          .select({
            status: tasks.status,
            count: count(),
          })
          .from(tasks)
          .groupBy(tasks.status)
          .having(gt(count(tasks.status), 0))
          .then((res) =>
            res.reduce(
              (acc, { status, count }) => {
                acc[status] = count;
                return acc;
              },
              {
                todo: 0,
                "in-progress": 0,
                done: 0,
                canceled: 0,
              },
            ),
          );
      } catch (_err) {
        return {
          todo: 0,
          "in-progress": 0,
          done: 0,
          canceled: 0,
        };
      }
    },
    ["task-status-counts"],
    {
      revalidate: 3600,
    },
  )();
}

export async function getTaskPriorityCounts() {
  return unstable_cache(
    async () => {
      try {
        return await db
          .select({
            priority: tasks.priority,
            count: count(),
          })
          .from(tasks)
          .groupBy(tasks.priority)
          .having(gt(count(), 0))
          .then((res) =>
            res.reduce(
              (acc, { priority, count }) => {
                acc[priority] = count;
                return acc;
              },
              {
                low: 0,
                medium: 0,
                high: 0,
              },
            ),
          );
      } catch (_err) {
        return {
          low: 0,
          medium: 0,
          high: 0,
        };
      }
    },
    ["task-priority-counts"],
    {
      revalidate: 3600,
    },
  )();
}

export async function getEstimatedHoursRange() {
  return unstable_cache(
    async () => {
      try {
        return await db
          .select({
            min: sql<number>`min(${tasks.estimatedHours})`,
            max: sql<number>`max(${tasks.estimatedHours})`,
          })
          .from(tasks)
          .then((res) => res[0] ?? { min: 0, max: 0 });
      } catch (_err) {
        return { min: 0, max: 0 };
      }
    },
    ["estimated-hours-range"],
    {
      revalidate: 3600,
    },
  )();
}
