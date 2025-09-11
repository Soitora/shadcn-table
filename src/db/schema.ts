import { sql } from "drizzle-orm";
import { boolean, jsonb, real, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { pgTable } from "@/db/utils";

import { generateId } from "@/lib/id";

export const tasks = pgTable("tasks", {
  id: varchar("id", { length: 30 })
    .$defaultFn(() => generateId())
    .primaryKey(),
  code: varchar("code", { length: 128 }).notNull().unique(),
  title: varchar("title", { length: 128 }),
  status: varchar("status", {
    length: 30,
    enum: ["todo", "in-progress", "done", "canceled"],
  })
    .notNull()
    .default("todo"),
  label: varchar("label", {
    length: 30,
    enum: ["bug", "feature", "enhancement", "documentation"],
  })
    .notNull()
    .default("bug"),
  priority: varchar("priority", {
    length: 30,
    enum: ["low", "medium", "high"],
  })
    .notNull()
    .default("low"),
  estimatedHours: real("estimated_hours").notNull().default(0),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`current_timestamp`)
    .$onUpdate(() => new Date()),
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

// Articles are immutable across locations and identified by (mk, artikelnr)
export const articles = pgTable(
  "articles",
  {
    id: varchar("id", { length: 30 })
      .$defaultFn(() => generateId())
      .primaryKey(),
    mk: varchar("mk", { length: 128 }).notNull(),
    artikelnr: varchar("artikelnr", { length: 256 }).notNull(),
    benamning: varchar("benamning", { length: 256 }),
    benamning2: varchar("benamning2", { length: 256 }),
    extrainfo: varchar("extrainfo", { length: 512 }),
    bild: boolean("bild"),
    paket: jsonb("paket").$type<string[]>(),
    fordon: jsonb("fordon").$type<string[]>(),
    alternativart: jsonb("alternativart").$type<Array<{ märkeskod: string; artikelnummer: string }>>(),
    // Store the immutable projection as JSON as well for convenience
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .default(sql`current_timestamp`)
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    articleMkArtikelnrUnique: uniqueIndex("shadcn_articles_mk_artikelnr_unique").on(
      t.mk,
      t.artikelnr,
    ),
  }),
);

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;

// Inventory per location; some fields (status, lagerplats) differ by location
export const inventory = pgTable(
  "inventory",
  {
    id: varchar("id", { length: 30 })
      .$defaultFn(() => generateId())
      .primaryKey(),
    // Lager location key, e.g. "Partille"
    location: varchar("location", { length: 128 }).notNull(),
    // Article identity
    mk: varchar("mk", { length: 128 }).notNull(),
    artikelnr: varchar("artikelnr", { length: 256 }).notNull(),
    // Location-specific fields
    status: varchar("status", { length: 64 }),
    lagerplats: varchar("lagerplats", { length: 128 }),
    // Optional JSONB for location-specific projection
    locationData: jsonb("location_data").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .default(sql`current_timestamp`)
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    inventoryMkArtikelnrLocationUnique: uniqueIndex(
      "shadcn_inventory_mk_artikelnr_location_unique",
    ).on(t.mk, t.artikelnr, t.location),
  }),
);

export interface InventoryRow extends Omit<typeof inventory.$inferInsert, "id"> {}
export type Inventory = typeof inventory.$inferSelect;
