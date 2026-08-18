import { sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  // La app funciona sin base de datos (usa localStorage),
  // por eso se reporta OK aunque no esté configurada.
  if (!isDatabaseConfigured()) {
    return Response.json({
      ok: true,
      database: "not_configured",
      mode: "localStorage",
      message: "App operativa. Configura DATABASE_URL para persistencia en servidor.",
    });
  }

  try {
    const db = getDb();
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, database: "connected" });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        database: "error",
        message: error instanceof Error ? error.message : "Error de conexión",
      },
      { status: 500 }
    );
  }
}
