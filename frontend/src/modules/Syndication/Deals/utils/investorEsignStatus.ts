import {
  dealAssetRelativePathToUploadsUrl,
  getUploadsPublicOrigin,
} from "../../../../common/utils/apiBaseUrl"
import { formatDateDdMmmYyyy } from "../../../../common/utils/formatDateDisplay"
import type {
  DealInvestorEsignStatus,
  DealInvestorRow,
} from "../types/deal-investors.types"

export type EsignWorkflowStepKey = "sent" | "viewed" | "signed" | "completed"

export interface EsignWorkflowStep {
  key: EsignWorkflowStepKey
  label: string
  done: boolean
  atIso: string | null
  atDisplay: string
}

export function parseEsignStatusFromApi(
  raw: unknown,
): DealInvestorEsignStatus | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const sentAt = strOrNull(o.sentAt ?? o.sent_at)
  if (!sentAt) return undefined
  const documents = Array.isArray(o.documents)
    ? o.documents
        .map((d) => {
          if (!d || typeof d !== "object" || Array.isArray(d)) return null
          const doc = d as Record<string, unknown>
          const fileId = String(doc.fileId ?? doc.file_id ?? "").trim()
          const name = String(doc.name ?? "").trim()
          const signedRelativePath = String(
            doc.signedRelativePath ?? doc.signed_relative_path ?? "",
          ).trim()
          const categoryId = String(
            doc.categoryId ?? doc.category_id ?? "",
          ).trim()
          if (!fileId || !name) return null
          return {
            fileId,
            name,
            ...(categoryId ? { categoryId } : {}),
            ...(signedRelativePath ? { signedRelativePath } : {}),
          }
        })
        .filter(
          (x): x is { fileId: string; name: string; signedRelativePath?: string } =>
            x != null,
        )
    : []
  return {
    sentAt,
    viewedAt: strOrNull(o.viewedAt ?? o.viewed_at),
    signedAt: strOrNull(o.signedAt ?? o.signed_at),
    completedAt: strOrNull(o.completedAt ?? o.completed_at),
    documents,
  }
}

function strOrNull(v: unknown): string | null {
  const s = String(v ?? "").trim()
  return s || null
}

export function investorRowShowsEsignStatusLink(
  row: DealInvestorRow,
): boolean {
  if (row.esignStatus?.sentAt) return true
  const s = String(row.signedDate ?? "").trim().toLowerCase()
  return s === "pending" || s === "completed"
}

export interface DealEsignDropboxSignerDetail {
  signatureId: string | null
  signerName: string | null
  signerEmail: string | null
  statusCode: string | null
  lastViewedAt: string | null
  signedAt: string | null
}

export interface DealEsignDropboxDetail {
  signatureRequestId: string
  isComplete: boolean
  isDeclined: boolean
  createdAt: string | null
  completeAt: string | null
  lastViewedAt: string | null
  lastSignedAt: string | null
  signers: DealEsignDropboxSignerDetail[]
}

export function parseDropboxDetailFromApi(
  raw: unknown,
): DealEsignDropboxDetail | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const signers = Array.isArray(o.signers)
    ? o.signers
        .map((s) => {
          if (!s || typeof s !== "object" || Array.isArray(s)) return null
          const sig = s as Record<string, unknown>
          return {
            signatureId: strOrNull(sig.signatureId ?? sig.signature_id),
            signerName: strOrNull(sig.signerName ?? sig.signer_name),
            signerEmail: strOrNull(sig.signerEmail ?? sig.signer_email),
            statusCode: strOrNull(sig.statusCode ?? sig.status_code),
            lastViewedAt: strOrNull(sig.lastViewedAt ?? sig.last_viewed_at),
            signedAt: strOrNull(sig.signedAt ?? sig.signed_at),
          }
        })
        .filter((x): x is DealEsignDropboxSignerDetail => x != null)
    : []
  const signatureRequestId = String(
    o.signatureRequestId ?? o.signature_request_id ?? "",
  ).trim()
  if (!signatureRequestId) return null
  return {
    signatureRequestId,
    isComplete: Boolean(o.isComplete ?? o.is_complete),
    isDeclined: Boolean(o.isDeclined ?? o.is_declined),
    createdAt: strOrNull(o.createdAt ?? o.created_at),
    completeAt: strOrNull(o.completeAt ?? o.complete_at),
    lastViewedAt: strOrNull(o.lastViewedAt ?? o.last_viewed_at),
    lastSignedAt: strOrNull(o.lastSignedAt ?? o.last_signed_at),
    signers,
  }
}

/** Prefer stored timestamps; fill gaps from Dropbox Sign after sync. */
export function mergeEsignStatusWithDropbox(
  status: DealInvestorEsignStatus,
  dropbox: DealEsignDropboxDetail | null | undefined,
): DealInvestorEsignStatus {
  if (!dropbox) return status
  const primary = dropbox.signers[0]
  const viewedAt =
    status.viewedAt?.trim() ||
    dropbox.lastViewedAt?.trim() ||
    primary?.lastViewedAt?.trim() ||
    null
  const signedAt =
    status.signedAt?.trim() ||
    dropbox.lastSignedAt?.trim() ||
    primary?.signedAt?.trim() ||
    null
  const completedAt =
    status.completedAt?.trim() ||
    (dropbox.isComplete ? dropbox.completeAt?.trim() || signedAt : null) ||
    null
  return {
    ...status,
    viewedAt,
    signedAt,
    completedAt,
  }
}

export function formatDropboxSignerStatusCode(code: string | null | undefined): string {
  const c = String(code ?? "").trim().toLowerCase()
  if (!c) return "—"
  const labels: Record<string, string> = {
    awaiting_signature: "Awaiting signature",
    viewed: "Viewed",
    signed: "Signed",
    on_hold: "On hold",
    declined: "Declined",
    error_converting: "Error",
    error_file: "File error",
  }
  return labels[c] ?? c.replace(/_/g, " ")
}

export function esignWorkflowSteps(
  status: DealInvestorEsignStatus,
): EsignWorkflowStep[] {
  const completedAt = status.completedAt?.trim() || null
  const viewedAt = status.viewedAt?.trim() || null
  const signedAt = status.signedAt?.trim() || null
  const defs: Array<{
    key: EsignWorkflowStepKey
    label: string
    at: string | null | undefined
    done: boolean
  }> = [
    { key: "sent", label: "Sent", at: status.sentAt, done: Boolean(status.sentAt?.trim()) },
    {
      key: "viewed",
      label: "Viewed",
      at: viewedAt ?? (completedAt ? completedAt : null),
      done: Boolean(viewedAt || completedAt),
    },
    {
      key: "signed",
      label: "Signed",
      at: signedAt ?? (completedAt ? completedAt : null),
      done: Boolean(signedAt || completedAt),
    },
    {
      key: "completed",
      label: "Completed",
      at: completedAt,
      done: Boolean(completedAt),
    },
  ]
  return defs.map(({ key, label, at, done }) => {
    const atIso = at?.trim() || null
    return {
      key,
      label,
      done,
      atIso,
      atDisplay: done && atIso ? formatEsignStepTimestamp(atIso) : "Not yet",
    }
  })
}

export interface EsignDocumentStatusRow {
  fileId: string
  name: string
  sentDisplay: string
  viewedDisplay: string
  signedDisplay: string
  completedDisplay: string
}

export function esignDocumentStatusRows(
  status: DealInvestorEsignStatus,
): EsignDocumentStatusRow[] {
  const sent = status.sentAt?.trim()
  const sentDisplay = sent ? formatEsignStepTimestamp(sent) : "—"
  const viewedAt = status.viewedAt?.trim()
  const signedAt = status.signedAt?.trim()
  const completedAt = status.completedAt?.trim()
  const viewedDisplay = viewedAt ? formatEsignStepTimestamp(viewedAt) : "Not yet"
  const signedDisplay = signedAt ? formatEsignStepTimestamp(signedAt) : "Not yet"
  const completedDisplay = completedAt
    ? formatEsignStepTimestamp(completedAt)
    : "Not yet"
  const docs = status.documents?.length
    ? status.documents
    : [{ fileId: "—", name: "Documents" }]
  return docs.map((d) => ({
    fileId: d.fileId,
    name: d.name,
    sentDisplay,
    viewedDisplay,
    signedDisplay,
    completedDisplay,
  }))
}

export function formatEsignStepTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return formatDateDdMmmYyyy(iso)
  const date = formatDateDdMmmYyyy(d)
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
  return `${date} · ${time}`
}

/** Absolute browser URL for an eSign document path from the API (`/uploads/...` or relative). */
export function resolveEsignDocumentUrlForViewer(
  url: string | null | undefined,
): string | null {
  const raw = String(url ?? "").trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw
  const segment = raw.replace(/^\/uploads\/?/i, "").replace(/^\/+/, "")
  const path = segment
    ? dealAssetRelativePathToUploadsUrl(segment)
    : raw.startsWith("/")
      ? raw
      : dealAssetRelativePathToUploadsUrl(raw)
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  const origin = getUploadsPublicOrigin().replace(/\/$/, "")
  return origin ? `${origin}${path}` : path
}

function signedPdfRelativePathFromStatus(
  status: DealInvestorEsignStatus,
  doc?: { signedRelativePath?: string },
): string | null {
  const rel =
    doc?.signedRelativePath?.trim() ||
    status.documents.find((d) => d.signedRelativePath?.trim())?.signedRelativePath?.trim() ||
    ""
  return rel || null
}

function uploadsUrlFromRelativePath(rel: string): string | null {
  const path = dealAssetRelativePathToUploadsUrl(rel.trim())
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  const origin = getUploadsPublicOrigin().replace(/\/$/, "")
  return origin ? `${origin}${path}` : path
}

/** Browser URL for the combined signed PDF after eSign completion (sponsors / investors). */
export function resolveEsignSignedPdfUrl(
  status: DealInvestorEsignStatus,
): string | null {
  if (!status.completedAt?.trim()) return null
  const rel = signedPdfRelativePathFromStatus(status)
  if (!rel) return null
  return uploadsUrlFromRelativePath(rel)
}

/** Signed PDF URL for a document row (same combined PDF when paths match). */
export function resolveEsignSignedPdfUrlForDocument(
  status: DealInvestorEsignStatus,
  doc: { signedRelativePath?: string },
): string | null {
  if (!status.completedAt?.trim()) return null
  const rel = signedPdfRelativePathFromStatus(status, doc)
  if (!rel) return null
  return uploadsUrlFromRelativePath(rel)
}

export function esignSignedPdfDownloadFilename(
  row: DealInvestorRow,
): string {
  const name = row.displayName?.trim()
  const base =
    name && name !== "—"
      ? name.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 80)
      : "investor"
  return `${base}-signed-esign.pdf`
}

export function investorEsignIsCompleted(
  status: DealInvestorEsignStatus,
  row: DealInvestorRow,
): boolean {
  if (status.completedAt?.trim()) return true
  return String(row.signedDate ?? "").trim().toLowerCase() === "completed"
}

/** Minimal status when column is Pending but JSON was not stored (older sends). */
export function fallbackEsignStatusForRow(
  row: DealInvestorRow,
): DealInvestorEsignStatus | null {
  if (row.esignStatus?.sentAt) return row.esignStatus
  if (String(row.signedDate ?? "").trim().toLowerCase() !== "pending") {
    return null
  }
  return {
    sentAt: new Date().toISOString(),
    viewedAt: null,
    signedAt: null,
    completedAt: null,
    documents: [],
  }
}
