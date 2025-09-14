"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Ellipsis, Hash, Tag, Bolt, Loader, Package, Replace, ReplaceAll, Boxes, Truck, Blocks, ALargeSmall, Image } from "lucide-react";
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
import type { DataTableRowAction } from "@/types/data-table";
import type { InventoryRowUIShape } from "../_lib/queries";

export type InventoryRowUI = InventoryRowUIShape;

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
      id: "MK",
      accessorKey: "MK",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="MK" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="py-1">{row.getValue("MK")}</Badge>
        </div>
      ),
      meta: {
        label: "Märkeskod",
        variant: "multiSelect",
        icon: Bolt,
        options: mkOptions,
        placeholder: "Välj Märkeskod...",
      },
      enableColumnFilter: true,
    },
    {
      id: "Artikelnr",
      accessorKey: "Artikelnr",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Artikelnummer" />
      ),
      cell: ({ row }) => <div className="w-40 font-semibold">{row.getValue("Artikelnr")}</div>,
      meta: {
        label: "Artikelnummer",
        icon: Hash,
      },
      enableColumnFilter: true,
    },
    {
      id: "Benämning",
      accessorKey: "Benämning",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Benämning" />
      ),
      cell: ({ row }) => {
        const benamning = row.getValue<string | null>("Benämning");
        const benamning2 = row.original.Benämning2;
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
        placeholder: "Sök...",
      },
      enableColumnFilter: false,
    },
    {
      id: "Status",
      accessorKey: "Status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.getValue<string | null>("Status");
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
          const statusOrder = ["J", "U", "H", "A", "R", "N"];
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
        icon: Loader,
      },
      enableColumnFilter: true,
    },
    {
      id: "Lagerplats",
      accessorKey: "Lagerplats",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Lagerplats" />
      ),
      cell: ({ row }) => {
        const value = row.getValue<string | null>("Lagerplats");
        if (!value) return null;
        return (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="py-1">{value}</Badge>
          </div>
        );
      },
      meta: {
        label: "Lagerplats",
        icon: Package,
      },
      enableColumnFilter: true,
    },
    {
      id: "ersatter",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ersätter" />
      ),
      cell: ({ row }) => {
        const values = row.original.Ersätter ?? [];
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
      meta: { label: "Ersätter", variant: "text", icon: Replace },
      enableColumnFilter: false,
    },
    {
      id: "ersattAv",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ersatt av" />
      ),
      cell: ({ row }) => {
        const values = row.original.ErsattAv ?? [];
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
      meta: { label: "Ersatt av", variant: "text", icon: ReplaceAll },
      enableColumnFilter: false,
    },
    {
      id: "AlternativArt",
      accessorKey: "AlternativArt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Alternativ Artikel" />
      ),
      cell: ({ row }) => {
        const list = (row.getValue("AlternativArt") as InventoryRowUI["AlternativArt"]) || [];
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
      meta: { label: "Alternativ Artikel", variant: "text", icon: Boxes },
      enableColumnFilter: false,
    },
    {
      id: "Fordon",
      accessorKey: "Fordon",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Fordon" />,
      cell: ({ row }) => {
        const list = (row.getValue("Fordon") as string[] | null) || [];
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
      meta: { label: "Fordon", icon: Truck },
      enableColumnFilter: true,
    },
    {
      id: "Paket",
      accessorKey: "Paket",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Paket" />,
      cell: ({ row }) => {
        const list = (row.getValue("Paket") as string[] | null) || [];
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
      meta: { label: "Paket", icon: Blocks },
      enableColumnFilter: true,
    },
    {
      id: "ExtraInfo",
      accessorKey: "ExtraInfo",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Extra Information" />
      ),
      cell: ({ row }) => (
        <span className="max-w-[28rem] truncate">{row.getValue("ExtraInfo") ?? ""}</span>
      ),
      meta: { label: "Extra Information", icon: ALargeSmall },
      enableColumnFilter: true,
    },
    {
      id: "Bild",
      accessorKey: "Bild",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Bild" />,
      cell: ({ row }) => {
        const has = !!row.getValue("Bild");
        return has ? (
          <Badge className="py-0.5" variant="outline">Ja</Badge>
        ) : "";
      },
      meta: { label: "Bild", variant: "boolean", icon: Image },
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
