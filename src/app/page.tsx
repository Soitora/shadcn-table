import * as React from "react";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { Shell } from "@/components/shell";
import { getValidFilters } from "@/lib/data-table";
import type { SearchParams } from "@/types";

import { FeatureFlagsProvider } from "./_components/feature-flags-provider";
import { InventoryTable } from "./_components/inventory-table";
import {
  getInventory,
  getInventoryStatusCounts,
  getInventoryMkCounts,
  getInventoryLocationCounts,
} from "./_lib/queries";
import { searchParamsCache } from "./_lib/validations";

interface IndexPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function IndexPage(props: IndexPageProps) {
  const searchParams = await props.searchParams;
  const search = searchParamsCache.parse(searchParams);
  const qParam = Array.isArray(searchParams.q)
    ? (searchParams.q[0] as string)
    : ((searchParams.q as string) ?? "");
  const statusParam = Array.isArray(searchParams.status)
    ? (searchParams.status as string[])
    : searchParams.status
      ? [searchParams.status as string]
      : [];
  const locationParam = Array.isArray(searchParams.location)
    ? (searchParams.location as string[])
    : searchParams.location
      ? [searchParams.location as string]
      : [];
  const mkParam = Array.isArray(searchParams.mk)
    ? (searchParams.mk as string[])
    : searchParams.mk
      ? [searchParams.mk as string]
      : [];

  const validFilters = getValidFilters(search.filters);

  // For the first step, render Inventory in the table while keeping the toolbars.
  // Map basic params from existing search to inventory query shape.
  const invPromises = Promise.all([
    getInventory({
      page: search.page,
      perPage: search.perPage,
      sort: [{ id: "updatedAt", desc: true }],
      q: qParam,
      status: statusParam,
      location: locationParam,
      mk: mkParam,
      filterFlag: search.filterFlag ?? undefined,
      filters: validFilters,
      joinOperator: search.joinOperator as "and" | "or",
    }),
    getInventoryStatusCounts(),
    getInventoryMkCounts(),
    getInventoryLocationCounts(),
  ]);

  return (
    <Shell className="gap-2">
      <FeatureFlagsProvider>
        <React.Suspense
          fallback={
            <DataTableSkeleton
              columnCount={7}
              filterCount={2}
              cellWidths={[
                "10rem",
                "30rem",
                "10rem",
                "10rem",
                "6rem",
                "6rem",
                "6rem",
              ]}
              shrinkZero
            />
          }
        >
          <InventoryTable promises={invPromises} />
        </React.Suspense>
      </FeatureFlagsProvider>
    </Shell>
  );
}
