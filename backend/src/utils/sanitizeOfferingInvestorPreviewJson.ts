const MAX_PAYLOAD_CHARS = 450_000;

const VISIBILITY_KEYS = new Set([
  "make_announcement",
  "overview",
  "offering_information",
  "gallery",
  "summary",
  "documents",
  "assets",
  "key_highlights",
  "funding_instructions",
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function clipStr(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function normalizeNested(
  raw: unknown,
  parentSectionId: string,
): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  const id =
    typeof raw.id === "string" && raw.id.trim() ? clipStr(raw.id.trim(), 120) : "";
  const name =
    typeof raw.name === "string" && raw.name.trim()
      ? clipStr(raw.name.trim(), 500)
      : typeof raw.documentName === "string" && raw.documentName.trim()
        ? clipStr(raw.documentName.trim(), 500)
        : "";
  if (!id || !name) return null;
  const urlRaw = raw.url;
  let url: string | null = null;
  if (typeof urlRaw === "string" && urlRaw.trim()) {
    url = clipStr(urlRaw.trim(), 8000);
  } else if (urlRaw === null) {
    url = null;
  }
  const dateAdded =
    typeof raw.dateAdded === "string" && raw.dateAdded.trim()
      ? clipStr(raw.dateAdded.trim(), 80)
      : "—";
  const refRaw = raw.lpDisplaySectionId;
  const lpDisplaySectionId =
    typeof refRaw === "string" && refRaw.trim()
      ? clipStr(refRaw.trim(), 120)
      : parentSectionId;
  return { id, name, url, dateAdded, lpDisplaySectionId };
}

function normalizeSection(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  const id =
    typeof raw.id === "string" && raw.id.trim() ? clipStr(raw.id.trim(), 120) : "";
  const sectionLabel =
    typeof raw.sectionLabel === "string" && raw.sectionLabel.trim()
      ? clipStr(raw.sectionLabel.trim(), 500)
      : typeof raw.label === "string" && raw.label.trim()
        ? clipStr(raw.label.trim(), 500)
        : "";
  const documentLabel =
    typeof raw.documentLabel === "string" && raw.documentLabel.trim()
      ? clipStr(raw.documentLabel.trim(), 500)
      : sectionLabel || "—";
  if (!id || !sectionLabel) return null;
  const legacyVisibility =
    typeof raw.visibility === "string" && raw.visibility.trim()
      ? clipStr(raw.visibility.trim(), 120)
      : "Offering page";
  const sw = raw.sharedWithScope;
  const sharedWithScope =
    sw === "lp_investor"
      ? "lp_investor"
      : sw === "offering_page"
        ? "offering_page"
        : legacyVisibility.toLowerCase().includes("lp") &&
            legacyVisibility.toLowerCase().includes("investor")
          ? "lp_investor"
          : "offering_page";
  const visibility =
    sharedWithScope === "lp_investor" ? "LP Investor" : "Offering page";
  const requireLpReview = Boolean(raw.requireLpReview);
  const dateAdded =
    typeof raw.dateAdded === "string" && raw.dateAdded.trim()
      ? clipStr(raw.dateAdded.trim(), 80)
      : "—";
  const nestedRaw = raw.nestedDocuments;
  const nestedDocuments: Record<string, unknown>[] = [];
  if (Array.isArray(nestedRaw)) {
    let n = 0;
    for (const item of nestedRaw) {
      if (n >= 400) break;
      const doc = normalizeNested(item, id);
      if (doc) {
        nestedDocuments.push(doc);
        n += 1;
      }
    }
  }
  return {
    id,
    sectionLabel,
    documentLabel,
    visibility,
    sharedWithScope,
    requireLpReview,
    dateAdded,
    nestedDocuments,
  };
}

function sanitizeSectionsInput(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  const out: Record<string, unknown>[] = [];
  let i = 0;
  for (const item of raw) {
    if (i >= 80) break;
    const s = normalizeSection(item);
    if (s) {
      out.push(s);
      i += 1;
    }
  }
  const ids = new Set(out.map((x) => String(x.id)));
  return out.map((s) => ({
    ...s,
    nestedDocuments: (s.nestedDocuments as Record<string, unknown>[]).map(
      (d) => ({
        ...d,
        lpDisplaySectionId: ids.has(String(d.lpDisplaySectionId))
          ? d.lpDisplaySectionId
          : s.id,
      }),
    ),
  }));
}

function sanitizeVisibilityInput(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!isRecord(raw)) return out;
  for (const k of VISIBILITY_KEYS) {
    const v = raw[k];
    if (typeof v === "boolean") out[k] = v;
  }
  return out;
}

export class OfferingInvestorPreviewJsonTooLargeError extends Error {
  constructor() {
    super("Offering investor preview payload is too large.");
    this.name = "OfferingInvestorPreviewJsonTooLargeError";
  }
}

export class OfferingInvestorPreviewJsonInvalidError extends Error {
  constructor(message = "Invalid offering investor preview payload.") {
    super(message);
    this.name = "OfferingInvestorPreviewJsonInvalidError";
  }
}

/**
 * Accepts `{ visibility?, sections? }` or legacy stringified JSON; returns canonical JSON string `{ v, visibility, sections }`.
 */
export function sanitizeOfferingInvestorPreviewBody(
  body: unknown,
): string {
  let root: unknown = body;
  if (typeof body === "string" && body.trim()) {
    try {
      root = JSON.parse(body) as unknown;
    } catch {
      throw new OfferingInvestorPreviewJsonInvalidError(
        "Body must be JSON object or valid JSON string.",
      );
    }
  }
  if (!isRecord(root)) {
    throw new OfferingInvestorPreviewJsonInvalidError();
  }
  const sections = sanitizeSectionsInput(root.sections);
  const visibility = sanitizeVisibilityInput(root.visibility);
  const out = { v: 1 as const, visibility, sections };
  const s = JSON.stringify(out);
  if (s.length > MAX_PAYLOAD_CHARS) {
    throw new OfferingInvestorPreviewJsonTooLargeError();
  }
  return s;
}
