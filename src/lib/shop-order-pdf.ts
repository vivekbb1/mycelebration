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
    p.drawText(pt, { x: p.getWidth() - 40 - regular.widthOfTextAtSize(pt, 8), y: 22, size: 8, font: regular, color: rgb(.4, .4, .4) });
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

export type FamilyLookLine = { wearer: string; event: string; title: string; image: string; size: string; orderedSize: string; substituted: boolean; originalTitle?: string; extras: { label: string; size: string }[]; note: string };

const FAMILY_SIZING_NOTE = "The outfits have been ordered in sizes recommended by the respective designers based on the measurements shared. A tailor will be available on-site to assist with any necessary fitting adjustments and critical alterations.";

/** Family reconfirmation sheet: photos, look names and sizes only — never prices, model numbers or shop details. */
export async function buildFamilyLooksPdf(family: string, celebration: string, lines: FamilyLookLine[]) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const clean = (s: string) => s.replace(/[–—]/g, "-").replace(/[·]/g, "|").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
  const accent = rgb(.55, .27, .12);
  const wrap = (value: string, size: number, font = regular, width = 360) => {
    const out: string[] = []; let line = "";
    for (const word of clean(value).split(/\s+/)) { if (font.widthOfTextAtSize(`${line} ${word}`, size) > width && line) { out.push(line); line = word; } else line += `${line ? " " : ""}${word}`; }
    if (line) out.push(line); return out;
  };
  let page = pdf.addPage([595, 842]); let y = 800;
  page.drawText(clean(celebration), { x: 40, y, size: 20, font: bold, color: accent }); y -= 22;
  page.drawText(clean(`${family} - Outfits Ordered`), { x: 40, y, size: 14, font: bold }); y -= 16;
  page.drawText(clean(`${lines.length} looks | ${new Date().toLocaleDateString("en-GB")}`), { x: 40, y, size: 9, font: regular, color: rgb(.35, .35, .35) }); y -= 16;
  for (const t of wrap("Please check each look and size below and tell your hosts about any last-minute changes.", 9.5, regular, 515)) { page.drawText(t, { x: 40, y, size: 9.5, font: regular }); y -= 13; }
  y -= 10;
  for (const l of lines) {
    const body = [
      { t: `${l.wearer} | ${l.event}`, font: bold, size: 11 },
      ...wrap(l.title, 10).map((t) => ({ t, font: regular, size: 10 })),
      ...(l.substituted ? wrap(l.originalTitle ? `Updated look - replaces: ${l.originalTitle}` : "Updated look (replaces the original choice)", 8.5, bold).map((t) => ({ t, font: bold, size: 8.5 })) : []),
      { t: `Size you chose: ${l.size || "Not recorded"}   |   Size ordered: ${l.orderedSize || "To be confirmed"}`, font: regular, size: 9.5 },
      ...l.extras.flatMap((e) => wrap(`Also included: ${e.label}${e.size ? ` (size ${e.size})` : ""}`, 9.5)).map((t) => ({ t, font: regular, size: 9.5 })),
      ...(l.note ? wrap(`Note: ${l.note}`, 9.5).map((t) => ({ t, font: regular, size: 9.5 })) : []),
    ];
    const h = Math.max(130, body.length * 14 + 10);
    if (y - h < 60) { page = pdf.addPage([595, 842]); y = 800; }
    const img = l.image ? await embedLookPhoto(pdf, l.image) : null;
    if (img) { const sc = img.scaleToFit(85, 120); page.drawImage(img, { x: 40, y: y - sc.height, width: sc.width, height: sc.height }); }
    let ty = y - 12;
    for (const b of body) { page.drawText(b.t, { x: 140, y: ty, size: b.size, font: b.font, color: b.t.startsWith("Updated") ? accent : rgb(.12, .12, .12) }); ty -= 14; }
    y -= h + 6;
    page.drawLine({ start: { x: 40, y: y + 3 }, end: { x: 555, y: y + 3 }, thickness: .5, color: rgb(.85, .85, .85) });
  }
  const sizingNoteLines = wrap(FAMILY_SIZING_NOTE, 10, regular, 515);
  const sizingNoteHeight = sizingNoteLines.length * 14 + 20;
  if (y - sizingNoteHeight < 60) { page = pdf.addPage([595, 842]); y = 800; }
  y -= 16;
  for (const t of sizingNoteLines) { page.drawText(t, { x: 40, y, size: 10, font: regular, color: rgb(.12, .12, .12) }); y -= 14; }
  const pages = pdf.getPages();
  pages.forEach((p, n) => { const pt = `Page ${n + 1} of ${pages.length}`; p.drawText(pt, { x: p.getWidth() - 40 - regular.widthOfTextAtSize(pt, 8), y: 22, size: 8, font: regular, color: rgb(.4, .4, .4) }); p.drawText("mycelebration.app", { x: 40, y: 22, size: 8, font: bold, color: accent }); });
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

export type ArrivalLine = { group: string; wearer: string; family: string; event: string; title: string; orderedSize: string; reference: string; shop: string; expected: string; arrived: string; courier: string; tracking: string; originalTitle: string; originalImage: string; originalSku: string; replacementTitle?: string; replacementImage?: string; replacementSku?: string; price: string; requestedSize: string; note: string; extras: string[]; subgroup?: string };

/** Host-only arrival tracker: one row per outfit with selected/substituted photos, model references and discounted price. */
export async function buildArrivalsPdf(celebration: string, lines: ArrivalLine[]) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const clean = (s: string) => s.replace(/[₹]/g, "INR ").replace(/[–—]/g, "-").replace(/[·]/g, "|").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
  const fit = (s: string, w: number, size: number, font = regular) => { let t = clean(s); while (t && font.widthOfTextAtSize(t, size) > w) t = t.slice(0, -1); return t.length < clean(s).length ? `${t.slice(0, -1)}.` : t; };
  const accent = rgb(.55, .27, .12); const grey = rgb(.3, .3, .3);
  const W = 842, H = 595, ROW = 66;
  const cols = [[40, 84, "Selected / substitute"], [130, 105, "Wearer / family"], [240, 175, "Event / look / model ref"], [420, 80, "Discounted price"], [505, 90, "Order"], [600, 60, "Expected"], [662, 60, "Arrived"], [724, 80, "Courier / tracking"]] as const;
  let page = pdf.addPage([W, H]); let y = H - 40;
  page.drawText(clean(`${celebration} - Outfit arrivals`), { x: 40, y, size: 16, font: bold, color: accent }); y -= 16;
  page.drawText(clean(`${lines.length} outfits | ${new Date().toLocaleDateString("en-GB")} | host only`), { x: 40, y, size: 9, font: regular, color: rgb(.35, .35, .35) }); y -= 20;
  const header = () => { for (const [x, , h] of cols) page.drawText(h, { x, y, size: 8, font: bold, color: rgb(.35, .35, .35) }); y -= 12; };
  const cache = new Map<string, Promise<Awaited<ReturnType<typeof embedLookPhoto>>>>();
  const load = (src: string) => { if (!cache.has(src)) cache.set(src, (async () => { for (let k = 0; k < 3; k++) { const r = await embedLookPhoto(pdf, src).catch(() => null); if (r) return r; await new Promise((ok) => setTimeout(ok, 400 * (k + 1))); } return null; })()); return cache.get(src)!; };
  const srcs = [...new Set(lines.flatMap((l) => [l.originalImage, l.replacementImage]).filter((x): x is string => !!x))];
  for (let k = 0; k < srcs.length; k += 4) await Promise.all(srcs.slice(k, k + 4).map(load));
  const photo = async (src: string | undefined, x: number, top: number, label: string) => {
    const img = src ? await load(src) : null;
    if (img) { const s = img.scaleToFit(38, 50); page.drawImage(img, { x, y: top - s.height, width: s.width, height: s.height }); }
    else page.drawRectangle({ x, y: top - 50, width: 38, height: 50, borderColor: rgb(.85, .85, .85), borderWidth: .5 });
    page.drawText(label, { x, y: top - 58, size: 6, font: regular, color: grey });
  };
  let group = ""; let sub = "";
  for (const l of lines) {
    const extra = l.extras.length + (l.note ? 1 : 0); const rowH = Math.max(ROW, 52 + extra * 10);
    if (y < 40 + rowH) { page = pdf.addPage([W, H]); y = H - 40; group = ""; sub = ""; }
    if (l.group !== group) { group = l.group; sub = ""; y -= 4; page.drawText(clean(group), { x: 40, y, size: 11, font: bold, color: accent }); y -= 14; header(); }
    if (l.subgroup && l.subgroup !== sub) { sub = l.subgroup; if (y < 40 + rowH + 14) { page = pdf.addPage([W, H]); y = H - 40; page.drawText(clean(`${group} (cont.)`), { x: 40, y, size: 11, font: bold, color: accent }); y -= 14; header(); } page.drawRectangle({ x: 40, y: y - 3, width: W - 80, height: 13, color: rgb(.96, .93, .89) }); page.drawText(fit(sub, W - 90, 9, bold), { x: 44, y, size: 9, font: bold }); y -= 16; }
    const top = y + 8;
    await photo(l.originalImage, 40, top, "Selected");
    if (l.replacementTitle) await photo(l.replacementImage, 84, top, "Substitute");
    const put = (n: number, rows: [string, boolean?][]) => { const [x, w] = cols[n]!; rows.forEach(([t, b], k) => { if (t) page.drawText(fit(t, w - 4, b ? 8.5 : 7.5, b ? bold : regular), { x, y: y - k * 10, size: b ? 8.5 : 7.5, font: b ? bold : regular, ...(b ? {} : { color: grey }) }); }); };
    put(1, [[l.wearer, true], [l.family], [`Requested: ${l.requestedSize || "-"}`], [`Ordered: ${l.orderedSize || "-"}`]]);
    put(2, [[l.event, true], [`Selected: ${l.originalTitle}`], [`Model ref: ${l.originalSku || "-"}`], ...(l.replacementTitle ? [[`Substitute: ${l.replacementTitle}`], [`Model ref: ${l.replacementSku || "-"}`]] as [string][] : [])]);
    put(3, [[l.price, true]]);
    let ny = y - 52; const nx = cols[2]![0];
    for (const e of l.extras) { page.drawText(fit(`+ Extra: ${e}`, W - 40 - nx, 7.5), { x: nx, y: ny, size: 7.5, font: regular, color: grey }); ny -= 10; }
    if (l.note) { page.drawText(fit(`Wearer note: ${l.note}`, W - 40 - nx, 7.5, bold), { x: nx, y: ny, size: 7.5, font: bold, color: accent }); }
    put(4, [[l.reference, true], [l.shop]]);
    put(5, [[l.expected || "-", true]]);
    put(6, [[l.arrived || "Not yet", true]]);
    put(7, [[l.courier || "-", true], [l.tracking]]);
    y -= rowH; page.drawLine({ start: { x: 40, y: y + 8 }, end: { x: W - 40, y: y + 8 }, thickness: .4, color: rgb(.88, .88, .88) });
  }
  const pages = pdf.getPages();
  pages.forEach((p, n) => { const pt = `Page ${n + 1} of ${pages.length}`; p.drawText(pt, { x: p.getWidth() - 40 - regular.widthOfTextAtSize(pt, 8), y: 22, size: 8, font: regular, color: rgb(.4, .4, .4) }); p.drawText("mycelebration.app", { x: 40, y: 22, size: 8, font: bold, color: accent }); });
  return new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" });
}
