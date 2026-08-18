import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Conexión lazy a PostgreSQL.
 *
 * La app POS funciona sin base de datos (usa localStorage del navegador),
 * por lo que NO se lanza error si falta DATABASE_URL. Esto permite
 * desplegar en Vercel sin configurar base de datos.
 *
 * Cuando se define DATABASE_URL, la conexión se crea bajo demanda.
 */

const globalForDb = globalThis as typeof globalThis & {
  __posPgPool?: Pool;
};

function createPool(): Pool | null {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;

  if (globalForDb.__posPgPool) return globalForDb.__posPgPool;

  const needsSsl =
    databaseUrl.includes("neon.tech") ||
    databaseUrl.includes("supabase") ||
    databaseUrl.includes("sslmode=require");

  const pool = new Pool({
    connectionString: databaseUrl,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    max: 5,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 10000,
  });

  globalForDb.__posPgPool = pool;
  return pool;
}

export function getPool(): Pool | null {
  return createPool();
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Cliente Drizzle. Lanza error solo si se usa sin DATABASE_URL configurada.
 */
export function getDb() {
  const pool = createPool();
  if (!pool) {
    throw new Error(
      "DATABASE_URL no está configurada. Agrégala en las variables de entorno."
    );
  }
  return drizzle(pool);
}

// Proxy para mantener compatibilidad con `import { db } from "@/db"`
export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop) {
    const instance = getDb();
    const value = instance[prop as keyof typeof instance];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
