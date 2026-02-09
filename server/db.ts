import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

// Database is optional - only connect if DATABASE_URL is set
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

if (process.env.DATABASE_URL) {
  try {
    const client = postgres(process.env.DATABASE_URL);
    db = drizzle(client, { schema });
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Failed to connect to database:", error);
  }
} else {
  console.log("DATABASE_URL not set - running without database persistence");
}

export { db };
export type DB = NonNullable<typeof db>;
