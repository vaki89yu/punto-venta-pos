import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, invoiceRequests, sales } from "@/db/schema";
import { ApiError, assertSameOrigin, jsonError, readJson } from "@/lib/server/http";
import { requireRole } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("admin", "manager");
    const rows = await getDb().select({ request: invoiceRequests, sale: sales })
      .from(invoiceRequests).innerJoin(sales, eq(invoiceRequests.saleId, sales.id))
      .orderBy(desc(invoiceRequests.createdAt)).limit(2000);
    return Response.json({ requests: rows.map(({ request, sale }) => ({
      id: request.id,
      saleId: request.saleId,
      ticketNumber: sale.ticketNumber,
      rfc: request.rfc,
      legalName: request.legalName,
      postalCode: request.postalCode,
      fiscalRegime: request.fiscalRegime,
      cfdiUse: request.cfdiUse,
      email: request.email || "",
      status: request.status,
      requestedBy: request.requestedBy,
      createdAt: request.createdAt.toISOString(),
    })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

const requestSchema = z.object({
  saleId: z.string().uuid(),
  rfc: z.string().trim().toUpperCase().regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/),
  legalName: z.string().trim().min(1).max(255),
  postalCode: z.string().regex(/^\d{5}$/),
  fiscalRegime: z.string().regex(/^\d{3}$/),
  cfdiUse: z.string().regex(/^[A-Z0-9]{3,4}$/),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
});
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("admin", "manager");
    const input = await readJson(request, requestSchema);
    const db = getDb();
    const created = await db.transaction(async (tx) => {
      const [sale] = await tx.select().from(sales).where(eq(sales.id, input.saleId)).for("update").limit(1);
      if (!sale || sale.status !== "completed") throw new ApiError(404, "SALE_NOT_FOUND", "Solo se pueden solicitar facturas para una venta completada.");
      const [existing] = await tx.select({ id: invoiceRequests.id }).from(invoiceRequests).where(eq(invoiceRequests.saleId, sale.id)).limit(1);
      if (existing) throw new ApiError(409, "INVOICE_REQUEST_EXISTS", "Este ticket ya tiene una solicitud de factura.");
      const [requestRecord] = await tx.insert(invoiceRequests).values({
        saleId: sale.id,
        rfc: input.rfc,
        legalName: input.legalName,
        postalCode: input.postalCode,
        fiscalRegime: input.fiscalRegime,
        cfdiUse: input.cfdiUse,
        email: input.email || null,
        status: "pending_pac",
        requestedBy: user.name,
      }).returning();
      await tx.insert(auditEvents).values({ actorId: user.id, actorName: user.name, action: "invoice.request.created", entityType: "invoice_request", entityId: requestRecord.id, summary: `Solicitud de CFDI para ticket ${sale.ticketNumber}; pendiente de PAC.`, metadata: { saleId: sale.id, rfc: input.rfc, status: "pending_pac" } });
      return { ...requestRecord, ticketNumber: sale.ticketNumber, email: requestRecord.email || "", createdAt: requestRecord.createdAt.toISOString() };
    });
    return Response.json({ request: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === "23505") return jsonError(new ApiError(409, "INVOICE_REQUEST_EXISTS", "Este ticket ya tiene una solicitud de factura."));
    return jsonError(error);
  }
}
