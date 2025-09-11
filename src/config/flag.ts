import { CommandIcon, FileSpreadsheetIcon } from "lucide-react";

export type FlagConfig = typeof flagConfig;

export const flagConfig = {
  featureFlags: [
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
