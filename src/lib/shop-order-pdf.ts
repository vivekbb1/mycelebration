import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { orderTotals, type OrderItem, type OrderPayment } from "./shop-order";

export async function buildShopOrderPdf(reference: string, shop: string, currency: string, items: OrderItem[], payments: OrderPayment[], notes: string) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const clean = (s: string) => s.replace(/[₹]/g, "INR ").replace(/[–—]/g, "-").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
  const totals = orderTotals(items, payments);
  for (let index = 0; index < items.length; index++) {
    const item = items[index]; if (!item) continue;
    let page = pdf.addPage([595, 842]); let y = 790;
    const text = (value: string, heading = false) => {
      const font = heading ? bold : regular; const size = heading ? 12 : 10;
      const words = clean(value).split(/\s+/).flatMap((word) => {
        const parts: string[] = []; let part = "";
        for (const char of word) { if (font.widthOfTextAtSize(part + char, size) > 500) { parts.push(part); part = char; } else part += char; }
        if (part) parts.push(part); return parts;
      }); let line = "";
      const draw = () => { if (y < 55) { page = pdf.addPage([595, 842]); y = 790; } page.drawText(line, { x: 42, y, size, font, color: rgb(.12, .12, .12) }); y -= 16; };
      for (const word of words) { if (font.widthOfTextAtSize(`${line} ${word}`, size) > 510 && line) { draw(); line = word; } else line += `${line ? " " : ""}${word}`; }
      if (line) draw(); y -= 5;
    };
    text(`SHOP ORDER / ENQUIRY - ${reference}`, true);
    text(`${shop || "Shop to confirm"} | ${index + 1} of ${items.length} looks | ${new Date().toLocaleDateString("en-GB")}`);
    text("For offline discussion: confirm stock, discounts, customisations and delivery before purchase.");
    if (item.image) { try {
      const response = await fetch(item.image); if (!response.ok) throw new Error("Photo unavailable");
      const bytes = await response.arrayBuffer(); const mime = response.headers.get("content-type") ?? "";
      const image = mime.includes("png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const scaled = image.scaleToFit(150, 165); page.drawImage(image, { x: 42, y: y - scaled.height, width: scaled.width, height: scaled.height }); y -= scaled.height + 18;
    } catch { text("Photo unavailable; see shop link below."); } }
    text(item.title, true); text(`${item.designer} | SKU: ${item.sku || "Not supplied"}`);
    text(`Wearer: ${item.wearer} | Family: ${item.family} | Event: ${item.event}`);
    text(`Selected size: ${item.size || "Not supplied"}`);
    text(`Price: ${currency} ${item.price.toFixed(2)} | Discount: ${currency} ${item.discount.toFixed(2)} | Net: ${currency} ${(item.price - item.discount).toFixed(2)}`);
    text(`Shop: ${item.shop || "Not supplied"}`);
    text("Wearer measurements", true);
    text(item.measurements ? Object.entries(item.measurements).map(([k, v]) => `${k.replaceAll("_", " ")}: ${v}`).join(" | ") : "Measurements not supplied");
    if (item.notes) text(`Customisations: ${item.notes}`);
    if (notes) text(`Order discussion: ${notes}`);
    text(`Group total: ${currency} ${totals.total.toFixed(2)} | Paid: ${currency} ${totals.paid.toFixed(2)} | Balance: ${currency} ${totals.balance.toFixed(2)}`, true);
  }
  return pdf.save();
}

export async function downloadShopOrderPdf(...args: Parameters<typeof buildShopOrderPdf>) {
  const bytes = await buildShopOrderPdf(...args);
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
  const a = document.createElement("a"); a.href = url; a.download = `shop-order-${args[0].replace(/[^a-z0-9-]/gi, "-")}.pdf`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}