export interface DealInvestorEsignDocumentRef {
  fileId: string;
  name: string;
  /** eSign template profile folder (individual, llc, …). */
  categoryId?: string;
  /** Template PDF path at send time (preview while pending). */
  templateRelativePath?: string;
  /** Relative path under uploads root after investor completes signing. */
  signedRelativePath?: string;
}

/** One Dropbox Sign request (one investor profile send). */
export interface StoredDealInvestorEsignSend {
  sentAt: string;
  viewedAt?: string | null;
  signedAt?: string | null;
  completedAt?: string | null;
  signatureRequestId?: string;
  signatureId?: string;
  /** Primary profile for this send (from template category). */
  categoryId?: string;
  documents?: DealInvestorEsignDocumentRef[];
}

/** v2 — multiple profile sends on one investor row. */
export interface StoredDealInvestorEsignBundle {
  version: 2;
  sends: StoredDealInvestorEsignSend[];
}

/** @deprecated Legacy single-send shape — migrated to bundle on read. */
export interface StoredDealInvestorEsignStatus {
  sentAt: string;
  viewedAt?: string | null;
  signedAt?: string | null;
  completedAt?: string | null;
  signatureRequestId?: string;
  signatureId?: string;
  documents?: DealInvestorEsignDocumentRef[];
}

export interface DealInvestorEsignStatusApi {
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  completedAt: string | null;
  signatureRequestId: string | null;
  signatureId: string | null;
  documents: DealInvestorEsignDocumentRef[];
}

function parseDocumentRef(d: unknown): DealInvestorEsignDocumentRef | null {
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;
  const doc = d as Record<string, unknown>;
  const fileId = String(doc.fileId ?? doc.file_id ?? "").trim();
  const name = String(doc.name ?? "").trim();
  if (!fileId || !name) return null;
  const signedRelativePath = String(
    doc.signedRelativePath ?? doc.signed_relative_path ?? "",
  ).trim();
  const categoryId = String(doc.categoryId ?? doc.category_id ?? "").trim();
  const templateRelativePath = String(
    doc.templateRelativePath ?? doc.template_relative_path ?? "",
  ).trim();
  return {
    fileId,
    name,
    ...(categoryId ? { categoryId } : {}),
    ...(templateRelativePath ? { templateRelativePath } : {}),
    ...(signedRelativePath ? { signedRelativePath } : {}),
  };
}

function parseSendRecord(o: Record<string, unknown>): StoredDealInvestorEsignSend | null {
  const sentAt = String(o.sentAt ?? o.sent_at ?? "").trim();
  if (!sentAt) return null;
  const documents = Array.isArray(o.documents)
    ? o.documents
        .map(parseDocumentRef)
        .filter((d): d is DealInvestorEsignDocumentRef => d != null)
    : [];
  const categoryId = String(o.categoryId ?? o.category_id ?? "").trim();
  return {
    sentAt,
    viewedAt: o.viewedAt ? String(o.viewedAt).trim() : null,
    signedAt: o.signedAt ? String(o.signedAt).trim() : null,
    completedAt: o.completedAt ? String(o.completedAt).trim() : null,
    signatureRequestId: o.signatureRequestId
      ? String(o.signatureRequestId).trim()
      : undefined,
    signatureId: o.signatureId ? String(o.signatureId).trim() : undefined,
    ...(categoryId ? { categoryId } : {}),
    documents,
  };
}

export function primaryCategoryForSend(
  send: StoredDealInvestorEsignSend,
): string {
  const fromSend = send.categoryId?.trim();
  if (fromSend) return fromSend;
  const fromDoc = send.documents?.find((d) => d.categoryId?.trim())?.categoryId;
  return fromDoc?.trim() ?? "";
}

export function parseEsignStatusBundle(
  raw: string | null | undefined,
): StoredDealInvestorEsignBundle | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  try {
    const o = JSON.parse(s) as Record<string, unknown>;
    if (o.version === 2 && Array.isArray(o.sends)) {
      const sends = o.sends
        .map((item) =>
          item && typeof item === "object" && !Array.isArray(item)
            ? parseSendRecord(item as Record<string, unknown>)
            : null,
        )
        .filter((x): x is StoredDealInvestorEsignSend => x != null);
      if (sends.length === 0) return null;
      return { version: 2, sends };
    }

    const legacy = parseSendRecord(o);
    if (!legacy) return null;
    return { version: 2, sends: [legacy] };
  } catch {
    return null;
  }
}

export function serializeEsignStatusBundle(
  bundle: StoredDealInvestorEsignBundle,
): string {
  return JSON.stringify(bundle);
}

/** Flatten all sends for sponsor status UI and investor document lists. */
export function aggregateEsignStatusFromBundle(
  bundle: StoredDealInvestorEsignBundle,
): DealInvestorEsignStatusApi {
  const sends = [...bundle.sends].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
  );
  const documents: DealInvestorEsignDocumentRef[] = [];
  for (const send of sends) {
    const sig = send.signatureRequestId?.trim() ?? "";
    for (const d of send.documents ?? []) {
      const compositeId =
        sig && d.fileId ? `${sig}::${d.fileId}` : d.fileId;
      documents.push({
        ...d,
        fileId: compositeId,
        categoryId: d.categoryId?.trim() || primaryCategoryForSend(send) || undefined,
        signedRelativePath:
          d.signedRelativePath?.trim() ||
          (send.completedAt
            ? send.documents?.find((x) => x.signedRelativePath?.trim())
                ?.signedRelativePath
            : undefined),
      });
    }
  }

  const sentAt = sends[0]?.sentAt ?? null;
  const allComplete =
    sends.length > 0 && sends.every((s) => Boolean(s.completedAt?.trim()));
  const pending = pickPendingEsignSend(sends);
  const latest = sends[sends.length - 1]!;

  return {
    sentAt,
    viewedAt: pending?.viewedAt ?? latest.viewedAt ?? null,
    signedAt: pending?.signedAt ?? latest.signedAt ?? null,
    completedAt: allComplete
      ? sends
          .map((s) => s.completedAt?.trim())
          .filter(Boolean)
          .sort()
          .at(-1) ?? null
      : null,
    signatureRequestId:
      pending?.signatureRequestId?.trim() ??
      latest.signatureRequestId?.trim() ??
      null,
    signatureId:
      pending?.signatureId?.trim() ?? latest.signatureId?.trim() ?? null,
    documents,
  };
}

export function pickPendingEsignSend(
  sends: StoredDealInvestorEsignSend[],
): StoredDealInvestorEsignSend | null {
  const pending = sends
    .filter((s) => s.sentAt?.trim() && !s.completedAt?.trim())
    .sort(
      (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
    );
  return pending[0] ?? null;
}

export function findEsignSendBySignatureRequestId(
  bundle: StoredDealInvestorEsignBundle,
  signatureRequestId: string,
): StoredDealInvestorEsignSend | null {
  const id = signatureRequestId.trim();
  if (!id) return null;
  return (
    bundle.sends.find((s) => s.signatureRequestId?.trim() === id) ?? null
  );
}

export function esignBundleHasPending(
  bundle: StoredDealInvestorEsignBundle,
): boolean {
  return bundle.sends.some((s) => s.sentAt?.trim() && !s.completedAt?.trim());
}

export function esignBundleIsAllCompleted(
  bundle: StoredDealInvestorEsignBundle,
): boolean {
  return (
    bundle.sends.length > 0 &&
    bundle.sends.every((s) => Boolean(s.completedAt?.trim()))
  );
}

export function appendEsignSendToBundle(
  bundle: StoredDealInvestorEsignBundle,
  params: {
    documents: DealInvestorEsignDocumentRef[];
    signatureRequestId?: string;
    signatureId?: string;
  },
): StoredDealInvestorEsignBundle {
  const documents = params.documents.filter(
    (d) => d.fileId.trim() && d.name.trim(),
  );
  const categoryId = primaryCategoryForSend({ documents, sentAt: "" });

  const kept = bundle.sends.filter((s) => {
    if (s.completedAt?.trim()) return true;
    return primaryCategoryForSend(s) !== categoryId;
  });

  const newSend: StoredDealInvestorEsignSend = {
    sentAt: new Date().toISOString(),
    viewedAt: null,
    signedAt: null,
    completedAt: null,
    signatureRequestId: params.signatureRequestId?.trim() || undefined,
    signatureId: params.signatureId?.trim() || undefined,
    ...(categoryId ? { categoryId } : {}),
    documents,
  };

  return {
    version: 2,
    sends: [...kept, newSend],
  };
}

export function buildEsignStatusJsonOnSent(params: {
  documents: DealInvestorEsignDocumentRef[];
  signatureRequestId?: string;
  signatureId?: string;
}): string {
  const bundle = appendEsignSendToBundle({ version: 2, sends: [] }, params);
  return serializeEsignStatusBundle(bundle);
}

export function parseEsignStatusJson(
  raw: string | null | undefined,
): DealInvestorEsignStatusApi | null {
  const bundle = parseEsignStatusBundle(raw);
  if (!bundle?.sends.length) return null;
  return aggregateEsignStatusFromBundle(bundle);
}

/** @deprecated Use serializeEsignStatusBundle */
export function serializeEsignStatusJson(
  status: StoredDealInvestorEsignStatus,
): string {
  return JSON.stringify(status);
}
