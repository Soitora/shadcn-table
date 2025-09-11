"use client";

import * as React from "react";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { DataTableFilterList } from "@/components/data-table/data-table-filter-list";
import { DataTableFilterMenu } from "@/components/data-table/data-table-filter-menu";
import { DataTableSortList } from "@/components/data-table/data-table-sort-list";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import type { DataTableRowAction } from "@/types/data-table";

import { getInventoryTableColumns, type InventoryRowUI } from "./inventory-table-columns";
import { useFeatureFlags } from "./feature-flags-provider";
import { Input } from "@/components/ui/input";
import { useQueryState } from "nuqs";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { X } from "lucide-react";

interface InventoryTableProps {
  promises: Promise<[
    Awaited<ReturnType<typeof import("../_lib/queries").getInventory>>,
    Awaited<ReturnType<typeof import("../_lib/queries").getInventoryStatusCounts>>,
    Awaited<ReturnType<typeof import("../_lib/queries").getInventoryMkCounts>>,
    Awaited<ReturnType<typeof import("../_lib/queries").getInventoryLocationCounts>>,
  ]>;
}

export function InventoryTable({ promises }: InventoryTableProps) {
  const { enableAdvancedFilter, filterFlag } = useFeatureFlags();
  const [rowAction, setRowAction] = React.useState<DataTableRowAction<InventoryRowUI> | null>(null);

  const [{ data, pageCount }, statusCounts, mkOptions, locationOptions] = React.use(promises);

  const columns = React.useMemo(
    () => getInventoryTableColumns({ statusCounts, mkOptions, locationOptions, setRowAction }),
    [statusCounts, mkOptions, locationOptions]
  );

  const { table, shallow, debounceMs, throttleMs } = useDataTable({
    data,
    columns,
    pageCount,
    enableAdvancedFilter,
    initialState: {
      sorting: [{ id: "updatedAt", desc: true }],
      columnPinning: { right: ["actions"] },
    },
    getRowId: (row) => row.id,
    shallow: false,
    clearOnDefault: true,
  });

  // Global search (q): searches Artikelnr + Benämning(+2)
  const [q, setQ] = useQueryState("q", {
    parse: (v) => v ?? "",
    serialize: (v) => v ?? "",
    defaultValue: "",
    clearOnDefault: true,
    // Important: allow a full navigation so the server component re-fetches
    // inventory data with the new query. If shallow is true, only the client
    // URL updates and the server data won't refresh.
    shallow: false,
  });
  const [qInput, setQInput] = React.useState<string>(q ?? "");
  React.useEffect(() => {
    // Sync input when URL state changes externally (e.g., Reset button)
    setQInput(q ?? "");
  }, [q]);
  const onQChange = useDebouncedCallback((value: string) => setQ(value || null), 300);

  return (
    <DataTable table={table}>
      {enableAdvancedFilter ? (
        <DataTableAdvancedToolbar table={table}>
          <DataTableSortList table={table} align="start" />
          {filterFlag === "advancedFilters" ? (
            <DataTableFilterList
              table={table}
              shallow={shallow}
              debounceMs={debounceMs}
              throttleMs={throttleMs}
              align="start"
            />
          ) : (
            <DataTableFilterMenu
              table={table}
              shallow={shallow}
              debounceMs={debounceMs}
              throttleMs={throttleMs}
            />
          )}
        </DataTableAdvancedToolbar>
      ) : (
        <DataTableToolbar
          table={table}
          leftExtras={
            <div className="relative">
              <Input
                placeholder="Search artikelnr or benämning..."
                value={qInput}
                onChange={(e) => {
                  const next = e.target.value;
                  setQInput(next);
                  onQChange(next);
                }}
                className="h-8 w-56 pr-8"
              />
              {(qInput ?? "").length > 0 && (
                <button
                  type="button"
                  aria-label="Clear search"
                  className="absolute right-1 top-1.5 inline-flex size-5 items-center justify-center rounded hover:bg-accent"
                  onClick={() => {
                    setQ(null);
                    setQInput("");
                  }}
                >
                  <X className="size-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          }
          isFilteredOverride={(qInput ?? "").length > 0}
          onResetOverride={() => {
            setQ(null);
            setQInput("");
          }}
        >
          <DataTableSortList table={table} align="end" />
        </DataTableToolbar>
      )}
    </DataTable>
  );
}
