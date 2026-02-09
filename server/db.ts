import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

// Database is optional - only initialize if DATABASE_URL is set
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

if (process.env.DATABASE_URL) {
  const client = postgres(process.env.DATABASE_URL);
  db = drizzle(client, { schema });
  console.log("Database connection established");
} else {
  console.log("DATABASE_URL not set - running without database persistence");
}

export { db };
export type DB = typeof db;
