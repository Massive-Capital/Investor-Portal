import { Download, Eye, FileSignature, FileText, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { fetchDealMemberEsignStatus } from "../../api/dealsApi"
import type {
  DealInvestorEsignStatus,
  DealInvestorRow,
} from "../../types/deal-investors.types"
import {
  buildEsignProfileStatusTabs,
  resolveInvestorEsignCategoryId,
  type EsignProfileStatusTab,
} from "../../utils/esignTemplateCategories"
import {
  esignSignedPdfDownloadFilename,
  esignWorkflowSteps,
  fallbackEsignStatusForRow,
  formatDropboxSignerStatusCode,
  formatEsignStepTimestamp,
  investorEsignIsCompleted,
  mergeEsignStatusWithDropbox,
  resolveEsignSignedPdfUrlForDocument,
  type DealEsignDropboxDetail,
  type EsignWorkflowStep,
} from "../../utils/investorEsignStatus"
import "@/modules/Syndication/usermanagement/user_management.css"
import "./investor-esign-status-modal.css"

function rowRecipientLabel(row: DealInvestorRow): string {
  const name = row.displayName?.trim()
  if (name && name !== "—") return name
  const email = row.userEmail?.trim()
  if (email && email !== "—") return email
  return "Investor"
}

export interface InvestorEsignStatusModalProps {
  open: boolean
  dealId: string
  row: DealInvestorRow | null
  onClose: () => void
  onStatusSynced?: () => void
}

function EsignHorizontalProgress({ steps }: { steps: EsignWorkflowStep[] }) {
  return (
    <ol className="deal_esign_progress_h" aria-label="Signing progress">
      {steps.map((step) => (
        <li
          key={step.key}
          className={`deal_esign_progress_h_step${
            step.done ? " deal_esign_progress_h_step_done" : ""
          }${step.done ? "" : " deal_esign_progress_h_step_pending"}`}
        >
          <span className="deal_esign_progress_h_dot" aria-hidden />
          <p className="deal_esign_progress_h_label">{step.label}</p>
          <p className="deal_esign_progress_h_time">{step.atDisplay}</p>
        </li>
      ))}
    </ol>
  )
}

function ProfileTabPanel({
  tab,
  steps,
  dropbox,
  status,
  completed,
  downloadName,
}: {
  tab: EsignProfileStatusTab
  steps: EsignWorkflowStep[]
  dropbox: DealEsignDropboxDetail | null
  status: DealInvestorEsignStatus
  completed: boolean
  downloadName: string
}) {
  const primarySigner = dropbox?.signers[0]

  return (
    <div
      role="tabpanel"
      id={`deal-esign-profile-panel-${tab.categoryId}`}
      aria-labelledby={`deal-esign-profile-tab-${tab.categoryId}`}
      className="deal_esign_status_panel"
    >
      <div className="deal_esign_panel deal_esign_panel--muted">
        <p className="deal_esign_panel_title">Signing progress</p>
        <EsignHorizontalProgress steps={steps} />
        {primarySigner ? (
          <p className="deal_esign_dropbox_inline">
            Dropbox Sign:{" "}
            {formatDropboxSignerStatusCode(primarySigner.statusCode)}
            {primarySigner.lastViewedAt
              ? ` · viewed ${formatEsignStepTimestamp(primarySigner.lastViewedAt)}`
              : ""}
            {primarySigner.signedAt
              ? ` · signed ${formatEsignStepTimestamp(primarySigner.signedAt)}`
              : ""}
          </p>
        ) : null}
        {dropbox?.isDeclined ? (
          <p className="deal_esign_notice deal_esign_notice--error">
            Declined in Dropbox Sign.
          </p>
        ) : null}
      </div>

      <div className="deal_esign_panel">
        <p className="deal_esign_panel_title">{tab.label}</p>
        <ul className="deal_esign_status_doc_list">
          {tab.documents.map((d) => {
            const signedUrl = resolveEsignSignedPdfUrlForDocument(status, d)
            return (
              <li key={d.fileId} className="deal_esign_status_doc_row">
                <div className="deal_esign_status_doc_main">
                  <FileText
                    size={16}
                    className="deal_esign_doc_item_icon"
                    aria-hidden
                  />
                  <span className="deal_esign_status_doc_name">{d.name}</span>
                  {completed ? (
                    <span className="deal_esign_status_doc_badge">Signed</span>
                  ) : (
                    <span className="deal_esign_status_doc_badge deal_esign_status_doc_badge--pending">
                      Pending
                    </span>
                  )}
                </div>
                {completed && signedUrl ? (
                  <div
                    className="deal_esign_actions deal_esign_status_doc_actions"
                    role="group"
                    aria-label={`${d.name} signed PDF`}
                  >
                    <a
                      href={signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="deal_esign_btn_link"
                    >
                      <Eye size={15} strokeWidth={2} aria-hidden />
                      View
                    </a>
                    <a
                      href={signedUrl}
                      download={downloadName}
                      rel="noopener noreferrer"
                      className="deal_esign_btn_link deal_esign_btn_link--primary"
                    >
                      <Download size={15} strokeWidth={2} aria-hidden />
                      Download
                    </a>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
        {completed && !tab.documents.some((d) =>
          resolveEsignSignedPdfUrlForDocument(status, d),
        ) ? (
          <p className="deal_esign_notice" role="status">
            Signing is complete. The signed PDF is still being saved—use Refresh
            in a moment.
          </p>
        ) : null}
        {/* {!completed ? (
          <p className="deal_esign_sync_hint">
            The investor has not finished signing documents in this profile yet.
          </p>
        ) : null} */}
      </div>
    </div>
  )
}

export function InvestorEsignStatusModal({
  open,
  dealId,
  row,
  onClose,
  onStatusSynced,
}: InvestorEsignStatusModalProps) {
  const rowId = row?.id?.trim() ?? ""
  const dealIdTrimmed = dealId.trim()

  const [initialLoading, setInitialLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<DealInvestorEsignStatus | null>(null)
  const [dropbox, setDropbox] = useState<DealEsignDropboxDetail | null>(null)
  const [activeTabId, setActiveTabId] = useState<string | null>(null)

  const onSyncedRef = useRef(onStatusSynced)
  onSyncedRef.current = onStatusSynced
  const rowRef = useRef(row)
  rowRef.current = row

  const applyFetchResult = useCallback(
    (
      result: Awaited<ReturnType<typeof fetchDealMemberEsignStatus>>,
      fallbackRow: DealInvestorRow,
    ) => {
      if (!result.ok) {
        setError(result.message)
        const fallback = fallbackEsignStatusForRow(fallbackRow)
        setStatus(fallback)
        setDropbox(null)
        return
      }
      setError(null)
      setStatus(result.status)
      setDropbox(result.dropbox)
    },
    [],
  )

  const fetchStatus = useCallback(async () => {
    const currentRow = rowRef.current
    if (!rowId || !dealIdTrimmed || !currentRow) return
    setInitialLoading(true)

    const result = await fetchDealMemberEsignStatus(dealIdTrimmed, rowId)

    setInitialLoading(false)
    applyFetchResult(result, currentRow)
    if (result.ok) onSyncedRef.current?.()
  }, [applyFetchResult, dealIdTrimmed, rowId])

  useEffect(() => {
    if (!open || !rowId) {
      setStatus(null)
      setDropbox(null)
      setError(null)
      setActiveTabId(null)
      setInitialLoading(false)
      return
    }
    void fetchStatus()
  }, [open, rowId, dealIdTrimmed, fetchStatus])

  const mergedStatus = useMemo(() => {
    const base =
      status ?? (row ? fallbackEsignStatusForRow(row) : null)
    if (!base) return null
    return mergeEsignStatusWithDropbox(base, dropbox)
  }, [status, dropbox, row])

  const investorCategoryId = useMemo(
    () => (row ? resolveInvestorEsignCategoryId(row) : null),
    [row],
  )

  const profileTabs = useMemo(() => {
    if (!mergedStatus?.documents?.length) return []
    return buildEsignProfileStatusTabs(
      mergedStatus.documents,
      investorCategoryId,
    )
  }, [mergedStatus, investorCategoryId])

  useEffect(() => {
    if (profileTabs.length === 0) {
      setActiveTabId(null)
      return
    }
    setActiveTabId((prev) => {
      if (prev && profileTabs.some((t) => t.categoryId === prev)) return prev
      const match = profileTabs.find((t) => t.isInvestorProfile)
      return match?.categoryId ?? profileTabs[0]?.categoryId ?? null
    })
  }, [profileTabs])

  const steps = useMemo(
    () => (mergedStatus ? esignWorkflowSteps(mergedStatus) : []),
    [mergedStatus],
  )

  const activeTab = profileTabs.find((t) => t.categoryId === activeTabId) ?? null

  if (!open || !row || !mergedStatus) return null

  const completed = investorEsignIsCompleted(mergedStatus, row)
  const downloadName = esignSignedPdfDownloadFilename(row)
  const recipient = rowRecipientLabel(row)
  const email = row.userEmail?.trim()

  return (
    <div
      className="um_modal_overlay deal_esign_overlay deal_esign_status_overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="um_modal deal_esign_modal deal_esign_modal--status"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deal-inv-esign-status-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="um_modal_head">
          <h2
            id="deal-inv-esign-status-title"
            className="um_modal_title um_title_with_icon"
          >
            <FileSignature size={20} aria-hidden />
            <span>eSign status</span>
          </h2>
          <button
            type="button"
            className="um_modal_close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <div
          className={`deal_esign_modal_body deal_esign_status_body${
            initialLoading ? " deal_esign_status_body--loading" : ""
          }`}
        >
          <div className="deal_esign_recipient">
            <p className="deal_esign_recipient_name">{recipient}</p>
            {email && email !== "—" ? (
              <p className="deal_esign_recipient_meta">{email}</p>
            ) : null}
          </div>

          {/* <div className="deal_esign_status_toolbar">
            <p className="deal_esign_sync_hint" aria-live="polite">
              {syncing || initialLoading ? (
                <span className="deal_esign_status_row">
                  <Loader2 className="deal_esign_spin" size={14} aria-hidden />
                  Syncing from Dropbox Sign…
                </span>
              ) : (
                syncLabel
              )}
            </p>
            <button
              type="button"
              className="um_btn_secondary deal_esign_status_refresh_btn"
              disabled={syncing || initialLoading}
              onClick={handleRefresh}
            >
              <RefreshCw
                size={14}
                aria-hidden
                className={syncing ? "deal_esign_spin" : undefined}
              />
              Refresh
            </button>
          </div> */}

          {error ? (
            <p className="deal_esign_notice deal_esign_notice--error" role="alert">
              {error}
              {dropbox ? null : " Showing last known status."}
            </p>
          ) : null}

          {profileTabs.length > 0 ? (
            <>
              <div
                className="um_members_tabs_outer deals_tabs_outer um_segmented_tabs_outer deal_esign_status_tabs_outer"
                role="presentation"
              >
                <div
                  className="um_members_tabs_row deals_tabs_row um_segmented_tabs_row deal_esign_status_tabs_row"
                  role="tablist"
                  aria-label="Investor profile types"
                >
                  {profileTabs.map((tab) => {
                    const selected = tab.categoryId === activeTabId
                    return (
                      <button
                        key={tab.categoryId}
                        type="button"
                        role="tab"
                        id={`deal-esign-profile-tab-${tab.categoryId}`}
                        className={`um_members_tab deals_tabs_tab um_segmented_tab${
                          selected ? " um_members_tab_active" : ""
                        }`}
                        aria-selected={selected}
                        aria-controls={`deal-esign-profile-panel-${tab.categoryId}`}
                        onClick={() => setActiveTabId(tab.categoryId)}
                      >
                        <span className="deals_tabs_label um_segmented_tab_label">
                          {tab.label}
                        </span>
                        {tab.isInvestorProfile ? (
                          <span className="deal_esign_status_inv_badge">Investor</span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>

              {activeTab ? (
                <ProfileTabPanel
                  tab={activeTab}
                  steps={steps}
                  dropbox={dropbox}
                  status={mergedStatus}
                  completed={completed}
                  downloadName={downloadName}
                />
              ) : null}
            </>
          ) : (
            <div className="deal_esign_panel deal_esign_panel--muted">
              <p className="deal_esign_notice">
                No documents were recorded for this eSign send.
              </p>
              <EsignHorizontalProgress steps={steps} />
            </div>
          )}
        </div>

        <div className="deal_esign_modal_foot">
          <button type="button" className="um_btn_secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
