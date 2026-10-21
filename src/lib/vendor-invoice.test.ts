import { it } from "node:test";
import { strictEqual, throws } from "node:assert";
import { invoiceMatches, invoiceOrderItems, parseVendorInvoice, pendingOrderLook } from "./vendor-invoice";
import type { OrderItem } from "./shop-order";

const text = "ORDER NO : 100581221 DATE : 20-10-2026 ROPK112508-BO-S ROSA by Priyanka kar 1 ₹33,000.00 ₹8,250.00 ₹24,750.00 ORDER TAKEN BY Muskaan Oberoi TOTAL AMOUNT ₹33,000.00 TOTAL PAYABLE ₹24,750.00 TOTAL PAID ₹20,000.00 AMOUNT DUE ₹4,750.00";
it("reads vendor reference, ordered size, discounts and stated partial payment", () => {
  const i = parseVendorInvoice(text);
  strictEqual(i.reference, "100581221"); strictEqual(i.date, "2026-10-20"); strictEqual(i.stylist, "Muskaan Oberoi");
  strictEqual(i.lines[0]?.sku, "ROPK112508"); strictEqual(i.lines[0]?.orderedSize, "S");
  strictEqual(i.lines[0]?.discount, 8250); strictEqual(i.total, 24750); strictEqual(i.paid, 20000); strictEqual(i.due, 4750);
});
it("matches exact model numbers, rejects ambiguous automatic matches and preserves guest sizes", () => {
  const a = { reservationId: "a", sku: "ROPK112508", size: "M", originalPrice: 30000, price: 30000 } as OrderItem;
  const b = { ...a, reservationId: "b" };
  const i = parseVendorInvoice(text);
  const line = i.lines[0];
  if (!line) throw new Error("Missing invoice line");
  strictEqual(invoiceMatches(line, [a, b, { ...a, sku: "ROPK1125080" }]).length, 2);
  throws(() => invoiceOrderItems(i, [a, b], [[]]));
  const selected = invoiceOrderItems(i, [a, b], [["b"]]);
  strictEqual(selected[0]?.reservationId, "b"); strictEqual(selected[0]?.size, "M"); strictEqual(selected[0]?.orderedSize, "S");
  strictEqual(selected[0]?.originalPrice, 30000); strictEqual(selected[0]?.price, 33000);
  strictEqual(selected[0]?.price - (selected[0]?.discount ?? 0), 24750);
});
it("ordered looks leave pending lists and return after cancellation", () => {
  strictEqual(pendingOrderLook("a", null, new Map([["a", "PERNIA-1"]])), false);
  strictEqual(pendingOrderLook("a", null, new Map()), true);
  strictEqual(pendingOrderLook("b", "2026-10-20", new Map()), false);
});
it("rejects invoices with inconsistent totals", () => throws(() => parseVendorInvoice(text.replace("₹4,750.00", "₹4,751.00"))));it("reads custom tailored lines without a size suffix", () => {
  const i = parseVendorInvoice("ORDER NO : 1 DATE : 21-10-2026 TUPO032424-Custom Tailored 1 ₹26,500.00 ₹1,325.00 ₹25,175.00 TushPosh KASB082443-BO-L 1 ₹4,840.00 ₹242.00 ₹4,598.00 ORDER TAKEN BY M TOTAL AMOUNT ₹1 TOTAL PAYABLE ₹29,773.00 TOTAL PAID ₹20,000.00 AMOUNT DUE ₹9,773.00");
  strictEqual(i.lines.length, 2); strictEqual(i.lines[0]?.sku, "TUPO032424"); strictEqual(i.lines[0]?.orderedSize, "Custom tailored");
});
