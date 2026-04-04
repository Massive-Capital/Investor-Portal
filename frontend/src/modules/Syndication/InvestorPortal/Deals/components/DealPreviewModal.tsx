import {
  Activity,
  Briefcase,
  Calendar,
  DollarSign,
  FileText,
  Home,
  Landmark,
  Loader2,
  MapPin,
  Pencil,
  Send,
  Shield,
  Tag,
  Users,
  Wallet,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import { ViewReadonlyField } from "../../../../../common/components/ViewReadonlyField"
import { dealStageLabel } from "../../deals-mock-data"
import "../../../../usermanagement/user_management.css"
import { fetchDealById, type DealDetailApi } from "../api/dealsApi"
import {
  formatCommittedCurrency,
  formatDealListDateDisplay,
} from "../dealsListDisplay"
import "../deals-list.css"

interface DealPreviewModalProps {
  dealId: string | null
  onClose: () => void
}

function displayOrDash(v: string | null | undefined): string {
  const t = String(v ?? "").trim()
  return t.length ? t : "—"
}

function yesNo(v: boolean | undefined): string {
  if (v === true) return "Yes"
  if (v === false) return "No"
  return "—"
}

export function DealPreviewModal({ dealId, onClose }: DealPreviewModalProps) {
  const navigate = useNavigate()
  const [detail, setDetail] = useState<DealDetailApi | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!dealId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [dealId, onClose])

  useEffect(() => {
    if (!dealId) {
      setDetail(null)
      setError(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setDetail(null)
    void (async () => {
      try {
        const d = await fetchDealById(dealId)
        if (!cancelled) {
          setDetail(d)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load deal details.")
          setDetail(null)
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dealId])

  function handleEdit() {
    if (!dealId) return
    onClose()
    navigate(`/deals/create?edit=${encodeURIComponent(dealId)}`)
  }

  if (dealId == null) return null

  const lr = detail?.listRow

  return createPortal(
    <div
      className="um_modal_overlay deals_deal_view_modal_overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="um_modal um_modal_view deals_deal_view_modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deals-deal-view-title"
        aria-busy={loading}
      >
        <div className="um_modal_head">
          <h2 id="deals-deal-view-title" className="um_modal_title">
            Deal details
          </h2>
          <button
            type="button"
            className="um_modal_close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="deals_deal_view_modal_body">
          {loading ? (
            <div className="deals_deal_view_state" aria-live="polite">
              <Loader2
                className="deals_deal_view_spinner"
                size={28}
                strokeWidth={2}
                aria-hidden
              />
              <p className="deals_deal_view_state_text">Loading deal…</p>
            </div>
          ) : error ? (
            <p className="deals_deal_view_error" role="alert">
              {error}
            </p>
          ) : lr && detail ? (
            <div className="um_view_grid">
              <ViewReadonlyField
                Icon={Briefcase}
                label="Deal name"
                value={displayOrDash(lr.dealName ?? detail.dealName)}
              />
              <ViewReadonlyField
                Icon={Tag}
                label="Deal type"
                value={displayOrDash(detail.dealType)}
              />
              <ViewReadonlyField
                Icon={Activity}
                label="Deal stage"
                value={displayOrDash(dealStageLabel(detail.dealStage || lr.dealStage))}
              />
              <ViewReadonlyField
                Icon={Shield}
                label="SEC type"
                value={displayOrDash(detail.secType)}
              />
              <ViewReadonlyField
                Icon={Home}
                label="Property name"
                value={displayOrDash(detail.propertyName)}
              />
              <ViewReadonlyField
                Icon={MapPin}
                label="Location"
                value={
                  [detail.city, detail.country].filter((x) => x?.trim()).join(", ") ||
                  displayOrDash(lr.locationDisplay)
                }
              />
              <ViewReadonlyField
                Icon={Landmark}
                label="Owning entity"
                value={displayOrDash(detail.owningEntityName)}
              />
              <ViewReadonlyField
                Icon={Calendar}
                label="Close date"
                value={formatDealListDateDisplay(
                  lr.closeDateDisplay ?? detail.closeDate ?? "",
                )}
              />
              <ViewReadonlyField
                Icon={Calendar}
                label="Start date"
                value={formatDealListDateDisplay(
                  lr.startDateDisplay ?? lr.createdDateDisplay,
                )}
              />
              <ViewReadonlyField
                Icon={Wallet}
                label="Raise target"
                value={formatCommittedCurrency(lr.raiseTarget)}
              />
              <ViewReadonlyField
                Icon={DollarSign}
                label="Committed"
                value={formatCommittedCurrency(lr.totalAccepted)}
              />
              <ViewReadonlyField
                Icon={Users}
                label="Investors"
                value={displayOrDash(lr.investors)}
              />
              <ViewReadonlyField
                Icon={FileText}
                label="Investor class"
                value={
                  lr.investorClass && lr.investorClass !== "—"
                    ? lr.investorClass
                    : "—"
                }
              />
              <ViewReadonlyField
                Icon={Briefcase}
                label="Funds required before GP sign"
                value={yesNo(detail.fundsRequiredBeforeGpSign)}
              />
              <ViewReadonlyField
                Icon={Send}
                label="Auto send funding instructions"
                value={yesNo(detail.autoSendFundingInstructions)}
              />
              <ViewReadonlyField
                Icon={Calendar}
                label="Created"
                fieldClassName="deals_deal_view_field_full"
                value={
                  detail.createdAt
                    ? formatDealListDateDisplay(
                        lr.createdDateDisplay || detail.createdAt,
                      )
                    : formatDealListDateDisplay(lr.createdDateDisplay)
                }
              />
            </div>
          ) : (
            <p className="deals_deal_view_hint">No data.</p>
          )}
        </div>

        <div className="um_modal_actions um_modal_actions_view deals_deal_view_modal_actions">
          <button
            type="button"
            className="um_btn_secondary"
            onClick={onClose}
          >
            <X size={16} strokeWidth={2} aria-hidden />
            Close
          </button>
          <button
            type="button"
            className="um_btn_primary"
            onClick={handleEdit}
            disabled={!detail || Boolean(loading)}
          >
            <Pencil size={16} strokeWidth={2} aria-hidden />
            Edit
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
