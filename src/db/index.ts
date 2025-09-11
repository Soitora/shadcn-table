import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env.js";

import * as schema from "./schema";

// Reuse a single Postgres client across HMR in dev to avoid exhausting connections.
// Limit pool size to a safe value. Adjust `max` based on your DB limits.
const globalForPg = globalThis as unknown as {
  __pgClient?: ReturnType<typeof postgres>;
  __drizzleDb?: ReturnType<typeof drizzle<typeof schema>>;
};

const client =
  globalForPg.__pgClient ??
  postgres(env.DATABASE_URL, {
    max: 10, // connection pool size
    idle_timeout: 20, // seconds
    connect_timeout: 10, // seconds
  });

export const db =
  globalForPg.__drizzleDb ?? drizzle(client, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForPg.__pgClient = client;
  globalForPg.__drizzleDb = db;
}
