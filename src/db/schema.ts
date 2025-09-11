import { sql } from "drizzle-orm";
import { boolean, jsonb, real, timestamp, varchar } from "drizzle-orm/pg-core";
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

// Inventory table backed by JSONB items, sourced from src/db/lager.json
export const inventory = pgTable("inventory", {
  id: varchar("id", { length: 30 })
    .$defaultFn(() => generateId())
    .primaryKey(),
  // Lager location key, e.g. "Partille"
  location: varchar("location", { length: 128 }).notNull(),
  // Raw JSON item as provided in lager.json arrays
  item: jsonb("item").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`current_timestamp`)
    .$onUpdate(() => new Date()),
});

export interface InventoryRow extends Omit<typeof inventory.$inferInsert, "id"> {}
export type Inventory = typeof inventory.$inferSelect;
