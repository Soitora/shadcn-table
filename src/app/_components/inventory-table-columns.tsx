"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CalendarIcon, Ellipsis, Hash, MapPin, Tag } from "lucide-react";
import * as React from "react";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";
import type { DataTableRowAction } from "@/types/data-table";

export interface InventoryRowUI {
  id: string;
  mk: string;
  artikelnr: string;
  benamning: string | null;
  benamning2: string | null;
  location: string;
  status: string | null;
  lagerplats: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

interface FacetOption { value: string; label: string; count?: number }

interface GetInventoryTableColumnsProps {
  statusCounts: Record<string, number>;
  mkOptions?: FacetOption[];
  locationOptions?: FacetOption[];
  setRowAction?: React.Dispatch<
    React.SetStateAction<DataTableRowAction<InventoryRowUI> | null>
  >;
}

export function getInventoryTableColumns({
  statusCounts,
  mkOptions = [],
  locationOptions = [],
  setRowAction,
}: GetInventoryTableColumnsProps): ColumnDef<InventoryRowUI>[] {
  const STATUS_INFO: Record<string, { label: string; tone: "positive" | "neutral" | "negative" }> = {
    J: { label: "Lagervara", tone: "positive" },
    U: { label: "Utgående", tone: "neutral" },
    H: { label: "Hemtagen", tone: "neutral" },
    A: { label: "Avskriven", tone: "neutral" },
    B: { label: "Beställd", tone: "negative" },
    R: { label: "Rörelseregistrerad", tone: "negative" },
    N: { label: "Ej lagerförd", tone: "negative" },
  };

  function getToneClasses(tone: "positive" | "neutral" | "negative") {
    switch (tone) {
      case "positive":
        return "border-green-200 bg-green-500/10 text-green-700 dark:border-green-900/40 dark:text-green-400";
      case "negative":
        return "border-red-200 bg-red-500/10 text-red-700 dark:border-red-900/40 dark:text-red-400";
      default:
        return "border-yellow-200 bg-yellow-500/10 text-yellow-700 dark:border-yellow-900/40 dark:text-yellow-400";
    }
  }

  const StatusDot: React.FC<{ tone: "positive" | "neutral" | "negative" }> = ({ tone }) => (
    <span
      aria-hidden
      className={
        "mr-1 inline-block size-2 rounded-full " +
        (tone === "positive"
          ? "bg-green-500"
          : tone === "negative"
            ? "bg-red-500"
            : "bg-yellow-500")
      }
    />
  );
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-0.5"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-0.5"
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      id: "mk",
      accessorKey: "mk",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="MK" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="py-1">{row.getValue("mk")}</Badge>
        </div>
      ),
      meta: {
        label: "MK",
        variant: "multiSelect",
        icon: Hash,
        options: mkOptions,
        placeholder: "Select MK...",
      },
      enableColumnFilter: true,
    },
    {
      id: "artikelnr",
      accessorKey: "artikelnr",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Artikelnr" />
      ),
      cell: ({ row }) => <div className="w-40">{row.getValue("artikelnr")}</div>,
      meta: {
        label: "Artikelnr",
        variant: "text",
        icon: Tag,
        placeholder: "Search...",
      },
      enableColumnFilter: false,
    },
    {
      id: "benamning",
      accessorKey: "benamning",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Benämning" />
      ),
      cell: ({ row }) => (
        <span className="max-w-[28rem] truncate">{row.getValue("benamning")}</span>
      ),
      meta: {
        label: "Benämning",
        variant: "text",
        icon: Tag,
        placeholder: "Search...",
      },
      enableColumnFilter: false,
    },
    {
      id: "location",
      accessorKey: "location",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Location" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="py-1">{row.getValue("location")}</Badge>
        </div>
      ),
      meta: {
        label: "Location",
        variant: "multiSelect",
        icon: MapPin,
        options: locationOptions,
        placeholder: "Select locations...",
      },
      enableColumnFilter: true,
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.getValue<string | null>("status");
        if (!status) return null;
        const info = STATUS_INFO[status] ?? { label: "Okänd", tone: "neutral" as const };
        return (
          <Badge
            variant="outline"
            className={"py-1 " + getToneClasses(info.tone)}
            title={info.label}
            aria-label={info.label}
          >
            <span className="truncate font-semibold">{info.label}</span>
          </Badge>
        );
      },
      meta: {
        label: "Status",
        variant: "multiSelect",
        options: (() => {
          const statusOrder = ["J", "U", "H", "A", "B", "R", "N"]; // desired order
          return Object.entries(statusCounts)
            .sort(([a], [b]) => {
              const ia = statusOrder.indexOf(a);
              const ib = statusOrder.indexOf(b);
              const oa = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
              const ob = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
              return oa - ob;
            })
            .map(([value, count]) => {
              const info = STATUS_INFO[value] ?? { label: "Okänd", tone: "neutral" as const };
              const Icon = () => <StatusDot tone={info.tone} />;
              return {
                label: info.label,
                value,
                count,
                icon: Icon,
              };
            });
        })(),
        icon: Tag,
      },
      enableColumnFilter: true,
    },
    {
      id: "updatedAt",
      accessorKey: "updatedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Updated" />
      ),
      cell: ({ cell }) => (cell.getValue<Date | null>() ? formatDate(cell.getValue<Date>()) : ""),
      meta: {
        label: "Updated",
        variant: "dateRange",
        icon: CalendarIcon,
      },
      enableColumnFilter: true,
    },
    {
      id: "actions",
      cell: function Cell({ row }) {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Open menu"
                variant="ghost"
                className="flex size-8 p-0 data-[state=open]:bg-muted"
              >
                <Ellipsis className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem disabled>View</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      size: 40,
    },
  ];
}
