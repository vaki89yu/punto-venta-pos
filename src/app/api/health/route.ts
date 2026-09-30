import { sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessionSecret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  const sessionConfigured = Boolean(sessionSecret && Buffer.byteLength(sessionSecret) >= 32);
  if (!isDatabaseConfigured()) {
    return Response.json({ ok: false, database: "not_configured", sessionConfigured, message: "El POS requiere PostgreSQL para operar." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const db = getDb();
    const result = await db.execute(sql`select to_regclass('public.users') as users_table, to_regclass('public.products') as products_table, to_regclass('public.sales') as sales_table`);
    const tables = result.rows[0] as { users_table: string | null; products_table: string | null; sales_table: string | null } | undefined;
    const schemaReady = Boolean(tables?.users_table && tables?.products_table && tables?.sales_table);
    const ok = schemaReady && sessionConfigured;
    return Response.json({ ok, database: schemaReady ? "connected" : "schema_missing", sessionConfigured, message: ok ? "Sistema conectado." : schemaReady ? "Configura SESSION_SECRET." : "Ejecuta la inicialización de esquema." }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, database: "error", sessionConfigured, message: "PostgreSQL no está disponible o el esquema no se ha inicializado." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
