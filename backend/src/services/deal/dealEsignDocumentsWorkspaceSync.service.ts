/**
 * When an investor completes eSign, mirror signed PDFs into the deal Documents tab
 * under a dedicated "Esign template" section (`offering_investor_preview_json.sections`).
 */

import { eq } from "drizzle-orm";
import {
  parseEsignStatusBundle,
  type StoredDealInvestorEsignSend,
} from "../../constants/deal-investor-esign-status.js";
import { db } from "../../database/db.js";
import { dealInvestment } from "../../schema/deal.schema/deal-investment.schema.js";
import { dealLpInvestor } from "../../schema/deal.schema/deal-lp-investor.schema.js";
import { formatDdMmmYyyy } from "../../utils/formatDdMmmYyyy.js";
import { sanitizeOfferingInvestorPreviewBody } from "../../utils/sanitizeOfferingInvestorPreviewJson.js";
import {
  getAddDealFormById,
  updateDealOfferingInvestorPreviewById,
} from "./dealForm.service.js";

export const ESIGN_TEMPLATE_DOCUMENTS_SECTION_ID =
  "esign-template-documents-section";

export const ESIGN_TEMPLATE_DOCUMENTS_SECTION_LABEL = "Esign template";

function uploadPublicUrl(relativePath: string): string {
  const rel = relativePath.replace(/^\/+/, "").replace(/^uploads\//i, "");
  return rel ? `/uploads/${rel}` : "";
}

function sendHasStoredOrRecordedSignature(
  send: StoredDealInvestorEsignSend,
): boolean {
  if (send.completedAt?.trim() || send.signedAt?.trim()) return true;
  return (send.documents ?? []).some((d) => Boolean(d.signedRelativePath?.trim()));
}

function listSignedEsignDocumentsForSend(
  send: StoredDealInvestorEsignSend,
  signatureRequestId: string,
): Array<{ fileId: string; name: string; url: string | null }> {
  if (!sendHasStoredOrRecordedSignature(send)) return [];
  const docs = send.documents ?? [];
  if (docs.length === 0) return [];

  const sharedPath = docs.find((d) => d.signedRelativePath?.trim())?.signedRelativePath;
  const sharedUrl = sharedPath ? uploadPublicUrl(sharedPath) : null;
  const sig = signatureRequestId.trim();

  return docs.map((d) => {
    const rel = d.signedRelativePath?.trim() || sharedPath?.trim();
    const url = rel ? uploadPublicUrl(rel) : sharedUrl;
    const compositeId = sig && d.fileId ? `${sig}::${d.fileId}` : d.fileId;
    return {
      fileId: compositeId,
      name: d.name,
      url: url || null,
    };
  });
}

type PreviewParts = {
  visibility: Record<string, boolean>;
  sections: Record<string, unknown>[];
};

function readPreviewParts(raw: string | null | undefined): PreviewParts {
  if (!raw?.trim()) return { visibility: {}, sections: [] };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const visibility =
      parsed.visibility != null &&
      typeof parsed.visibility === "object" &&
      !Array.isArray(parsed.visibility)
        ? (parsed.visibility as Record<string, boolean>)
        : {};
    const sections = Array.isArray(parsed.sections)
      ? (parsed.sections as Record<string, unknown>[])
      : [];
    return { visibility, sections };
  } catch {
    return { visibility: {}, sections: [] };
  }
}

function isEsignTemplateSection(section: Record<string, unknown>): boolean {
  const id = String(section.id ?? "").trim();
  if (id === ESIGN_TEMPLATE_DOCUMENTS_SECTION_ID) return true;
  const label = String(section.sectionLabel ?? section.label ?? "")
    .trim()
    .toLowerCase();
  return label === ESIGN_TEMPLATE_DOCUMENTS_SECTION_LABEL.toLowerCase();
}

function buildEsignNestedDocument(params: {
  docId: string;
  displayName: string;
  url: string;
  dateAdded: string;
  investorRowId: string;
}): Record<string, unknown> {
  return {
    id: params.docId,
    name: params.displayName,
    url: params.url,
    dateAdded: params.dateAdded,
    lpDisplaySectionId: ESIGN_TEMPLATE_DOCUMENTS_SECTION_ID,
    sharedDealClassIds: [],
    sharedInvestorIds: [params.investorRowId],
    sharedWithAllInvestors: false,
    sharedSponsorUserIds: [],
    sharedWithScope: "lp_investor",
  };
}

function collectCompletedEsignNestedDocuments(
  investorRowId: string,
  investorDisplayName: string,
  esignStatusJson: string | null | undefined,
): Record<string, unknown>[] {
  const bundle = parseEsignStatusBundle(esignStatusJson);
  if (!bundle?.sends.length) return [];

  const investorLabel = investorDisplayName.trim() || "Investor";
  const out: Record<string, unknown>[] = [];

  for (const send of bundle.sends) {
    if (!sendHasStoredOrRecordedSignature(send)) continue;
    const sig = send.signatureRequestId?.trim() ?? "";
    const signedDocs = listSignedEsignDocumentsForSend(send, sig);
    const completedAt =
      send.completedAt?.trim() ||
      send.signedAt?.trim() ||
      send.sentAt?.trim() ||
      "";
    const dateAdded = formatDdMmmYyyy(completedAt);

    for (const doc of signedDocs) {
      const url = doc.url?.trim();
      if (!url) continue;
      const docId = doc.fileId.trim();
      if (!docId) continue;
      const templateName = doc.name.trim() || "Signed document";
      const displayName = `${investorLabel} — ${templateName}`;
      out.push(
        buildEsignNestedDocument({
          docId,
          displayName,
          url,
          dateAdded,
          investorRowId,
        }),
      );
    }
  }

  return out;
}

/**
 * Rebuild the Esign template section from all completed investor eSign rows on the deal.
 * Returns true when `offering_investor_preview_json` was updated.
 */
export async function syncCompletedEsignDocumentsToDocumentsTab(
  dealId: string,
): Promise<boolean> {
  const id = dealId.trim();
  if (!id) return false;

  const deal = await getAddDealFormById(id);
  if (!deal) return false;

  const [investments, roster] = await Promise.all([
    db
      .select({
        id: dealInvestment.id,
        contactDisplayName: dealInvestment.contactDisplayName,
        esignStatusJson: dealInvestment.esignStatusJson,
      })
      .from(dealInvestment)
      .where(eq(dealInvestment.dealId, id)),
    db
      .select({
        id: dealLpInvestor.id,
        email: dealLpInvestor.email,
        esignStatusJson: dealLpInvestor.esignStatusJson,
      })
      .from(dealLpInvestor)
      .where(eq(dealLpInvestor.dealId, id)),
  ]);

  const nestedById = new Map<string, Record<string, unknown>>();
  for (const row of investments) {
    const docs = collectCompletedEsignNestedDocuments(
      row.id,
      row.contactDisplayName ?? "",
      row.esignStatusJson,
    );
    for (const doc of docs) {
      const docId = String(doc.id ?? "").trim();
      if (docId) nestedById.set(docId, doc);
    }
  }
  for (const row of roster) {
    const docs = collectCompletedEsignNestedDocuments(
      row.id,
      row.email?.trim() ?? "",
      row.esignStatusJson,
    );
    for (const doc of docs) {
      const docId = String(doc.id ?? "").trim();
      if (docId) nestedById.set(docId, doc);
    }
  }

  const { visibility, sections: existingSections } = readPreviewParts(
    deal.offeringInvestorPreviewJson,
  );
  const otherSections = existingSections.filter((s) => !isEsignTemplateSection(s));

  const esignNested = [...nestedById.values()];
  if (esignNested.length === 0) {
    const hadEsignSection = existingSections.some(isEsignTemplateSection);
    if (!hadEsignSection) return false;
  }

  const esignSection: Record<string, unknown> = {
    id: ESIGN_TEMPLATE_DOCUMENTS_SECTION_ID,
    sectionLabel: ESIGN_TEMPLATE_DOCUMENTS_SECTION_LABEL,
    documentLabel: ESIGN_TEMPLATE_DOCUMENTS_SECTION_LABEL,
    visibility: "LP portal only",
    sharedWithScope: "lp_investor",
    requireLpReview: false,
    dateAdded: formatDdMmmYyyy(new Date()),
    nestedDocuments: esignNested,
  };

  const nextSections = [...otherSections, esignSection];
  const canonical = sanitizeOfferingInvestorPreviewBody({
    visibility,
    sections: nextSections,
  });

  if (canonical === (deal.offeringInvestorPreviewJson ?? "")) return false;

  const updated = await updateDealOfferingInvestorPreviewById(id, canonical);
  return Boolean(updated);
}

/** Latest canonical JSON after sync (for API responses). */
export async function readOfferingInvestorPreviewJsonAfterEsignSync(
  dealId: string,
): Promise<string | null> {
  const id = dealId.trim();
  if (!id) return null;
  await syncCompletedEsignDocumentsToDocumentsTab(id);
  const deal = await getAddDealFormById(id);
  return deal?.offeringInvestorPreviewJson ?? null;
}
