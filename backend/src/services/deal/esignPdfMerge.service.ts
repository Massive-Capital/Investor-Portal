import { readFile } from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import type { DropboxSignFormFieldPerDocument } from "../esign/dropboxSign.service.js";
import {
  esignQuestionnaireSignatureImageExists,
  esignQuestionnaireSignaturePdfExists,
  esignQuestionnaireSignatureUseImageAsset,
  getEsignQuestionnaireSignatureImagePath,
  getEsignQuestionnaireSignaturePdfPath,
} from "../../config/esignQuestionnaire.config.js";
import { esignW9PdfExists, getEsignW9PdfPath } from "../../config/esignW9.config.js";
import {
  buildFilledW9PdfBuffer,
  getEsignW9PageCount,
  type InvestorW9FormData,
} from "./investorW9Form.service.js";

const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;

/** Bump when questionnaire page 1 layout changes (stored on template file metadata). */
export const ESIGN_QUESTIONNAIRE_PAGE_LAYOUT_VERSION = 7;

/** Vertical stack (top → bottom): sign field, underline, label — left-aligned. */
const QUESTIONNAIRE_SIGNATURE_STACK = [
  {
    label: "Date",
    apiId: "DateSigned1",
    fieldType: "date_signed" as const,
    fieldHeight: 22,
    required: true,
  },
  {
    label: "Authorized Signature",
    apiId: "Signature1",
    fieldType: "signature" as const,
    fieldHeight: 32,
    required: true,
  },
  {
    label: "Print Name",
    apiId: "FullName1",
    fieldType: "text" as const,
    fieldHeight: 22,
    required: true,
  },
  {
    label: "Print Title (if applicable)",
    apiId: "Title1",
    fieldType: "text" as const,
    fieldHeight: 22,
    required: false,
  },
] as const;

const BODY_TOP = 110;
const BODY_LINE_HEIGHT = 14;

const SIGNATURE_MARGIN_X = 72;
const SIGNATURE_LINE_WIDTH = LETTER_WIDTH - SIGNATURE_MARGIN_X * 2;
/** Input box width (underline extends wider on the page). */
const SIGNATURE_FIELD_WIDTH = 248;
const SIGNATURE_LABEL_SIZE = 9;
const SIGNATURE_GAP_FIELD_TO_LINE = 8;
const SIGNATURE_GAP_LINE_TO_LABEL = 14;
const SIGNATURE_GAP_BETWEEN_GROUPS = 26;
const SIGNATURE_GAP_BELOW_BODY = 36;

/** Layout + Dropbox Sign coords: origin top-left, y increases downward (page param set). */
type QuestionnaireSignaturePlacement = {
  fieldX: number;
  fieldY: number;
  fieldWidth: number;
  fieldHeight: number;
  lineX: number;
  lineY: number;
  lineWidth: number;
  label: string;
  labelY: number;
  apiId: string;
  fieldType: (typeof QUESTIONNAIRE_SIGNATURE_STACK)[number]["fieldType"];
  required: boolean;
};

function questionnaireBodyEndTop(lineCount: number): number {
  return BODY_TOP + lineCount * BODY_LINE_HEIGHT;
}

function buildQuestionnaireSignaturePlacements(
  bodyEndTop: number,
): QuestionnaireSignaturePlacement[] {
  let cursorTop = bodyEndTop + SIGNATURE_GAP_BELOW_BODY;
  const placements: QuestionnaireSignaturePlacement[] = [];

  for (const item of QUESTIONNAIRE_SIGNATURE_STACK) {
    const fieldTop = cursorTop;
    const fieldBottom = fieldTop + item.fieldHeight;
    const lineY = fieldBottom + SIGNATURE_GAP_FIELD_TO_LINE;
    const labelY = lineY + SIGNATURE_GAP_LINE_TO_LABEL;
    placements.push({
      fieldX: SIGNATURE_MARGIN_X,
      fieldY: fieldTop,
      fieldWidth: SIGNATURE_FIELD_WIDTH,
      fieldHeight: item.fieldHeight,
      lineX: SIGNATURE_MARGIN_X,
      lineY,
      lineWidth: SIGNATURE_LINE_WIDTH,
      label: item.label,
      labelY,
      apiId: item.apiId,
      fieldType: item.fieldType,
      required: item.required,
    });
    cursorTop = labelY + SIGNATURE_LABEL_SIZE + SIGNATURE_GAP_BETWEEN_GROUPS;
  }

  return placements;
}

function pdfYFromTop(topY: number): number {
  return LETTER_HEIGHT - topY;
}

function drawQuestionnaireSignatureBlock(
  page: PDFPage,
  font: PDFFont,
  bodyEndTop: number,
): void {
  for (const row of buildQuestionnaireSignaturePlacements(bodyEndTop)) {
    const linePdfY = pdfYFromTop(row.lineY);
    page.drawLine({
      start: { x: row.lineX, y: linePdfY },
      end: { x: row.lineX + row.lineWidth, y: linePdfY },
      thickness: 0.75,
      color: rgb(0, 0, 0),
    });
    page.drawText(row.label, {
      x: row.lineX,
      y: pdfYFromTop(row.labelY + SIGNATURE_LABEL_SIZE),
      size: SIGNATURE_LABEL_SIZE,
      font,
      color: rgb(0, 0, 0),
    });
  }
}

/** Dropbox fields aligned to printed lines (top-left coordinate system). */
export function getInvestorQuestionnaireSignatureFormFields(
  pageOffset = 0,
): DropboxSignFormFieldPerDocument[] {
  const lines = wrapQuestionnaireBodyLines((text, size) => text.length * (size * 0.48));
  const placements = buildQuestionnaireSignaturePlacements(
    questionnaireBodyEndTop(lines.length),
  );
  const fields = placementsToDropboxFormFields(placements);
  if (pageOffset <= 0) {
    if (!cachedQuestionnaireSignatureFormFields) {
      cachedQuestionnaireSignatureFormFields = fields;
    }
    return cachedQuestionnaireSignatureFormFields;
  }
  return fields.map((f) => ({
    ...f,
    page: f.page + pageOffset,
  }));
}

function placementsToDropboxFormFields(
  placements: QuestionnaireSignaturePlacement[],
): DropboxSignFormFieldPerDocument[] {
  return placements.map((row) => ({
    documentIndex: 0,
    apiId: row.apiId,
    type: row.fieldType,
    signer: "0",
    x: row.fieldX,
    y: row.fieldY,
    width: row.fieldWidth,
    height: row.fieldHeight,
    page: 1,
    required: row.required,
    name: row.label,
    placeholder: " ",
  }));
}

/** Bump when questionnaire page layout changes (invalidates in-process cache). */
const QUESTIONNAIRE_SIGNATURE_PAGE_CACHE_KEY = ESIGN_QUESTIONNAIRE_PAGE_LAYOUT_VERSION;
let cachedQuestionnaireSignaturePagePdf: Buffer | null = null;
let cachedQuestionnaireSignatureFormFields: DropboxSignFormFieldPerDocument[] | null =
  null;
let questionnaireSignaturePageCacheKey = 0;

function wrapQuestionnaireBodyLines(
  measureTextWidth: (text: string, fontSize: number) => number,
): string[] {
  const bodySize = 10;
  const marginX = 54;
  const maxWidth = LETTER_WIDTH - marginX * 2;
  const words = QUESTIONNAIRE_BODY.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measureTextWidth(candidate, bodySize) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

const QUESTIONNAIRE_BODY =
  "By signing below, the undersigned hereby acknowledges that the representations set forth in the Questionnaire are accurate and complete in all respects, and undertakes to immediately notify the Company in writing regarding any material change in the information set forth herein prior to the date and time that the undersigned purchases any Securities. The undersigned understands that the Company and its legal counsel will rely on the accuracy and completeness of these representations for the purpose of determining my suitability as a prospective investor under applicable securities laws, and that a false representation may constitute a violation of law and that any person who suffers damage as a result of a false representation may have a claim against me for damages.";

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
async function buildQuestionnaireSignaturePagePdfFromPng(
  pngBytes: Buffer,
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([LETTER_WIDTH, LETTER_HEIGHT]);
  const image = await pdf.embedPng(pngBytes);
  /** Fit width; top-align so the title is at the top of page 1 (no blank band above). */
  let scale = LETTER_WIDTH / image.width;
  let drawWidth = image.width * scale;
  let drawHeight = image.height * scale;
  if (drawHeight > LETTER_HEIGHT) {
    scale = LETTER_HEIGHT / image.height;
    drawWidth = image.width * scale;
    drawHeight = image.height * scale;
  }
  const x = (LETTER_WIDTH - drawWidth) / 2;
  const y = LETTER_HEIGHT - drawHeight;
  page.drawImage(image, {
    x,
    y,
    width: drawWidth,
    height: drawHeight,
  });
  return Buffer.from(await pdf.save());
}

/** Questionnaire page: title, legal copy, and printed signature lines (no field boxes in PDF). */
async function buildQuestionnaireSignaturePagePdfTextOnly(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([LETTER_WIDTH, LETTER_HEIGHT]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const title = "SIGNATURE PAGE TO INVESTOR QUESTIONNAIRE";
  const titleSize = 12;
  const titleWidth = bold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: (LETTER_WIDTH - titleWidth) / 2,
    y: LETTER_HEIGHT - 72,
    size: titleSize,
    font: bold,
    color: rgb(0, 0, 0),
  });

  const bodySize = 10;
  const marginX = 54;
  const lines = wrapQuestionnaireBodyLines((text, size) =>
    regular.widthOfTextAtSize(text, size),
  );

  let bodyEndTop = BODY_TOP;
  for (const textLine of lines) {
    page.drawText(textLine, {
      x: marginX,
      y: pdfYFromTop(bodyEndTop + bodySize),
      size: bodySize,
      font: regular,
      color: rgb(0, 0, 0),
    });
    bodyEndTop += BODY_LINE_HEIGHT;
  }

  drawQuestionnaireSignatureBlock(page, regular, bodyEndTop);
  cachedQuestionnaireSignatureFormFields = placementsToDropboxFormFields(
    buildQuestionnaireSignaturePlacements(bodyEndTop),
  );

  return Buffer.from(await pdf.save());
}

/** Loads the standard investor questionnaire signature page (single-page PDF). */
export async function loadInvestorQuestionnaireSignaturePagePdf(): Promise<Buffer | null> {
  if (
    cachedQuestionnaireSignaturePagePdf &&
    questionnaireSignaturePageCacheKey === QUESTIONNAIRE_SIGNATURE_PAGE_CACHE_KEY
  ) {
    return cachedQuestionnaireSignaturePagePdf;
  }
  cachedQuestionnaireSignaturePagePdf = null;
  cachedQuestionnaireSignatureFormFields = null;

  if (esignQuestionnaireSignatureUseImageAsset()) {
    if (esignQuestionnaireSignaturePdfExists()) {
      cachedQuestionnaireSignaturePagePdf = await readFile(
        getEsignQuestionnaireSignaturePdfPath(),
      );
      questionnaireSignaturePageCacheKey = QUESTIONNAIRE_SIGNATURE_PAGE_CACHE_KEY;
      return cachedQuestionnaireSignaturePagePdf;
    }

    if (esignQuestionnaireSignatureImageExists()) {
      const pngBytes = await readFile(getEsignQuestionnaireSignatureImagePath());
      cachedQuestionnaireSignaturePagePdf =
        await buildQuestionnaireSignaturePagePdfFromPng(pngBytes);
      questionnaireSignaturePageCacheKey = QUESTIONNAIRE_SIGNATURE_PAGE_CACHE_KEY;
      return cachedQuestionnaireSignaturePagePdf;
    }

    console.warn(
      "[esign] ESIGN_QUESTIONNAIRE_SIGNATURE_USE_ASSET is set but no PNG/PDF found — using text-only page",
    );
  }

  cachedQuestionnaireSignaturePagePdf =
    await buildQuestionnaireSignaturePagePdfTextOnly();
  questionnaireSignaturePageCacheKey = QUESTIONNAIRE_SIGNATURE_PAGE_CACHE_KEY;
  return cachedQuestionnaireSignaturePagePdf;
}

/**
 * Prepends the investor questionnaire signature page as page 1.
 * Main document pages follow; W-9 (if any) should still be appended afterward.
 */
/** Prefix PDF(s) in order before `mainPdf`. */
export async function prependPdfBuffers(
  mainPdf: Buffer,
  prefixBuffers: Buffer[],
): Promise<{ buffer: Buffer; prepended: boolean }> {
  const prefixes = prefixBuffers.filter((b) => b?.length);
  if (!prefixes.length) {
    return { buffer: mainPdf, prepended: false };
  }

  try {
    const merged = await PDFDocument.create();
    for (const prefix of prefixes) {
      const prefixDoc = await PDFDocument.load(prefix, {
        ignoreEncryption: true,
      });
      const pages = await merged.copyPages(
        prefixDoc,
        prefixDoc.getPageIndices(),
      );
      for (const page of pages) merged.addPage(page);
    }

    const mainDoc = await PDFDocument.load(mainPdf, { ignoreEncryption: true });
    const mainPages = await merged.copyPages(mainDoc, mainDoc.getPageIndices());
    for (const page of mainPages) merged.addPage(page);

    return { buffer: Buffer.from(await merged.save()), prepended: true };
  } catch (err) {
    console.error("[esign] Failed to prepend PDF buffers:", err);
    return { buffer: mainPdf, prepended: false };
  }
}

export async function prependInvestorQuestionnaireSignaturePage(
  mainPdf: Buffer,
): Promise<{ buffer: Buffer; prepended: boolean }> {
  const signaturePage = await loadInvestorQuestionnaireSignaturePagePdf();
  if (!signaturePage) {
    console.warn(
      "[esign] Could not load questionnaire signature page — uploading without prepend",
    );
    return { buffer: mainPdf, prepended: false };
  }

  return prependPdfBuffers(mainPdf, [signaturePage]);
}

async function loadW9AppendixBytes(
  w9FormData?: InvestorW9FormData | null,
): Promise<Buffer | null> {
  if (!esignW9PdfExists()) return null;
  if (w9FormData) {
    try {
      return await buildFilledW9PdfBuffer(w9FormData);
    } catch (err) {
      console.error("[esign] Failed to build filled W-9 PDF:", err);
    }
  }
  return readFile(getEsignW9PdfPath());
}

export async function appendW9ToPdfBuffer(
  mainPdf: Buffer,
  w9FormData?: InvestorW9FormData | null,
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
    const w9Bytes = await loadW9AppendixBytes(w9FormData);
    if (!w9Bytes) return { buffer: mainPdf, w9Appended: false };

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

/**
 * Swaps the trailing W-9 appendix pages on a merged template PDF with a filled copy.
 */
export async function replaceW9AppendixWithFilled(
  mergedPdf: Buffer,
  w9FormData: InvestorW9FormData,
): Promise<Buffer> {
  const w9PageCount = await getEsignW9PageCount();
  if (w9PageCount <= 0) return mergedPdf;

  try {
    const filledW9 = await buildFilledW9PdfBuffer(w9FormData);
    const doc = await PDFDocument.load(mergedPdf, { ignoreEncryption: true });
    const total = doc.getPageCount();
    if (total < w9PageCount) {
      return (await appendW9ToPdfBuffer(mergedPdf, w9FormData)).buffer;
    }

    const mainEnd = total - w9PageCount;
    const out = await PDFDocument.create();
    const mainPages = await out.copyPages(
      doc,
      Array.from({ length: mainEnd }, (_, i) => i),
    );
    for (const page of mainPages) out.addPage(page);

    const w9Doc = await PDFDocument.load(filledW9, { ignoreEncryption: true });
    const w9Pages = await out.copyPages(w9Doc, w9Doc.getPageIndices());
    for (const page of w9Pages) out.addPage(page);

    return Buffer.from(await out.save());
  } catch (err) {
    console.error("[esign] replaceW9AppendixWithFilled failed:", err);
    return mergedPdf;
  }
}
