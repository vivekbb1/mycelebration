import { PDFDocument, PDFString, StandardFonts, rgb } from "pdf-lib";
import { money, orderTotals, type OrderItem, type OrderPayment } from "./shop-order";

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
    text(`Guest requested size: ${item.size || "Not supplied"}`);
    text(`Actual size ordered: ${item.orderedSize || "Not recorded"}`, true);
    text(`Original uploaded price: ${item.originalPrice != null ? `${currency} ${money(item.originalPrice, currency)}` : "Not recorded"}`);
    text(`Revised price: ${currency} ${money(item.price, currency)} | Discount: ${currency} ${money(item.discount, currency)} | Discounted price: ${currency} ${money((item.price - item.discount), currency)}`);
    text(`Shop: ${item.shop || "Not supplied"}`);
    if (item.alternative) {
      text("ORDER THIS ALTERNATIVE INSTEAD", true);
      text(`${item.alternative.title || "Alternative"} | ${item.alternative.designer || "Designer not supplied"} | SKU: ${item.alternative.sku || "Not supplied"}`);
      if (item.alternative.shop) text(`Shop: ${item.alternative.shop}`);
    }
    for (const a of item.addOns ?? []) {
      text(`Extra item: ${a.label}`, true);
      text(`SKU: ${a.sku || "Not supplied"} | Size: ${a.size || "Not recorded"} | Price: ${currency} ${money(a.price, currency)} | Discount: ${currency} ${money(a.discount, currency)} | Discounted: ${currency} ${money(a.price - a.discount, currency)}`);
      if (a.shop) text(`Shop: ${a.shop}`);
      if (a.notes) text(`Notes: ${a.notes}`);
    }
    text("Wearer measurements", true);
    text(item.measurements ? Object.entries(item.measurements).map(([k, v]) => `${k.replaceAll("_", " ")}: ${v}`).join(" | ") : "Measurements not supplied");
    if (item.notes) text(`Customisations: ${item.notes}`);
    if (notes) text(`Order discussion: ${notes}`);
    text(`Group total: ${currency} ${money(totals.total, currency)} | Paid: ${currency} ${money(totals.paid, currency)} | Balance: ${currency} ${money(totals.balance, currency)}`, true);
  }
  return pdf.save();
}

export async function downloadShopOrderPdf(...args: Parameters<typeof buildShopOrderPdf>) {
  const bytes = await buildShopOrderPdf(...args);
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
  const a = document.createElement("a"); a.href = url; a.download = `shop-order-${args[0].replace(/[^a-z0-9-]/gi, "-")}.pdf`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export type PreorderLine = { wearer: string; family: string; event: string; title: string; designer: string; sku: string; size: string; suggested: string; status: string; price: string; amount?: number | null; measurements: string; shop: string; image: string; notes: string };

/** One-document pre-order list for the stylist to review before anything is ordered. */
export async function buildPreorderPdf(title: string, subtitle: string, lines: PreorderLine[]) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const clean = (s: string) => s.replace(/[₹]/g, "INR ").replace(/[–—]/g, "-").replace(/[·]/g, "|").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
  const accent = rgb(.55, .27, .12);
  let page = pdf.addPage([595, 842]); let y = 800;
  const wrap = (value: string, size: number, font = regular, width = 330) => {
    const out: string[] = []; let line = "";
    for (const word of clean(value).split(/\s+/)) { if (font.widthOfTextAtSize(`${line} ${word}`, size) > width && line) { out.push(line); line = word; } else line += `${line ? " " : ""}${word}`; }
    if (line) out.push(line); return out;
  };
  const right = (p: typeof page, t: string, yy: number, size: number, font = bold, color = accent) => {
    const s = clean(t); p.drawText(s, { x: 555 - font.widthOfTextAtSize(s, size), y: yy, size, font, color });
  };
  page.drawText(clean(title), { x: 40, y, size: 18, font: bold }); y -= 18;
  page.drawText(clean(`${subtitle} | ${lines.length} outfits | ${new Date().toLocaleDateString("en-GB")}`), { x: 40, y, size: 9, font: regular, color: rgb(.35, .35, .35) }); y -= 22;
  let total = 0; let unpriced = 0;
  for (const [i, l] of lines.entries()) {
    if (l.amount != null) total += l.amount; else unpriced++;
    const nameLines = wrap(l.wearer, 9.5, bold).map((t) => ({ t, font: bold, size: 9.5 }));
    const body = [
      `${l.designer}${l.sku ? ` | SKU ${l.sku}` : ""}`,
      `${l.family} | ${l.event}`,
      `Size: ${l.size || "Not chosen"}${l.suggested ? ` (suggested ${l.suggested})` : ""} | ${l.status}`,
      `Measurements: ${l.measurements || "Not supplied"}`,
      ...(l.notes ? [`Notes: ${l.notes}`] : []),
    ].flatMap((t) => wrap(t, 8.5)).map((t) => ({ t, font: regular, size: 8.5 }));
    const head = wrap(`${i + 1}. ${l.title}`, 10, bold);
    const h = Math.max(96, head.length * 13 + (nameLines.length + body.length + (l.shop ? 1 : 0)) * 11 + 8);
    if (y - h < 60) { page = pdf.addPage([595, 842]); y = 800; }
    let ty = y;
    const img = l.image ? await embedLookPhoto(pdf, l.image) : null;
    if (img) { const sc = img.scaleToFit(85, 120); page.drawImage(img, { x: 40, y: y - sc.height, width: sc.width, height: sc.height }); }
    let ty = y - 12;
    for (const b of body) { page.drawText(b.t, { x: 140, y: ty, size: b.size, font: b.font, color: b.t.startsWith("Updated") ? accent : rgb(.12, .12, .12) }); ty -= 14; }
    y -= h + 6;
    page.drawLine({ start: { x: 40, y: y + 3 }, end: { x: 555, y: y + 3 }, thickness: .5, color: rgb(.85, .85, .85) });
  }
  const pages = pdf.getPages();
  pages.forEach((p, n) => { const pt = `Page ${n + 1} of ${pages.length}`; p.drawText(pt, { x: 555 - regular.widthOfTextAtSize(pt, 8), y: 22, size: 8, font: regular, color: rgb(.4, .4, .4) }); });
  return new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" });
}

/** Same-origin copy of a look photo (our stored copies, cached shop photos) so the browser can read it. */
export function pdfPhotoUrl(src: string) {
  if (src.startsWith("/api/public/outfit-image/")) return `${src.split("?")[0]}?w=400`;
  if (/^https:\/\/[^/]*perniaspopupshop\.com\//i.test(src)) return `/api/public/shop-image?w=400&u=${encodeURIComponent(src)}`;
  return src;
}

/** Loads any photo format (JPG/PNG/WebP/AVIF) and re-encodes it as JPEG for the PDF; null if unreadable. */
async function embedLookPhoto(pdf: PDFDocument, src: string) {
  const tries = [...new Set([pdfPhotoUrl(src), src])];
  for (const url of tries) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!blob.type.startsWith("image/") && blob.size < 100) continue;
      const bitmap = await createImageBitmap(blob);
      const scale = Math.min(1, 600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d"); if (!ctx) continue;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const jpg = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
      if (!jpg) continue;
      return await pdf.embedJpg(await jpg.arrayBuffer());
    } catch { /* try next source */ }
  }
  return null;
}
