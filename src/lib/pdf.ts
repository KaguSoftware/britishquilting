/**
 * Turns a printed document on screen (an invoice, a delivery note) into an A4 PDF file and downloads it.
 * Each `[data-sheet]` element inside the target becomes one page. Client only: the libraries load on
 * first use so they stay out of the page bundles.
 */

const A4 = { w: 210, h: 297 };

export async function downloadPdf(el: HTMLElement, filename: string) {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  await document.fonts.ready;

  const sheets = Array.from(el.querySelectorAll<HTMLElement>("[data-sheet]"));
  if (!sheets.length) sheets.push(el);
  const opts = { pixelRatio: 2, backgroundColor: "#ffffff", style: { margin: "0", boxShadow: "none" } };
  // Safari can leave web fonts out of the first capture, so it gets a warm-up run.
  if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) await toCanvas(sheets[0], opts);

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  for (const [i, sheet] of sheets.entries()) {
    const canvas = await toCanvas(sheet, opts);
    if (i) pdf.addPage();
    const h = Math.min(A4.h, (canvas.height / canvas.width) * A4.w);
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, A4.w, h);
  }
  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
