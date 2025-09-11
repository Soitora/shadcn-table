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

  const validFilters = getValidFilters(search.filters);

  // For the first step, render Inventory in the table while keeping the toolbars.
  // Map basic params from existing search to inventory query shape.
  const invPromises = Promise.all([
    getInventory({
      page: search.page,
      perPage: search.perPage,
      sort: [{ id: "updatedAt", desc: true }],
      q: search.title ?? "",
      status: [],
      locations: [],
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
