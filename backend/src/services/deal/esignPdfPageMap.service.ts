import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import type { SignFlowField } from "../esign/signflow.service.js";

/** Stable fingerprint for a single PDF page (content-based). */
export async function computePdfPageFingerprints(buffer: Buffer): Promise<string[]> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const hashes: string[] = [];

  for (const idx of doc.getPageIndices()) {
    const single = await PDFDocument.create();
    const [page] = await single.copyPages(doc, [idx]);
    single.addPage(page);
    const bytes = await single.save();
    hashes.push(createHash("sha256").update(bytes).digest("hex").slice(0, 16));
  }

  return hashes;
}

/**
 * Maps 1-based template page numbers to 1-based signing PDF page numbers by
 * matching page fingerprints in order (handles prepended answer pages).
 */
export function buildTemplatePageToSigningPageMap(
  referenceHashes: string[],
  signingHashes: string[],
): Map<number, number> {
  const map = new Map<number, number>();
  let signingCursor = 0;

  for (let t = 0; t < referenceHashes.length; t++) {
    const refHash = referenceHashes[t];
    let matched = -1;

    for (let s = signingCursor; s < signingHashes.length; s++) {
      if (signingHashes[s] === refHash) {
        matched = s;
        break;
      }
    }

    if (matched >= 0) {
      map.set(t + 1, matched + 1);
      signingCursor = matched + 1;
    } else if (signingCursor < signingHashes.length) {
      map.set(t + 1, signingCursor + 1);
      signingCursor += 1;
    }
  }

  return map;
}

function resolveSigningPageForField(
  field: SignFlowField,
  pageMap: Map<number, number>,
  signingHashes: string[],
  referenceHashes: string[],
): number {
  const pageHash = field.pageHash?.trim();
  if (pageHash) {
    const byHash = signingHashes.indexOf(pageHash);
    if (byHash >= 0) return byHash + 1;
  }

  const templatePage = Math.max(
    1,
    Math.floor(field.templatePage ?? field.page),
  );
  const mapped = pageMap.get(templatePage);
  if (mapped != null) return mapped;

  const refHash = referenceHashes[templatePage - 1];
  if (refHash) {
    const byRefHash = signingHashes.indexOf(refHash);
    if (byRefHash >= 0) return byRefHash + 1;
  }

  return Math.max(1, Math.floor(field.page));
}

/**
 * Re-maps sponsor-placed field pages from the template PDF to the investor
 * signing PDF. x/y/width/height and profile scope are unchanged.
 */
export async function remapSignFlowFieldsToSigningPdf(
  fields: SignFlowField[],
  referencePdf: Buffer,
  signingPdf: Buffer,
): Promise<SignFlowField[]> {
  if (!fields.length) return fields;

  const [referenceHashes, signingHashes] = await Promise.all([
    computePdfPageFingerprints(referencePdf),
    computePdfPageFingerprints(signingPdf),
  ]);
  const pageMap = buildTemplatePageToSigningPageMap(
    referenceHashes,
    signingHashes,
  );

  return fields.map((field) => {
    const templatePage = Math.max(
      1,
      Math.floor(field.templatePage ?? field.page),
    );
    const page = resolveSigningPageForField(
      field,
      pageMap,
      signingHashes,
      referenceHashes,
    );
    return {
      ...field,
      page,
      templatePage,
      pageHash:
        field.pageHash?.trim() || referenceHashes[templatePage - 1] || undefined,
    };
  });
}
