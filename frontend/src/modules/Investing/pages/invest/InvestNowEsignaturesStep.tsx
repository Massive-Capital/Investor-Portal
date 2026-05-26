import { Download, Eye, FileSignature, Loader2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { DealEsignTemplateFileRecord } from "@/modules/Syndication/Deals/api/dealsApi"
import {
  fetchDealEsignTemplateViewUrl,
  fetchDealMyEsignDocuments,
  postDealMyEsignMarkViewed,
} from "@/modules/Syndication/Deals/api/dealsApi"
import { esignCategoryLabel } from "@/modules/Syndication/Deals/utils/esignTemplateCategories"
import { esignTemplateDisplayName } from "@/modules/Syndication/Deals/utils/esignTemplateDisplay"
import { resolveEsignDocumentUrlForViewer } from "@/modules/Syndication/Deals/utils/investorEsignStatus"
import { InvestmentEsignSignModal } from "@/modules/Investing/pages/investments/InvestmentEsignSignModal"
import type { InvestmentSignStatusPayload } from "@/modules/Investing/api/investmentSignatureApi"
import { InvestNowStepLayout } from "./InvestNowStepLayout"
// import { InvestNowSignStatusBadges } from "./InvestNowSignStatusBadges"

export type InvestNowEsignDocRow = {
  id: string
  name: string
  url: string
  status: "pending" | "signed"
  canSign: boolean
  signatureRequestId?: string
}

export interface InvestNowEsignaturesStepProps {
  dealId: string
  esignCategoryId: string
  profileTemplate: DealEsignTemplateFileRecord | undefined
  profileLabel: string
  /** When false, this profile's e-sign template does not include a questionnaire. */
  questionnaireInFlow?: boolean
  investorDisplayName: string
  sendError: string | null
  /** True after invest-now eSign send succeeded (documents prepared in Dropbox Sign). */
  esignSendOk: boolean
  esignLoading: boolean
  esignDocuments: InvestNowEsignDocRow[]
  esignPending: boolean
  esignCompleted: boolean
  /** Sent | Viewed | Signed | Completed — legacy bundle label (fallback). */
  esignWorkflowLabel?: string | null
  /** Webhook-backed status from `investment_signatures` (source of truth for step 5). */
  webhookSignStatus?: InvestmentSignStatusPayload | null
  signStatusLoading?: boolean
  /** From invest-now eSign send when document rows lack a request id. */
  fallbackSignatureRequestId?: string | null
  onRefreshDocuments: () => void | Promise<void>
  disabled: boolean
  error?: string
}

function safeDownloadFilename(name: string): string {
  const base = name.trim() || "document"
  return base.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 200)
}

export function InvestNowEsignaturesStep({
  dealId,
  esignCategoryId,
  profileTemplate,
  profileLabel,
  questionnaireInFlow = false,
  investorDisplayName,
  sendError,
  esignSendOk,
  esignLoading,
  esignDocuments,
  esignPending,
  esignCompleted,
  esignWorkflowLabel,
  webhookSignStatus,
  // signStatusLoading,
  fallbackSignatureRequestId,
  onRefreshDocuments,
  disabled,
  error,
}: InvestNowEsignaturesStepProps) {
  const [signModalOpen, setSignModalOpen] = useState(false)
  const [signModalSignatureRequestId, setSignModalSignatureRequestId] = useState<
    string | null
  >(null)
  const [templatePreviewUrl, setTemplatePreviewUrl] = useState<string | null>(
    null,
  )
  const [templatePreviewLoading, setTemplatePreviewLoading] = useState(false)

  const templateName = useMemo(
    () =>
      profileTemplate
        ? esignTemplateDisplayName(profileTemplate)
        : "Subscription document",
    [profileTemplate],
  )

  const categoryLabel = esignCategoryLabel(esignCategoryId)

  const profileReady = profileTemplate?.dropboxSignStatus === "ready"

  const firstPendingSignatureRequestId = useMemo(() => {
    const pending = esignDocuments.find(
      (d) => d.status !== "signed" && d.signatureRequestId?.trim(),
    )
    return (
      pending?.signatureRequestId?.trim() ||
      fallbackSignatureRequestId?.trim() ||
      null
    )
  }, [esignDocuments, fallbackSignatureRequestId])

  const hasUnsignedDocuments = useMemo(
    () => esignDocuments.some((d) => d.status !== "signed"),
    [esignDocuments],
  )

  const needsSignature = !esignLoading && !esignCompleted && Boolean(profileTemplate)

  const canStartSigning =
    needsSignature &&
    profileReady &&
    esignSendOk &&
    !sendError &&
    !esignCompleted &&
    Boolean(firstPendingSignatureRequestId) &&
    hasUnsignedDocuments

  const openSignModal = useCallback((signatureRequestId?: string | null) => {
    setSignModalSignatureRequestId(
      signatureRequestId?.trim() || firstPendingSignatureRequestId || null,
    )
    setSignModalOpen(true)
  }, [firstPendingSignatureRequestId])

  useEffect(() => {
    const fileId = profileTemplate?.id?.trim()
    if (!fileId || !dealId.trim()) {
      setTemplatePreviewUrl(null)
      return
    }
    let cancelled = false
    setTemplatePreviewLoading(true)
    void fetchDealEsignTemplateViewUrl(dealId, fileId).then((res) => {
      if (cancelled) return
      setTemplatePreviewLoading(false)
      setTemplatePreviewUrl(res.ok ? res.viewUrl : null)
    })
    return () => {
      cancelled = true
    }
  }, [dealId, profileTemplate?.id])

  const displayDocuments =
    esignDocuments.length > 0
      ? esignDocuments
      : profileTemplate &&
          needsSignature &&
          esignSendOk &&
          !sendError &&
          firstPendingSignatureRequestId
        ? [
            {
              id: `template-${profileTemplate.id}`,
              name: templateName,
              url: templatePreviewUrl ?? "",
              status: "pending" as const,
              canSign: canStartSigning,
              signatureRequestId: firstPendingSignatureRequestId,
            },
          ]
        : []

  function docCanSign(doc: InvestNowEsignDocRow): boolean {
    if (doc.status === "signed" || esignCompleted || disabled || !canStartSigning) {
      return false
    }
    const sigId =
      doc.signatureRequestId?.trim() || firstPendingSignatureRequestId
    return Boolean(sigId)
  }

  return (
    <InvestNowStepLayout
      titleId="invest-now-step-esignatures-title"
      title="E-signatures"
      hint={
        questionnaireInFlow
          ? `Review and sign the subscription document your lead sponsor configured for ${profileLabel} on this deal’s eSign Templates tab. Questionnaire steps use the same profile-specific settings from your sponsor.`
          : `Review and sign the subscription document your lead sponsor configured for ${profileLabel} on this deal’s eSign Templates tab.`
      }
      error={error}
    >
      {sendError && !esignLoading ? (
        <div className="invest_now_esign_send_error" role="alert">
          <p className="invest_now_esign_send_error_text">{sendError}</p>
          <button
            type="button"
            className="um_btn_secondary"
            disabled={disabled}
            onClick={() => onRefreshDocuments()}
          >
            Retry preparing documents
          </button>
        </div>
      ) : null}

      {esignLoading ? (
        <p className="invest_now_esign_status" role="status">
          <Loader2
            className="deals_create_loading_icon"
            size={18}
            aria-hidden
          />
          Preparing your documents…
        </p>
      ) : null}
{/* 
      {!esignLoading && webhookSignStatus ? (
        <div className="invest_now_esign_webhook_status" role="status">
          <p className="invest_now_esign_status">
            Signing progress (updated automatically):
          </p>
          <InvestNowSignStatusBadges
            status={webhookSignStatus.status}
            loading={signStatusLoading}
          />
          {webhookSignStatus.status !== "Completed" ? (
            <p className="invest_now_field_hint">
              Complete signing below. Status updates when Dropbox Sign confirms
              each step.
            </p>
          ) : (
            <p className="invest_now_field_hint">
              All signatures received. You can finish Invest Now.
            </p>
          )}
        </div>
      ) : null} */}

      {!esignLoading && !webhookSignStatus && esignWorkflowLabel ? (
        <p className="invest_now_esign_status" role="status">
          Document status:{" "}
          <strong>{esignWorkflowLabel}</strong>
          {esignWorkflowLabel.toLowerCase() !== "completed"
            ? " — complete signing below, then click Finish in the signing window."
            : " — you can finish Invest Now and return to your dashboard."}
        </p>
      ) : null}

      {!esignLoading && esignCompleted ? (
        <p className="invest_now_esign_status invest_now_esign_status_ok" role="status">
          All required documents are signed. You can finish and return to your
          dashboard.
        </p>
      ) : null}

      {!esignLoading && canStartSigning ? (
        <div className="invest_now_esign_sign_cta">
          <p className="invest_now_esign_sign_cta_text">
            Your subscription document is ready. Open the signing form to complete
            your signature.
          </p>
          {/* <button
            type="button"
            className="um_btn_primary invest_now_esign_sign_btn"
            disabled={disabled}
            onClick={() => openSignModal(firstPendingSignatureRequestId)}
          >
            <FileSignature size={18} strokeWidth={2} aria-hidden />
            Sign
          </button> */}
        </div>
      ) : null}

      {!profileTemplate && !esignLoading ? (
        <p className="deals_create_hint invest_now_step_desc_warn">
          No eSign template is uploaded for {profileLabel} on this deal. Contact
          your sponsor to add a document on the eSign Templates tab.
        </p>
      ) : null}

      {profileTemplate &&
      profileTemplate.dropboxSignStatus !== "ready" &&
      !esignPending &&
      !esignCompleted ? (
        <p className="deals_create_hint invest_now_step_desc_warn">
          The template for {profileLabel} is not ready for signing yet. Your
          sponsor must finish the Dropbox Sign setup on the eSign Templates tab.
        </p>
      ) : null}

      {displayDocuments.length > 0 ? (
        <ul className="invest_now_esign_doc_list">
          {displayDocuments.map((doc) => {
            const url = doc.url?.trim() || ""
            const showSign = docCanSign(doc)
            return (
              <li key={doc.id} className="invest_now_esign_doc_row">
                <div className="invest_now_esign_doc_main">
                  <FileSignature
                    className="invest_now_esign_doc_icon"
                    size={18}
                    strokeWidth={2}
                    aria-hidden
                  />
                  <div className="invest_now_esign_doc_text">
                    <div className="invest_now_esign_doc_name">{doc.name}</div>
                    <div className="invest_now_esign_doc_meta">
                      <span className="invest_now_esign_doc_meta_category">
                        {categoryLabel}
                      </span>
                      <span
                        className={
                          doc.status === "signed"
                            ? "invest_now_esign_doc_status invest_now_esign_doc_status--signed"
                            : templatePreviewLoading && !url
                              ? "invest_now_esign_doc_status invest_now_esign_doc_status--loading"
                              : "invest_now_esign_doc_status invest_now_esign_doc_status--pending"
                        }
                      >
                        {doc.status === "signed"
                          ? "Signed"
                          : templatePreviewLoading && !url
                            ? "Loading preview…"
                            : "Awaiting signature"}
                      </span>
                    </div>
                  </div>
                </div>
                {url || showSign ? (
                  <div
                    className="invest_now_esign_doc_actions"
                    role="group"
                    aria-label={`${doc.name} actions`}
                  >
                    {showSign ? (
                      <button
                        type="button"
                        className="um_btn_secondary invest_now_esign_doc_sign_btn"
                        disabled={disabled}
                        aria-label={`Sign ${doc.name}`}
                        onClick={() =>
                          openSignModal(doc.signatureRequestId ?? null)
                        }
                      >
                        <FileSignature size={16} strokeWidth={2} aria-hidden />
                        Sign
                      </button>
                    ) : null}
                    {url ? (
                      <>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="invest_now_esign_doc_link"
                          aria-label={`View ${doc.name}`}
                          onClick={() => {
                            const sig =
                              doc.signatureRequestId?.trim() ||
                              firstPendingSignatureRequestId
                            if (sig && dealId.trim()) {
                              void postDealMyEsignMarkViewed(dealId, sig)
                            }
                          }}
                        >
                          <Eye size={16} strokeWidth={2} aria-hidden />
                          View
                        </a>
                        <a
                          href={url}
                          download={safeDownloadFilename(doc.name)}
                          rel="noopener noreferrer"
                          className="invest_now_esign_doc_link"
                          aria-label={`Download ${doc.name}`}
                        >
                          <Download size={16} strokeWidth={2} aria-hidden />
                          Download
                        </a>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      {investorDisplayName ? (
        <p className="invest_now_field_hint">
          Signing as {investorDisplayName}.
        </p>
      ) : null}

      <InvestmentEsignSignModal
        open={signModalOpen}
        dealId={dealId.trim()}
        signatureRequestId={signModalSignatureRequestId}
        onClose={() => {
          setSignModalOpen(false)
          setSignModalSignatureRequestId(null)
        }}
        onSignedComplete={onRefreshDocuments}
      />
    </InvestNowStepLayout>
  )
}

export function mapMyEsignDocumentsToInvestNowRows(
  documents: Awaited<ReturnType<typeof fetchDealMyEsignDocuments>>["documents"],
): InvestNowEsignDocRow[] {
  return documents.map((d) => ({
    id: d.fileId,
    name: d.name,
    url: resolveEsignDocumentUrlForViewer(d.url) || "",
    status: d.status === "signed" ? "signed" : "pending",
    canSign: d.status === "pending",
    signatureRequestId: d.signatureRequestId?.trim() || undefined,
  }))
}
