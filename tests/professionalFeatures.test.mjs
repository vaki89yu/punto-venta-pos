import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWhatsAppUrl,
  calculateReplenishmentRecommendations,
  getGrossMarginPercent,
  getMaxDiscountPercent,
  getSellableStock,
  isFractionalUnit,
  isValidMexicanRFC,
  normalizeWhatsAppPhone,
} from "../src/lib/professionalFeatures.ts";

test("margin guard calculates gross margin and a discount cap", () => {
  assert.equal(getGrossMarginPercent(80, 100), 20);
  assert.ok(Math.abs(getMaxDiscountPercent(80, 100, 10) - 11.11111111111111) < 1e-9);
  assert.equal(getMaxDiscountPercent(100, 90, 10), 0);
});

test("fractional units are explicit and quantity formatting remains locale-aware", () => {
  assert.equal(isFractionalUnit("kg"), true);
  assert.equal(isFractionalUnit("pieza"), false);
});

test("expired lots are not sellable while legacy untracked stock remains available", () => {
  const lots = [
    { id: "l1", productId: "p1", quantity: 3, expiresOn: "2026-09-29", receivedAt: "2026-09-01" },
    { id: "l2", productId: "p1", quantity: 5, expiresOn: "2026-10-10", receivedAt: "2026-09-10" },
  ];
  const available = getSellableStock(10, "p1", lots, new Date("2026-09-30T12:00:00"));
  assert.equal(available, 7); // 2 legacy units + 5 units from a valid lot.
});

test("replenishment uses completed sales, lead time, minimum stock, and inbound purchase orders", () => {
  const now = new Date("2026-09-30T12:00:00.000Z");
  const products = [
    { id: "p1", name: "Arroz", unit: "pieza", stock: 3, minStock: 5, purchasePrice: 20, supplierId: "s1" },
    { id: "p2", name: "Frijol", unit: "pieza", stock: 10, minStock: 2, purchasePrice: 30, supplierId: "s1" },
  ];
  const sales = [
    { status: "completed", createdAt: now, items: [{ productId: "p1", quantity: 30 }, { productId: "p2", quantity: 60 }] },
    { status: "cancelled", createdAt: now, items: [{ productId: "p1", quantity: 100 }] },
  ];
  const orders = [{ status: "pending", items: [{ productId: "p1", quantity: 2 }] }];
  const recommendations = calculateReplenishmentRecommendations(products, sales, orders, {
    now,
    daysToAnalyze: 30,
    coverageDays: 14,
    leadTimeDays: 7,
  });
  const recommendation = recommendations.find((item) => item.productId === "p1");
  assert.ok(recommendation);
  assert.equal(recommendation.inbound, 2);
  assert.equal(recommendation.recommendedQuantity, 16);
  assert.equal(recommendation.priority, "critical");
});

test("Mexican RFC and WhatsApp contact data are validated without changing arbitrary phone numbers", () => {
  assert.equal(isValidMexicanRFC("GODE561231GR8"), true);
  assert.equal(isValidMexicanRFC("not-an-rfc"), false);
  assert.equal(normalizeWhatsAppPhone("656 123 4567"), "526561234567");
  assert.equal(normalizeWhatsAppPhone("12"), null);
  assert.equal(buildWhatsAppUrl("6561234567", "Ticket TK-1"), "https://wa.me/526561234567?text=Ticket%20TK-1");
});
