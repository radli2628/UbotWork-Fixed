import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";
export * from "./schema/auth";
export * from "./schema/bots";
export * from "./schema/subscribers";
export * from "./schema/broadcasts";
export * from "./schema/sendLogs";
export * from "./schema/plans";
export * from "./schema/userSessions";
export * from "./schema/paymentRequests";
export * from "./schema/tokens";
export * from "./schema/botSettings";
export * from "./schema/otpCodes";
export * from "./schema/userbots";
