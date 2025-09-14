import type { Table } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatRelativeTime, formatAbsolute } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DataTablePaginationProps<TData> extends React.ComponentProps<"div"> {
  table: Table<TData>;
  pageSizeOptions?: number[];
  total?: number;
  totalUnfiltered?: number;
  lastUpdatedMs?: number;
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [10, 15, 30, 60, 120],
  total,
  totalUnfiltered,
  lastUpdatedMs,
  className,
  ...props
}: DataTablePaginationProps<TData>) {
  return (
    <div
      className={cn(
        "flex w-full flex-col-reverse items-center justify-between gap-4 overflow-auto p-1 sm:flex-row sm:gap-8",
        className,
      )}
      {...props}
    >
      <div className="flex-1 whitespace-nowrap text-muted-foreground text-sm">
        {(() => {
          const selectedCount = table.getFilteredSelectedRowModel().rows.length;
          const filteredCount = table.getFilteredRowModel().rows.length;
          const parts: React.ReactNode[] = [];
          if (typeof lastUpdatedMs === "number") {
            parts.push(
              <TooltipProvider key="updated">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>Uppdaterad {formatRelativeTime(lastUpdatedMs)}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {formatAbsolute(lastUpdatedMs, "LLLL", "sv")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>,
            );
          }
          if (typeof total === "number" && typeof totalUnfiltered === "number") {
            const isFiltered = total < totalUnfiltered;
            parts.push(
              <span key="counts">
                {isFiltered ? `${total} av ${totalUnfiltered} artiklar` : `${total} artiklar`}
              </span>,
            );
          }
          if (selectedCount > 0) {
            parts.push(
              <span key="selected">{`${selectedCount} av ${filteredCount} rader valda`}</span>,
            );
          }
          return (
            <>
              {parts.map((node, idx) => (
                <React.Fragment key={`status-part-${idx}`}>
                  {idx > 0 ? <span className="px-1" aria-hidden>•</span> : null}
                  {node}
                </React.Fragment>
              ))}
            </>
          );
        })()}
      </div>
      <div className="flex flex-col-reverse items-center gap-4 sm:flex-row sm:gap-6 lg:gap-8">
        <div className="flex items-center space-x-2">
          <p className="whitespace-nowrap font-medium text-sm">Rader per sida</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="h-8 w-[4.5rem] [&[data-size]]:h-8">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-center font-medium text-sm">
          Sida {table.getState().pagination.pageIndex + 1} av{" "}
          {table.getPageCount()}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            aria-label="Go to first page"
            variant="outline"
            size="icon"
            className="hidden size-8 lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft />
          </Button>
          <Button
            aria-label="Go to previous page"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft />
          </Button>
          <Button
            aria-label="Go to next page"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight />
          </Button>
          <Button
            aria-label="Go to last page"
            variant="outline"
            size="icon"
            className="hidden size-8 lg:flex"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
