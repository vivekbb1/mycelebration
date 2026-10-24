import { it } from "node:test";
import { strictEqual, throws } from "node:assert";
import { invoiceMatches, invoiceOrderItems, parseVendorInvoice, pendingOrderLook, validateInvoiceShopModel } from "./vendor-invoice";
import type { OrderItem } from "./shop-order";

const text = "ORDER NO : 100581221 DATE : 20-10-2026 ROPK112508-BO-S ROSA by Priyanka kar 1 ₹33,000.00 ₹8,250.00 ₹24,750.00 ORDER TAKEN BY Muskaan Oberoi TOTAL AMOUNT ₹33,000.00 TOTAL PAYABLE ₹24,750.00 TOTAL PAID ₹20,000.00 AMOUNT DUE ₹4,750.00";
it("only attaches fetched Pernia details to the invoice's exact model", () => {
  validateInvoiceShopModel("ROPK112508", "ropk112508");
  throws(() => validateInvoiceShopModel("ROPK112508", "ROPK1125080"));
  throws(() => validateInvoiceShopModel("ROPK112508", ""));
});
it("a newly host-assigned reservation can be matched to an invoice without changing its requested size", () => {
  const item = { reservationId: "new-host-assignment", wearer: "New guest", event: "Wedding", sku: "ROPK112508", size: "L", price: 30000, originalPrice: 30000 } as OrderItem;
  const result = invoiceOrderItems(parseVendorInvoice(text), [item], [[item.reservationId]], [["look"]]);
  strictEqual(result[0]?.reservationId, "new-host-assignment");
  strictEqual(result[0]?.size, "L");
  strictEqual(result[0]?.orderedSize, "S");
});
it("reconciles invoice 100582304 including both size suffixes without BO and partial payment", () => {
  const invoiceText = `ORDER NO : 100582304 DATE : 24-10-2026
SUPA062236-BO-L Suruchi Parakh 1 ₹34,500.00 ₹3,450.00 ₹31,050.00
SUPA022446-BO-L Suruchi Parakh 1 ₹29,500.00 ₹2,950.00 ₹26,550.00
SPBC052618-BO-XXL Spring Break Men 1 ₹24,990.00 ₹3,748.00 ₹21,242.00
ZOOP102480-BO-M Zoop Men 1 ₹20,990.00 ₹2,099.00 ₹18,891.00
KASB052607-BO-XXL Kasbah Clothing 1 ₹24,400.00 ₹3,660.00 ₹20,740.00
KASB082443-BO-XXL Kasbah Clothing 1 ₹4,840.00 ₹242.00 ₹4,598.00
SPBC052615-BO-XXL Spring Break Men 1 ₹24,990.00 ₹3,748.00 ₹21,242.00
SPBC102657-XXL Spring Break Men 1 ₹6,000.00 ₹300.00 ₹5,700.00
SPBC102658-XXL Spring Break Men 1 ₹6,000.00 ₹300.00 ₹5,700.00
SABH072636-BO-3XL SALIL BHATIA 1 ₹43,200.00 ₹6,480.00 ₹36,720.00
SABH092505-BO-3XL SALIL BHATIA 1 ₹42,000.00 ₹6,300.00 ₹35,700.00
ORDER TAKEN BY Muskaan Oberoi TOTAL AMOUNT ₹261,410.00
TOTAL DISCOUNT -₹33,277.00 TOTAL PAYABLE ₹228,133.00
TOTAL PAID ₹182,500.00 AMOUNT DUE ₹45,633.00`;
  const invoice = parseVendorInvoice(invoiceText);
  strictEqual(invoice.lines.length, 11);
  strictEqual(invoice.lines[7]?.sku, "SPBC102657");
  strictEqual(invoice.lines[8]?.sku, "SPBC102658");
  strictEqual(invoice.lines[7]?.orderedSize, "XXL");
  strictEqual(invoice.lines[8]?.orderedSize, "XXL");
  strictEqual(invoice.lines[7]?.net, 5700);
  strictEqual(invoice.lines[8]?.net, 5700);
  strictEqual(invoice.total, 228133);
  strictEqual(invoice.paid, 182500);
  strictEqual(invoice.due, 45633);
  strictEqual(invoice.stylist, "Muskaan Oberoi");
  throws(() => parseVendorInvoice(invoiceText.replace("₹45,633.00", "₹45,634.00")));
});
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
it("assigns an unmatched invoice line to a person as an alternative or as trousers on a look", () => {
  const i = parseVendorInvoice("ORDER NO : 2 DATE : 21-10-2026 ROPK112508-BO-S X 1 ₹10,000.00 ₹0.00 ₹10,000.00 TRSR000001-BO-32 Y 1 ₹3,000.00 ₹500.00 ₹2,500.00 ORDER TAKEN BY M TOTAL AMOUNT ₹1 TOTAL PAYABLE ₹12,500.00 TOTAL PAID ₹12,500.00 AMOUNT DUE ₹0.00");
  const a = { reservationId: "a", sku: "OTHER1", size: "M", price: 9000, discount: 0, title: "Guest look" } as OrderItem;
  const alt = invoiceOrderItems(i, [a], [["a"], ["a"]], [["alternative"], ["addon"]]);
  strictEqual(alt.length, 1); strictEqual(alt[0]?.title, "Guest look"); strictEqual(alt[0]?.size, "M");
  strictEqual(alt[0]?.alternative?.sku, "ROPK112508"); strictEqual(alt[0]?.addOns?.[0]?.sku, "TRSR000001"); strictEqual(alt[0]?.addOns?.[0]?.size, "32");
  throws(() => invoiceOrderItems(i, [a], [["a"], ["a"]], [["alternative"], ["alternative"]]));
});
