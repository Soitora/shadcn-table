import { CommandIcon, FileSpreadsheetIcon, ListFilter } from "lucide-react";

export type FlagConfig = typeof flagConfig;

export const flagConfig = {
  featureFlags: [
    {
      label: "Normala filter",
      value: "simple" as const,
      icon: ListFilter,
      tooltipTitle: "Normala filter",
      tooltipDescription: "Standardfilter med snabb facetterad filtrering.",
    },
    {
      label: "Avancerade filter",
      value: "advancedFilters" as const,
      icon: FileSpreadsheetIcon,
      tooltipTitle: "Avancerade filter",
      tooltipDescription: "Airtable-typ avancerade filter för att filtrera rader.",
    },
    {
      label: "Kommandofilter",
      value: "commandFilters" as const,
      icon: CommandIcon,
      tooltipTitle: "Kommandofilter",
      tooltipDescription: "Linjär-typ kommandopalette för att filtrera rader.",
    },
  ],
};
