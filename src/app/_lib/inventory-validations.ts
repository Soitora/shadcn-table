import { createSearchParamsCache, parseAsArrayOf, parseAsInteger, parseAsString, parseAsStringEnum } from "nuqs/server";
import { z } from "zod";

import { getFiltersStateParser, getSortingStateParser } from "@/lib/parsers";

export const inventorySearchParamsCache = createSearchParamsCache({
  filterFlag: parseAsStringEnum(["advancedFilters", "commandFilters", "simple"] as const),
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(10),
  // Use a generic that permits string IDs so we can sort by column IDs coming from the table
  sort: getSortingStateParser<Record<string, unknown>>().withDefault([
    { id: "Artikelnr", desc: false },
  ]),
  q: parseAsString.withDefault(""),
  status: parseAsArrayOf(z.string()).withDefault([]),
  mk: parseAsArrayOf(z.string()).withDefault([]),
  // advanced filter
  filters: getFiltersStateParser().withDefault([]),
  joinOperator: parseAsStringEnum(["and", "or"] as const).withDefault("and"),
});

export type GetInventorySearch = Awaited<ReturnType<typeof inventorySearchParamsCache.parse>>;
