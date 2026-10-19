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
    text(`Selected size: ${item.size || "Not supplied"}`);
    text(`Price: ${currency} ${money(item.price, currency)} | Discount: ${currency} ${money(item.discount, currency)} | Net: ${currency} ${money((item.price - item.discount), currency)}`);
    text(`Shop: ${item.shop || "Not supplied"}`);
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
    if (l.image) { try {
      const res = await fetch(l.image, { signal: AbortSignal.timeout(6000) }); if (!res.ok) throw new Error();
      const bytes = await res.arrayBuffer(); const mime = res.headers.get("content-type") ?? "";
      const img = mime.includes("png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const s = img.scaleToFit(64, 90); page.drawImage(img, { x: 40, y: y - s.height, width: s.width, height: s.height });
    } catch { /* photo optional */ } }
    // Highlighted price, right aligned
    const priceText = clean(l.price); const pw = bold.widthOfTextAtSize(priceText, 11);
    page.drawRectangle({ x: 555 - pw - 8, y: y - 15, width: pw + 8, height: 16, color: rgb(.98, .93, .86) });
    right(page, priceText, y - 11, 11, bold, accent);
    for (const t of head) { page.drawText(t, { x: 120, y: ty - 10, size: 10, font: bold }); ty -= 13; }
    for (const b of [...nameLines, ...body]) { page.drawText(b.t, { x: 120, y: ty - 9, size: b.size, font: b.font, color: rgb(.15, .15, .15) }); ty -= 11; }
    if (l.shop && /^https?:\/\//i.test(l.shop)) {
      const label = "Open in shop >"; const lw = regular.widthOfTextAtSize(label, 8.5); const ly = ty - 9;
      const blue = rgb(.1, .3, .75);
      page.drawText(label, { x: 120, y: ly, size: 8.5, font: regular, color: blue });
      page.drawLine({ start: { x: 120, y: ly - 1.5 }, end: { x: 120 + lw, y: ly - 1.5 }, thickness: .5, color: blue });
      const annot = pdf.context.register(pdf.context.obj({
        Type: "Annot", Subtype: "Link", Rect: [118, ly - 3, 122 + lw, ly + 9], Border: [0, 0, 0],
        A: { Type: "Action", S: "URI", URI: PDFString.of(l.shop) },
      }));
      page.node.addAnnot(annot);
      ty -= 11;
    }
    y -= h + 6;
    page.drawLine({ start: { x: 40, y: y + 3 }, end: { x: 555, y: y + 3 }, thickness: .5, color: rgb(.85, .85, .85) });
  }
  if (y < 100) { page = pdf.addPage([595, 842]); y = 800; }
  y -= 14;
  page.drawLine({ start: { x: 330, y: y + 16 }, end: { x: 555, y: y + 16 }, thickness: 1, color: accent });
  page.drawText(`Total (${lines.length} outfits)`, { x: 330, y, size: 12, font: bold });
  right(page, `INR ${money(total, "INR")}`, y, 12);
  if (unpriced) { y -= 14; right(page, `${unpriced} outfit${unpriced > 1 ? "s" : ""} without a price not included`, y, 8, regular, rgb(.4, .4, .4)); }
  const pages = pdf.getPages();
  pages.forEach((p, n) => {
    p.drawLine({ start: { x: 40, y: 34 }, end: { x: 555, y: 34 }, thickness: .5, color: rgb(.85, .85, .85) });
    p.drawText("mycelebration.app", { x: 40, y: 22, size: 8, font: regular, color: rgb(.4, .4, .4) });
    const pt = `Page ${n + 1} of ${pages.length}`;
    p.drawText(pt, { x: 555 - regular.widthOfTextAtSize(pt, 8), y: 22, size: 8, font: regular, color: rgb(.4, .4, .4) });
  });
  const bytes = await pdf.save();
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
