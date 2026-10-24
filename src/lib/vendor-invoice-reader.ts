/** Loaded only in the upload handler so PDF.js never enters server execution. */
export async function readInvoicePdf(file: File) {
  if (file.size > 20 * 1024 * 1024) throw new Error("Invoice must be under 20 MB");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 50) throw new Error("Invoice must be under 50 pages");
    let text = "";
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      for (const item of content.items) if ("str" in item) text += `${item.str}${item.hasEOL ? "\n" : " "}`;
      text += "\n";
    }
    return text;
  } finally { await task.destroy(); }
}