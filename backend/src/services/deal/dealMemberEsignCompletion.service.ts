import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { and, eq } from "drizzle-orm";
import { getDropboxSignConfig } from "../../config/dropboxSign.config.js";
import { db } from "../../database/db.js";
import { dealInvestment } from "../../schema/deal.schema/deal-investment.schema.js";
import { dealLpInvestor } from "../../schema/deal.schema/deal-lp-investor.schema.js";
import { getUploadsPhysicalRoot } from "../../config/uploadPaths.js";
import {
  DEAL_ESIGN_COMPLETED_FOLDER,
  dealAssetsRelativePath,
  resolveDealStorageFolderName,
  sanitizeStoragePathSegment,
} from "./dealStoragePaths.service.js";
import {
  esignBundleNeedsDropboxSync,
  esignBundleToSendStatusList,
  esignCategoryFromCommitmentProfileId,
  findEsignSendBySignatureRequestId,
  parseEsignStatusBundle,
  parseEsignStatusJson,
  type DealInvestorEsignSendStatusApi,
  type StoredDealInvestorEsignSend,
} from "../../constants/deal-investor-esign-status.js";
import {
  downloadSignatureRequestPdfBuffer,
  getSignatureRequestDetail,
  type DropboxSignatureRequestDetail,
  type DropboxSignatureSignerDetail,
} from "../esign/dropboxSign.service.js";

function latestWorkflowIso(
  dates: Array<string | null | undefined>,
): string | null {
  let best: string | null = null;
  let bestMs = -1;
  for (const d of dates) {
    const s = d?.trim();
    if (!s) continue;
    const ms = new Date(s).getTime();
    if (!Number.isNaN(ms) && ms > bestMs) {
      bestMs = ms;
      best = s;
    }
  }
  return best;
}

/** Viewed / signed timestamps from Dropbox Sign (summary + per-signer). */
function workflowTimestampsFromDropbox(
  summary: DropboxSignatureRequestDetail,
): { viewedAt: string | null; signedAt: string | null } {
  const viewedCandidates: Array<string | null | undefined> = [
    summary.lastViewedAt,
  ];
  const signedCandidates: Array<string | null | undefined> = [
    summary.lastSignedAt,
  ];

  for (const signer of summary.signers) {
    collectSignerWorkflowTimestamps(signer, viewedCandidates, signedCandidates);
  }

  return {
    viewedAt: latestWorkflowIso(viewedCandidates),
    signedAt: latestWorkflowIso(signedCandidates),
  };
}

function collectSignerWorkflowTimestamps(
  signer: DropboxSignatureSignerDetail,
  viewedCandidates: Array<string | null | undefined>,
  signedCandidates: Array<string | null | undefined>,
): void {
  if (signer.lastViewedAt?.trim()) viewedCandidates.push(signer.lastViewedAt);
  if (signer.signedAt?.trim()) signedCandidates.push(signer.signedAt);

  const code = String(signer.statusCode ?? "").trim().toLowerCase();
  if (code === "signed") {
    if (signer.signedAt?.trim()) signedCandidates.push(signer.signedAt);
    if (signer.lastViewedAt?.trim()) viewedCandidates.push(signer.lastViewedAt);
  } else if (code === "viewed" && signer.lastViewedAt?.trim()) {
    viewedCandidates.push(signer.lastViewedAt);
  }
}
import type { DealInvestorEsignStatusApi } from "../../constants/deal-investor-esign-status.js";
import {
  enrichEsignDocumentsWithCategories,
  findEsignTemplateFile,
  getDealEsignTemplatesState,
} from "./dealEsignTemplates.service.js";
import {
  findInvestorEsignTargetBySignatureRequestId,
  markDealInvestorEsignSignedOptimistic,
  readInvestorEsignStatusJson,
  resolveEsignTargetForInvestorRowId,
  updateDealInvestorEsignSend,
  type InvestorEsignRowTarget,
} from "./dealMemberEsignStatus.service.js";

const EMBED_ESIGN_SYNC_ATTEMPTS = 12;
const EMBED_ESIGN_SYNC_DELAY_MS = 1000;

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
    const completedAt =
      summary.completeAt ?? summary.lastSignedAt ?? new Date().toISOString();
    let signedRelativePath: string | undefined;
    try {
      signedRelativePath = await persistSignedPdf({
        dealId,
        rosterId,
        signatureRequestId: sigId,
      });
    } catch (err) {
      console.warn("persistSignedPdf:", err);
    }

    await updateDealInvestorEsignSend(dealId, target, sigId, (current) => ({
      ...current,
      viewedAt: current.viewedAt ?? summary.lastViewedAt ?? completedAt,
      signedAt: summary.lastSignedAt ?? current.signedAt ?? completedAt,
      completedAt,
      signatureRequestId: sigId,
      documents: (current.documents ?? []).map((d) => ({
        ...d,
        ...(signedRelativePath ? { signedRelativePath } : {}),
      })),
    }));
    return true;
  }

  if (shouldComplete && alreadyComplete) {
    return true;
  }

  const dropboxProgress = workflowTimestampsFromDropbox(summary);
  const progressViewed = dropboxProgress.viewedAt?.trim() || null;
  const progressSigned = dropboxProgress.signedAt?.trim() || null;

  if (progressViewed || progressSigned) {
    await updateDealInvestorEsignSend(dealId, target, sigId, (current) => ({
      ...current,
      viewedAt: current.viewedAt ?? progressViewed,
      signedAt: current.signedAt ?? progressSigned,
      signatureRequestId: sigId,
    }));
    return false;
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

/**
 * Refresh pending eSign rows from Dropbox before building the Investors tab list.
 */
export async function syncDealInvestorEsignStatusesForDeal(
  dealId: string,
): Promise<void> {
  const id = dealId.trim();
  if (!id) return;

  const investments = await db
    .select({
      id: dealInvestment.id,
      esignStatusJson: dealInvestment.esignStatusJson,
    })
    .from(dealInvestment)
    .where(eq(dealInvestment.dealId, id));

  for (const row of investments) {
    const bundle = parseEsignStatusBundle(row.esignStatusJson);
    if (!bundle || !esignBundleNeedsDropboxSync(bundle)) continue;
    await syncDealInvestorEsignByTarget(id, {
      table: "investment",
      id: row.id,
    });
  }

  const roster = await db
    .select({
      id: dealLpInvestor.id,
      esignStatusJson: dealLpInvestor.esignStatusJson,
    })
    .from(dealLpInvestor)
    .where(eq(dealLpInvestor.dealId, id));

  for (const row of roster) {
    const bundle = parseEsignStatusBundle(row.esignStatusJson);
    if (!bundle || !esignBundleNeedsDropboxSync(bundle)) continue;
    await syncDealInvestorEsignByTarget(id, { table: "lp", id: row.id });
  }
}

function dropboxSignersAllSigned(
  signers: DropboxSignatureRequestDetail["signers"],
): boolean {
  if (!signers.length) return false;
  return signers.every((s) => {
    const code = String(s.statusCode ?? "").trim().toLowerCase();
    if (code === "signed") return true;
    return Boolean(s.signedAt?.trim());
  });
}

/**
 * After embedded signing, poll Dropbox until the request is complete and persist
 * `completedAt` so Invest Now / Investors tab show Signed (not stuck on Pending).
 */
/** After embedded `sign` event — persist Signed (and Viewed) without requiring full request complete. */
export async function syncDealInvestorEsignSignProgress(
  dealId: string,
  target: InvestorEsignRowTarget,
  signatureRequestId?: string,
): Promise<void> {
  const id = dealId.trim();
  const sigId = signatureRequestId?.trim();
  if (!id) return;

  if (sigId) {
    await markDealInvestorEsignSignedOptimistic(id, target, sigId);
  }
  await syncDealInvestorEsignByTarget(id, target);
}

/**
 * After embedded `finish` (Invest Now Sign tab) — poll Dropbox until Completed is stored.
 */
export async function syncDealInvestorEsignAfterEmbeddedSign(
  dealId: string,
  target: InvestorEsignRowTarget,
  signatureRequestId?: string,
): Promise<void> {
  const id = dealId.trim();
  const sigId = signatureRequestId?.trim();
  if (!id) return;

  if (sigId) {
    await markDealInvestorEsignSignedOptimistic(id, target, sigId);
  }

  for (let attempt = 0; attempt < EMBED_ESIGN_SYNC_ATTEMPTS; attempt++) {
    await syncDealInvestorEsignByTarget(id, target);

    if (!sigId) return;

    const raw = await readInvestorEsignStatusJson(id, target);
    const bundle = parseEsignStatusBundle(raw);
    const send = bundle
      ? findEsignSendBySignatureRequestId(bundle, sigId)
      : null;
    if (send?.completedAt?.trim()) return;

    try {
      const summary = await getSignatureRequestDetail(sigId);
      if (summary.isComplete) {
        await applyProgressFromDropbox(id, target, sigId, {
          forceComplete: true,
        });
        return;
      }
      if (dropboxSignersAllSigned(summary.signers)) {
        await applyProgressFromDropbox(id, target, sigId, {
          forceComplete: true,
        });
        return;
      }
    } catch (err) {
      console.warn("syncDealInvestorEsignAfterEmbeddedSign:", err);
    }

    if (attempt < EMBED_ESIGN_SYNC_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, EMBED_ESIGN_SYNC_DELAY_MS));
    }
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
      await resolveEsignTargetForInvestorRowId(dealId, params.rosterId.trim())
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
  /** One entry per profile template send with sent/viewed/signed/completed timestamps. */
  sends: DealInvestorEsignSendStatusApi[];
  dropbox: DropboxSignatureRequestDetail | null;
  syncedAt: string;
};

async function commitmentProfileIdForEsignTarget(
  dealId: string,
  target: InvestorEsignRowTarget,
): Promise<string | null> {
  if (target.table === "investment") {
    const [row] = await db
      .select({ profileId: dealInvestment.profileId })
      .from(dealInvestment)
      .where(
        and(
          eq(dealInvestment.id, target.id),
          eq(dealInvestment.dealId, dealId),
        ),
      )
      .limit(1);
    return row?.profileId?.trim() || null;
  }
  const [row] = await db
    .select({ profileId: dealLpInvestor.profileId })
    .from(dealLpInvestor)
    .where(
      and(eq(dealLpInvestor.id, target.id), eq(dealLpInvestor.dealId, dealId)),
    )
    .limit(1);
  return row?.profileId?.trim() || null;
}

/** Sync from Dropbox Sign, persist timestamps, return status for sponsor status popup. */
export async function getInvestorEsignStatusWithDropboxSync(
  dealId: string,
  rosterId: string,
): Promise<InvestorEsignStatusWithDropboxResult> {
  const syncedAt = new Date().toISOString();
  const id = dealId.trim();
  const target = await resolveEsignTargetForInvestorRowId(id, rosterId.trim());
  if (!target) {
    return { status: null, sends: [], dropbox: null, syncedAt };
  }

  const preferredCategoryId = esignCategoryFromCommitmentProfileId(
    await commitmentProfileIdForEsignTarget(id, target),
  );

  const rawInitial = await readInvestorEsignStatusJson(id, target);
  const bundleInitial = parseEsignStatusBundle(rawInitial);
  if (bundleInitial && esignBundleNeedsDropboxSync(bundleInitial) && getDropboxSignConfig()) {
    await syncDealInvestorEsignByTarget(id, target);
  }

  const rawAfterSync = await readInvestorEsignStatusJson(id, target);
  const bundleAfterSync = parseEsignStatusBundle(rawAfterSync);
  let sends = bundleAfterSync
    ? esignBundleToSendStatusList(bundleAfterSync)
    : [];

  if (sends.length > 0) {
    sends = await Promise.all(
      sends.map(async (send) => {
        const documents = await enrichEsignDocumentsWithCategories(
          id,
          send.documents,
        );
        return { ...send, documents };
      }),
    );
  }

  let status = parseEsignStatusJson(rawAfterSync, preferredCategoryId);
  if (status?.documents?.length) {
    const documents = await enrichEsignDocumentsWithCategories(
      id,
      status.documents,
    );
    status = { ...status, documents };
  }

  let dropbox: DropboxSignatureRequestDetail | null = null;
  const requestId = status?.signatureRequestId?.trim();
  if (requestId && getDropboxSignConfig()) {
    try {
      dropbox = await getSignatureRequestDetail(requestId);
    } catch (err) {
      console.warn("getSignatureRequestDetail:", err);
    }
  }

  return { status, sends, dropbox, syncedAt };
}
