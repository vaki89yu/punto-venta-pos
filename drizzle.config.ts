import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config({ path: [".env.local", ".env"] });

// Prefer the direct endpoint for schema changes; Neon also provides the pooled DATABASE_URL for runtime traffic.
const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Falta DATABASE_URL. Configura PostgreSQL antes de ejecutar comandos de Drizzle.");
}

export default {
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
} satisfies Config;
