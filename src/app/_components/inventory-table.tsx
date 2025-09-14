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
import { useQueryState, parseAsInteger } from "nuqs";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { X } from "lucide-react";

interface InventoryTableProps {
  promises: Promise<[
    Awaited<ReturnType<typeof import("../_lib/queries").getInventory>>,
    Awaited<ReturnType<typeof import("../_lib/queries").getInventoryStatusCounts>>,
    Awaited<ReturnType<typeof import("../_lib/queries").getInventoryMarkeskodCounts>>,
  ]>;
}

export function InventoryTable({ promises }: InventoryTableProps) {
  const { enableAdvancedFilter, filterFlag } = useFeatureFlags();
  const [rowAction, setRowAction] = React.useState<DataTableRowAction<InventoryRowUI> | null>(null);

  const [{ data, pageCount }, statusCounts, markeskodOptions] = React.use(promises);

  const columns = React.useMemo(
    () => getInventoryTableColumns({ statusCounts, markeskodOptions, setRowAction }),
    [statusCounts, markeskodOptions]
  );

  const { table, shallow, debounceMs, throttleMs } = useDataTable({
    data,
    columns,
    pageCount,
    enableAdvancedFilter,
    initialState: {
      sorting: [
        { id: "markeskod", desc: false },
        { id: "benamning", desc: false },
      ],
      columnPinning: { right: ["actions"] },
      columnVisibility: {
        paket: false,
        extra_info: false,
        korsnummer: false,
        fordon: false,
        ersatt_av: false,
        ersatter: false,
      },
    },
    getRowId: (row) => row.id,
    shallow: false,
    clearOnDefault: true,
  });
  // Keep pagination in range when searching: jump back to page 1 on any q change
  const [, setPage] = useQueryState(
    "page",
    parseAsInteger
      .withOptions({ shallow: false, clearOnDefault: true })
      .withDefault(1),
  );

  // Global search (q): searches artikelnummer + benamning(+alt)
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
        <DataTableAdvancedToolbar
          table={table}
          rightExtras={<DataTableSortList table={table} align="end" />}
        >
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
                placeholder="Sök artiklar..."
                value={qInput}
                onChange={(e) => {
                  const next = e.target.value;
                  setQInput(next);
                  onQChange(next);
                  // Always jump to page 1 when query changes so results are in range
                  setPage(1);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    // Commit immediately on Enter (bypass debounce)
                    setQ(qInput || null);
                    setPage(1);
                  }
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
                    setPage(1);
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
            setPage(1);
          }}
        >
          <DataTableSortList table={table} align="end" />
        </DataTableToolbar>
      )}
    </DataTable>
  );
}
