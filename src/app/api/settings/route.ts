import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, storeSettings } from "@/db/schema";
import { ApiError, assertSameOrigin, jsonError, readJson } from "@/lib/server/http";
import { requireRole, requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";
function mapSettings(row: typeof storeSettings.$inferSelect) {
  return { ...row, taxRate: Number(row.taxRate), minimumGrossMarginPercent: Number(row.minimumGrossMarginPercent), defaultCoverageDays: Number(row.defaultCoverageDays), defaultLeadTimeDays: Number(row.defaultLeadTimeDays) };
}
export async function GET() {
  try {
    await requireUser();
    const [settings] = await getDb().select().from(storeSettings).orderBy(asc(storeSettings.updatedAt)).limit(1);
    if (!settings) throw new ApiError(503, "SETTINGS_NOT_INITIALIZED", "Inicializa la configuración de tienda antes de operar.");
    return Response.json({ settings: mapSettings(settings) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

const settingsSchema = z.object({
  name: z.string().trim().min(1).max(255),
  logo: z.string().max(2000).nullable().optional(),
  address: z.string().max(1000).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().max(255).nullable().optional().or(z.literal("")),
  rfc: z.string().max(13).nullable().optional(),
  taxRate: z.number().finite().min(0).max(100),
  currency: z.literal("MXN"),
  ticketMessage: z.string().max(1000).nullable().optional(),
  theme: z.enum(["light", "dark", "system"]),
  minimumGrossMarginPercent: z.number().finite().min(0).max(90),
  defaultCoverageDays: z.number().int().min(1).max(180),
  defaultLeadTimeDays: z.number().int().min(0).max(90),
});
export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("admin");
    const input = await readJson(request, settingsSchema);
    const db = getDb();
    const [existing] = await db.select().from(storeSettings).orderBy(desc(storeSettings.updatedAt)).limit(1);
    if (!existing) throw new ApiError(503, "SETTINGS_NOT_INITIALIZED", "Inicializa la configuración de tienda antes de operar.");
    const [updated] = await db.update(storeSettings).set({
      name: input.name,
      logo: input.logo || null,
      address: input.address || null,
      phone: input.phone || null,
      email: input.email || null,
      rfc: input.rfc || null,
      taxRate: input.taxRate.toFixed(2),
      currency: input.currency,
      ticketMessage: input.ticketMessage || null,
      theme: input.theme,
      minimumGrossMarginPercent: input.minimumGrossMarginPercent.toFixed(2),
      defaultCoverageDays: input.defaultCoverageDays,
      defaultLeadTimeDays: input.defaultLeadTimeDays,
      updatedAt: new Date(),
    }).where(eq(storeSettings.id, existing.id)).returning();
    await db.insert(auditEvents).values({ actorId: user.id, actorName: user.name, action: "settings.updated", entityType: "store_settings", entityId: existing.id, summary: "Configuración de tienda actualizada." });
    return Response.json({ settings: mapSettings(updated) });
  } catch (error) { return jsonError(error); }
}
