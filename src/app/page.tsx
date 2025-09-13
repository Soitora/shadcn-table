import * as React from "react";
export const runtime = "nodejs";
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
} from "./_lib/queries";
import { inventorySearchParamsCache } from "./_lib/inventory-validations";

interface IndexPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function IndexPage(props: IndexPageProps) {
  const searchParams = await props.searchParams;
  const inv = inventorySearchParamsCache.parse(searchParams);
  const validFilters = getValidFilters(inv.filters);

  // For the first step, render Inventory in the table while keeping the toolbars.
  // Map basic params from existing search to inventory query shape.
  const invPromises = Promise.all([
    getInventory({
      page: inv.page,
      perPage: inv.perPage,
      sort: (inv.sort as any) ?? [{ id: "createdAt", desc: true }],
      q: inv.q ?? "",
      status: inv.status,
      mk: inv.mk,
      filterFlag: inv.filterFlag ?? undefined,
      filters: validFilters,
      joinOperator: inv.joinOperator as "and" | "or",
    }),
    getInventoryStatusCounts(),
    getInventoryMkCounts(),
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
