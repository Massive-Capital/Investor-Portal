import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { esignW9PdfExists, getEsignW9PdfPath } from "../../config/esignW9.config.js";

export function isPdfFileName(name: string): boolean {
  return String(name ?? "").trim().toLowerCase().endsWith(".pdf");
}

export function isPdfUploadFile(file: {
  originalname?: string;
  mimetype?: string;
}): boolean {
  const name = String(file.originalname ?? "").trim().toLowerCase();
  if (name.endsWith(".pdf")) return true;
  const mime = String(file.mimetype ?? "").trim().toLowerCase();
  return mime === "application/pdf";
}

/**
 * Appends all pages of `fw9.pdf` after the main document. Returns the original
 * buffer when W-9 is missing or merge fails (logged).
 */
export async function appendW9ToPdfBuffer(
  mainPdf: Buffer,
): Promise<{ buffer: Buffer; w9Appended: boolean }> {
  if (!esignW9PdfExists()) {
    console.warn(
      "[esign] W-9 PDF not found at",
      getEsignW9PdfPath(),
      "— uploading without W-9 appendix",
    );
    return { buffer: mainPdf, w9Appended: false };
  }

  try {
    const w9Bytes = await readFile(getEsignW9PdfPath());
    const merged = await PDFDocument.create();
    const mainDoc = await PDFDocument.load(mainPdf, { ignoreEncryption: true });
    const w9Doc = await PDFDocument.load(w9Bytes, { ignoreEncryption: true });

    const mainPages = await merged.copyPages(mainDoc, mainDoc.getPageIndices());
    for (const page of mainPages) merged.addPage(page);

    const w9Pages = await merged.copyPages(w9Doc, w9Doc.getPageIndices());
    for (const page of w9Pages) merged.addPage(page);

    const out = Buffer.from(await merged.save());
    return { buffer: out, w9Appended: true };
  } catch (err) {
    console.error("[esign] Failed to append W-9 PDF:", err);
    return { buffer: mainPdf, w9Appended: false };
  }
}
