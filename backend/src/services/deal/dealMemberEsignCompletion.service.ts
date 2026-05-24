import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { getDropboxSignConfig } from "../../config/dropboxSign.config.js";
import { getUploadsPhysicalRoot } from "../../config/uploadPaths.js";
import {
  DEAL_ESIGN_COMPLETED_FOLDER,
  dealAssetsRelativePath,
  resolveDealStorageFolderName,
  sanitizeStoragePathSegment,
} from "./dealStoragePaths.service.js";
import {
  aggregateEsignStatusFromBundle,
  esignBundleHasPending,
  esignBundleIsAllCompleted,
  findEsignSendBySignatureRequestId,
  parseEsignStatusBundle,
  parseEsignStatusJson,
  type StoredDealInvestorEsignSend,
} from "../../constants/deal-investor-esign-status.js";
import {
  downloadSignatureRequestPdfBuffer,
  getSignatureRequestDetail,
  type DropboxSignatureRequestDetail,
} from "../esign/dropboxSign.service.js";
import type { DealInvestorEsignStatusApi } from "../../constants/deal-investor-esign-status.js";
import {
  enrichEsignDocumentsWithCategories,
  findEsignTemplateFile,
  getDealEsignTemplatesState,
} from "./dealEsignTemplates.service.js";
import {
  findInvestorEsignTargetByMetadata,
  findInvestorEsignTargetBySignatureRequestId,
  readInvestorEsignStatusJson,
  updateDealInvestorEsignSend,
  type InvestorEsignRowTarget,
} from "./dealMemberEsignStatus.service.js";

export type MyEsignDocumentListItem = {
  fileId: string;
  name: string;
  url: string | null;
  status: "pending" | "signed";
  categoryId?: string;
  signatureRequestId?: string;
};

function uploadPublicUrl(relativePath: string): string {
  const rel = relativePath.replace(/^\/+/, "").replace(/^uploads\//i, "");
  return rel ? `/uploads/${rel}` : "";
}

const ESIGN_SIGNED_FOLDER = DEAL_ESIGN_COMPLETED_FOLDER;

function safeRosterSegment(raw: string): string {
  return sanitizeStoragePathSegment(raw, 64) || "investor";
}

async function persistSignedPdf(params: {
  dealId: string;
  rosterId: string;
  signatureRequestId: string;
}): Promise<string> {
  const pdf = await downloadSignatureRequestPdfBuffer(
    params.signatureRequestId,
  );
  const dealFolder = await resolveDealStorageFolderName(params.dealId);
  const rosterFolder = safeRosterSegment(params.rosterId);
  const fileName = `signed-${Date.now()}.pdf`;
  const relativePath = dealAssetsRelativePath(
    dealFolder,
    ESIGN_SIGNED_FOLDER,
    rosterFolder,
    fileName,
  );

  const abs = path.join(getUploadsPhysicalRoot(), relativePath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, pdf);
  return relativePath;
}

async function applyProgressFromDropbox(
  dealId: string,
  target: InvestorEsignRowTarget,
  signatureRequestId: string,
  opts?: { forceComplete?: boolean },
): Promise<boolean> {
  const summary = await getSignatureRequestDetail(signatureRequestId);
  const raw = await readInvestorEsignStatusJson(dealId, target);
  const bundle = parseEsignStatusBundle(raw);
  const existing = bundle
    ? findEsignSendBySignatureRequestId(bundle, signatureRequestId)
    : null;
  if (!existing?.sentAt) return false;

  const sigId = signatureRequestId.trim();
  const alreadyComplete = Boolean(existing.completedAt);
  const shouldComplete =
    opts?.forceComplete === true ||
    summary.isComplete ||
    alreadyComplete;

  if (shouldComplete && !alreadyComplete) {
    const rosterId = target.id;
    const signedRelativePath = await persistSignedPdf({
      dealId,
      rosterId,
      signatureRequestId: sigId,
    });
    const completedAt =
      summary.completeAt ?? summary.lastSignedAt ?? new Date().toISOString();

    await updateDealInvestorEsignSend(dealId, target, sigId, (current) => ({
      ...current,
      viewedAt: current.viewedAt ?? summary.lastViewedAt,
      signedAt: summary.lastSignedAt ?? completedAt,
      completedAt,
      signatureRequestId: sigId,
      documents: (current.documents ?? []).map((d) => ({
        ...d,
        signedRelativePath,
      })),
    }));
    return true;
  }

  if (summary.lastViewedAt || summary.lastSignedAt) {
    await updateDealInvestorEsignSend(dealId, target, sigId, (current) => ({
      ...current,
      viewedAt: current.viewedAt ?? summary.lastViewedAt,
      signedAt: current.signedAt ?? summary.lastSignedAt,
      signatureRequestId: sigId,
    }));
  }

  return alreadyComplete;
}

async function ensureSignedPdfStoredForCompletedRequest(
  dealId: string,
  target: InvestorEsignRowTarget,
  signatureRequestId: string,
  existing: StoredDealInvestorEsignSend,
): Promise<boolean> {
  const hasPath = (existing.documents ?? []).some((d) =>
    Boolean(d.signedRelativePath?.trim()),
  );
  if (hasPath) return true;

  try {
    const signedRelativePath = await persistSignedPdf({
      dealId,
      rosterId: target.id,
      signatureRequestId,
    });
    await updateDealInvestorEsignSend(
      dealId,
      target,
      signatureRequestId,
      (current) => ({
        ...current,
        documents: (current.documents ?? []).map((d) => ({
          ...d,
          signedRelativePath,
        })),
      }),
    );
    return true;
  } catch (err) {
    console.warn("ensureSignedPdfStoredForCompletedRequest:", err);
    return false;
  }
}

export async function syncDealInvestorEsignByTarget(
  dealId: string,
  target: InvestorEsignRowTarget,
): Promise<boolean> {
  const raw = await readInvestorEsignStatusJson(dealId, target);
  const bundle = parseEsignStatusBundle(raw);
  if (!bundle?.sends.length) return false;

  let changed = false;
  for (const send of bundle.sends) {
    const signatureRequestId = send.signatureRequestId?.trim();
    if (!signatureRequestId) continue;

    if (send.completedAt?.trim()) {
      changed =
        (await ensureSignedPdfStoredForCompletedRequest(
          dealId,
          target,
          signatureRequestId,
          send,
        )) || changed;
    } else {
      changed =
        (await applyProgressFromDropbox(dealId, target, signatureRequestId)) ||
        changed;
    }
  }
  return changed;
}

export async function handleDealInvestorEsignWebhook(params: {
  dealId: string;
  rosterId?: string;
  signatureRequestId: string;
  eventType: string;
}): Promise<void> {
  const dealId = params.dealId.trim();
  const signatureRequestId = params.signatureRequestId.trim();
  if (!dealId || !signatureRequestId) return;

  let target =
    params.rosterId?.trim() ?
      await findInvestorEsignTargetByMetadata(dealId, params.rosterId.trim())
    : null;
  if (!target) {
    target = await findInvestorEsignTargetBySignatureRequestId(
      dealId,
      signatureRequestId,
    );
  }
  if (!target) return;

  const event = params.eventType.trim().toLowerCase();
  const forceComplete = event === "signature_request_all_signed";

  await applyProgressFromDropbox(dealId, target, signatureRequestId, {
    forceComplete: forceComplete || undefined,
  });
}

export function listCompletedEsignDocumentsForSend(
  send: StoredDealInvestorEsignSend,
  signatureRequestId: string,
): Array<{ fileId: string; name: string; url: string | null }> {
  if (!send.completedAt?.trim()) return [];
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

/**
 * Documents sent for eSign on this deal — template previews while pending,
 * combined signed PDF after completion.
 */
export async function listMyEsignDocumentsForInvestor(
  dealId: string,
  raw: string | null,
): Promise<MyEsignDocumentListItem[]> {
  const bundle = parseEsignStatusBundle(raw);
  if (!bundle?.sends.length) return [];

  const templates = await getDealEsignTemplatesState(dealId);
  const out: MyEsignDocumentListItem[] = [];

  for (const send of bundle.sends) {
    const sig = send.signatureRequestId?.trim() ?? "";
    const categoryId =
      send.categoryId?.trim() ||
      send.documents?.find((d) => d.categoryId?.trim())?.categoryId?.trim() ||
      "";

    if (send.completedAt?.trim()) {
      const completed = listCompletedEsignDocumentsForSend(send, sig);
      for (const d of completed) {
        out.push({
          fileId: d.fileId,
          name: d.name,
          url: d.url,
          status: "signed",
          ...(categoryId ? { categoryId } : {}),
          ...(sig ? { signatureRequestId: sig } : {}),
        });
      }
      continue;
    }

    for (const d of send.documents ?? []) {
      const rawFileId = d.fileId.trim();
      const compositeId = sig && rawFileId ? `${sig}::${rawFileId}` : rawFileId;
      const template = findEsignTemplateFile(templates, rawFileId);
      const rel =
        d.templateRelativePath?.trim() ||
        template?.relativePath?.trim() ||
        "";
      const url = rel ? uploadPublicUrl(rel) : null;
      out.push({
        fileId: compositeId,
        name: d.name,
        url: url || null,
        status: "pending",
        ...(categoryId || d.categoryId?.trim()
          ? { categoryId: categoryId || d.categoryId?.trim() }
          : {}),
        ...(sig ? { signatureRequestId: sig } : {}),
      });
    }
  }

  return out;
}

export type InvestorEsignStatusWithDropboxResult = {
  status: DealInvestorEsignStatusApi | null;
  dropbox: DropboxSignatureRequestDetail | null;
  syncedAt: string;
};

/** Sync from Dropbox Sign, persist timestamps, return status for sponsor status popup. */
export async function getInvestorEsignStatusWithDropboxSync(
  dealId: string,
  rosterId: string,
): Promise<InvestorEsignStatusWithDropboxResult> {
  const syncedAt = new Date().toISOString();
  const target = await findInvestorEsignTargetByMetadata(
    dealId.trim(),
    rosterId.trim(),
  );
  if (!target) {
    return { status: null, dropbox: null, syncedAt };
  }

  let status = parseEsignStatusJson(
    await readInvestorEsignStatusJson(dealId, target),
  );
  let dropbox: DropboxSignatureRequestDetail | null = null;

  const requestId = status?.signatureRequestId?.trim();
  if (requestId && getDropboxSignConfig()) {
    await syncDealInvestorEsignByTarget(dealId, target);
    status = parseEsignStatusJson(
      await readInvestorEsignStatusJson(dealId, target),
    );
    try {
      dropbox = await getSignatureRequestDetail(requestId);
    } catch (err) {
      console.warn("getSignatureRequestDetail:", err);
    }
  }

  if (status?.documents?.length) {
    const documents = await enrichEsignDocumentsWithCategories(
      dealId,
      status.documents,
    );
    status = { ...status, documents };
  }

  return { status, dropbox, syncedAt };
}
