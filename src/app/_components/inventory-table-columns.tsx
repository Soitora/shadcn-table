"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CalendarIcon, Ellipsis, Hash, Tag } from "lucide-react";
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
  status: string | null;
  lagerplats: string | null;
  extrainfo: string | null;
  bild: boolean | null;
  paket: string[] | null;
  fordon: string[] | null;
  alternativart: Array<{ märkeskod: string; artikelnummer: string }> | null;
  articleData?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date | null;
}

interface FacetOption { value: string; label: string; count?: number }

interface GetInventoryTableColumnsProps {
  statusCounts: Record<string, number>;
  mkOptions?: FacetOption[];
  setRowAction?: React.Dispatch<
    React.SetStateAction<DataTableRowAction<InventoryRowUI> | null>
  >;
}

export function getInventoryTableColumns({
  statusCounts,
  mkOptions = [],
  setRowAction,
}: GetInventoryTableColumnsProps): ColumnDef<InventoryRowUI>[] {
  const STATUS_INFO: Record<string, { label: string; tone: "positive" | "neutral" | "negative" }> = {
    J: { label: "Lagervara", tone: "positive" },
    U: { label: "Utgående", tone: "neutral" },
    H: { label: "Hemtagen", tone: "neutral" },
    A: { label: "Avskriven", tone: "neutral" },
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
      cell: ({ row }) => <div className="w-40 font-semibold">{row.getValue("artikelnr")}</div>,
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
      cell: ({ row }) => {
        const benamning = row.getValue<string | null>("benamning");
        const benamning2 = row.original.benamning2;
        return (
          <div className="max-w-[28rem]">
            <div className="truncate">{benamning}</div>
            {benamning2 ? (
              <div className="truncate text-muted-foreground text-sm">{benamning2}</div>
            ) : null}
          </div>
        );
      },
      meta: {
        label: "Benämning",
        variant: "text",
        icon: Tag,
        placeholder: "Search...",
      },
      enableColumnFilter: false,
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
          const statusOrder = ["J", "U", "H", "A", "R", "N"]; // desired order
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
      id: "lagerplats",
      accessorKey: "lagerplats",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Lagerplats" />
      ),
      cell: ({ row }) => {
        const value = row.getValue<string | null>("lagerplats");
        if (!value) return null;
        return (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="py-1">{value}</Badge>
          </div>
        );
      },
      meta: {
        label: "Lagerplats",
        variant: "text",
        icon: Tag,
        placeholder: "Search lagerplats...",
      },
      enableColumnFilter: false,
    },
    {
      id: "ersatter",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ersätter" />
      ),
      cell: ({ row }) => {
        const data = (row.original.articleData ?? {}) as Record<string, unknown>;
        const values =
          (data["Ersätter"] as string[] | undefined) ||
          (data["ersatter"] as string[] | undefined) ||
          (data["ersätter"] as string[] | undefined) || [];
        if (values.length === 0) return null;
        return (
          <div className="flex max-w-[28rem] flex-wrap gap-1">
            {values.map((val) => (
              <Badge key={val} variant="outline" className="px-1 py-0.5">
                {val}
              </Badge>
            ))}
          </div>
        );
      },
      meta: { label: "Ersätter", variant: "text", icon: Tag },
      enableColumnFilter: false,
    },
    {
      id: "ersattAv",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ersatt av" />
      ),
      cell: ({ row }) => {
        const data = (row.original.articleData ?? {}) as Record<string, unknown>;
        const values =
          (data["Ersatt av"] as string[] | undefined) ||
          (data["Ersatt_av"] as string[] | undefined) ||
          (data["ersatt_av"] as string[] | undefined) ||
          (data["ersattav"] as string[] | undefined) || [];
        if (values.length === 0) return null;
        return (
          <div className="flex max-w-[28rem] flex-wrap gap-1">
            {values.map((val) => (
              <Badge key={val} variant="outline" className="px-1 py-0.5">
                {val}
              </Badge>
            ))}
          </div>
        );
      },
      meta: { label: "Ersatt av", variant: "text", icon: Tag },
      enableColumnFilter: false,
    },
    {
      id: "alternativart",
      accessorKey: "alternativart",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Alternativ Artikel" />
      ),
      cell: ({ row }) => {
        const list = (row.getValue("alternativart") as InventoryRowUI["alternativart"]) || [];
        if (!list || list.length === 0) return null;
        return (
          <div className="flex max-w-[28rem] flex-wrap gap-1">
            {list.map((item) => (
              <Badge key={`${item.märkeskod}-${item.artikelnummer}`} variant="outline" className="px-1 py-0.5">
                {item.märkeskod} {item.artikelnummer}
              </Badge>
            ))}
          </div>
        );
      },
      meta: { label: "Alternativ Artikel", variant: "text", icon: Tag },
      enableColumnFilter: false,
    },
    {
      id: "fordon",
      accessorKey: "fordon",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Fordon" />,
      cell: ({ row }) => {
        const list = (row.getValue("fordon") as string[] | null) || [];
        if (!list || list.length === 0) return null;
        return (
          <div className="flex max-w-[28rem] flex-wrap gap-1">
            {list.map((item) => (
              <Badge key={item} variant="outline" className="px-1 py-0.5">
                {item}
              </Badge>
            ))}
          </div>
        );
      },
      meta: { label: "Fordon", variant: "text", icon: Tag },
      enableColumnFilter: false,
    },
    {
      id: "paket",
      accessorKey: "paket",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Paket" />,
      cell: ({ row }) => {
        const list = (row.getValue("paket") as string[] | null) || [];
        if (!list || list.length === 0) return null;
        return (
          <div className="flex max-w-[28rem] flex-wrap gap-1">
            {list.map((item) => (
              <Badge key={item} variant="outline" className="px-1 py-0.5">
                {item}
              </Badge>
            ))}
          </div>
        );
      },
      meta: { label: "Paket", variant: "text", icon: Tag },
      enableColumnFilter: false,
    },
    {
      id: "extrainfo",
      accessorKey: "extrainfo",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Extra Information" />
      ),
      cell: ({ row }) => (
        <span className="max-w-[28rem] truncate">{row.getValue("extrainfo") ?? ""}</span>
      ),
      meta: { label: "Extra Information", variant: "text", icon: Tag },
      enableColumnFilter: false,
    },
    {
      id: "bild",
      accessorKey: "bild",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Bild" />,
      cell: ({ row }) => {
        const has = !!row.getValue("bild");
        return has ? (
          <Badge className="py-0.5" variant="outline">Ja</Badge>
        ) : "";
      },
      meta: { label: "Bild", variant: "boolean", icon: Tag },
      enableColumnFilter: false,
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
