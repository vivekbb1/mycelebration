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
export type PreorderLine = { wearer: string; family: string; event: string; title: string; designer: string; sku: string; size: string; suggested: string; status: string; price: string; measurements: string; shop: string; image: string; notes: string };

/** One-document pre-order list for the stylist to review before anything is ordered. */
export async function downloadPreorderPdf(title: string, lines: PreorderLine[]) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const clean = (s: string) => s.replace(/[₹]/g, "INR ").replace(/[–—]/g, "-").replace(/[·]/g, "|").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
  let page = pdf.addPage([595, 842]); let y = 800;
  const wrap = (value: string, size: number, font = regular, width = 400) => {
    const out: string[] = []; let line = "";
    for (const word of clean(value).split(/\s+/)) { if (font.widthOfTextAtSize(`${line} ${word}`, size) > width && line) { out.push(line); line = word; } else line += `${line ? " " : ""}${word}`; }
    if (line) out.push(line); return out;
  };
  page.drawText(clean(title), { x: 40, y, size: 14, font: bold }); y -= 18;
  page.drawText(clean(`Pre-order list for review | ${lines.length} outfits | ${new Date().toLocaleDateString("en-GB")}`), { x: 40, y, size: 9, font: regular, color: rgb(.35, .35, .35) }); y -= 22;
  for (const [i, l] of lines.entries()) {
    const body = [
      `${l.designer}${l.sku ? ` | SKU ${l.sku}` : ""}`,
      `Wearer: ${l.wearer} | ${l.family} | ${l.event}`,
      `Size: ${l.size || "Not chosen"}${l.suggested ? ` (suggested ${l.suggested})` : ""} | ${l.status} | Price: ${l.price}`,
      `Measurements: ${l.measurements || "Not supplied"}`,
      ...(l.notes ? [`Notes: ${l.notes}`] : []),
      ...(l.shop ? [`Shop: ${l.shop}`] : []),
    ].flatMap((t) => wrap(t, 8.5));
    const head = wrap(`${i + 1}. ${l.title}`, 10, bold);
    const h = Math.max(96, head.length * 13 + body.length * 11 + 8);
    if (y - h < 40) { page = pdf.addPage([595, 842]); y = 800; }
    let ty = y;
    if (l.image) { try {
      const res = await fetch(l.image); if (!res.ok) throw new Error();
      const bytes = await res.arrayBuffer(); const mime = res.headers.get("content-type") ?? "";
      const img = mime.includes("png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const s = img.scaleToFit(64, 90); page.drawImage(img, { x: 40, y: y - s.height, width: s.width, height: s.height });
    } catch { /* photo optional */ } }
    for (const t of head) { page.drawText(t, { x: 120, y: ty - 10, size: 10, font: bold }); ty -= 13; }
    for (const t of body) { page.drawText(t, { x: 120, y: ty - 9, size: 8.5, font: regular, color: rgb(.2, .2, .2) }); ty -= 11; }
    y -= h + 6;
    page.drawLine({ start: { x: 40, y: y + 3 }, end: { x: 555, y: y + 3 }, thickness: .5, color: rgb(.85, .85, .85) });
  }
  const bytes = await pdf.save();
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
  const a = document.createElement("a"); a.href = url; a.download = `pre-order-${new Date().toISOString().slice(0, 10)}.pdf`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
