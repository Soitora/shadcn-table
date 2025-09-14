import { createSearchParamsCache, parseAsArrayOf, parseAsInteger, parseAsString, parseAsStringEnum } from "nuqs/server";
import { z } from "zod";

import { getFiltersStateParser, getSortingStateParser } from "@/lib/parsers";

export const inventorySearchParamsCache = createSearchParamsCache({
  filterFlag: parseAsStringEnum(["advancedFilters", "commandFilters", "simple"] as const).withDefault("simple"),
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(10),
  // Use a generic that permits string IDs so we can sort by column IDs coming from the table
  sort: getSortingStateParser<Record<string, unknown>>().withDefault([
    { id: "markeskod", desc: false },
    { id: "benamning", desc: false },
  ]),
  q: parseAsString.withDefault(""),
  status: parseAsArrayOf(z.string()).withDefault([]),
  markeskod: parseAsArrayOf(z.string()).withDefault([]),
  // advanced filter
  filters: getFiltersStateParser().withDefault([]),
  joinOperator: parseAsStringEnum(["och", "eller"] as const).withDefault("och"),
});

export type GetInventorySearch = Awaited<ReturnType<typeof inventorySearchParamsCache.parse>>;
