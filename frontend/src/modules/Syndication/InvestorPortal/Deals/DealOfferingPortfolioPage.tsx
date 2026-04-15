import { ArrowLeft, Check, Copy, Eye, Loader2, Send, Share2, X } from "lucide-react"
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom"
import { FormTooltip } from "../../../../common/components/form-tooltip/FormTooltip"
import { usePortalMode } from "../../../../common/context/PortalModeContext"
import { setAppDocumentTitle } from "../../../../common/utils/appDocumentTitle"
import {
  buildLegacyPublicOfferingPreviewPageUrl,
  buildPublicOfferingPreviewPageUrl,
  fetchDealById,
  fetchDealInvestorClasses,
  fetchDealInvestors,
  fetchOfferingPreviewToken,
  fetchPublicOfferingPreview,
  postOfferingPreviewShareByEmail,
  type DealDetailApi,
} from "./api/dealsApi"
import {
  dealIdFromOfferingPortfolioPathname,
  EMPTY_INVESTORS_PAYLOAD,
  isDealUuidForOfferingPreview,
} from "./dealOfferingPreviewShared"
import { DealOfferingPreviewInner } from "./DealOfferingPreviewInner"
import { applyOfferingInvestorPreviewJsonFromServer } from "./utils/offeringPreviewServerState"
import {
  OFFERING_DETAILS_SECTION_ORDER,
  offeringPreviewInvestorVisibilityStorageKey,
  readOfferingPreviewInvestorVisibility,
} from "./utils/offeringPreviewInvestorVisibility"
import type { DealInvestorsPayload } from "./types/deal-investors.types"
import type { DealInvestorClass } from "./types/deal-investor-class.types"
import "./deal-members/add-investment/add_deal_modal.css"
import "./deal-offering-portfolio.css"
import "./deals-list.css"

function parseEmailsFromShareInput(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(/[\n\r,;]+/)) {
    const e = part.trim().toLowerCase()
    if (!e || seen.has(e)) continue
    seen.add(e)
    out.push(e)
  }
  return out
}

export function DealOfferingPortfolioPage() {
  const { mode } = usePortalMode()
  const { dealId: dealIdParam } = useParams<{ dealId: string }>()
  const [searchParams] = useSearchParams()
  const location = useLocation()

  const dealIdFromRoute = useMemo(() => {
    const fromParams = dealIdParam?.trim()
    if (fromParams) return fromParams
    return dealIdFromOfferingPortfolioPathname(location.pathname)
  }, [dealIdParam, location.pathname])

  const isPublicOfferingRoute = /\/offering_portfolio\/?$/.test(
    location.pathname,
  )

  /** Public route: encrypted token (or legacy UUID) from `?preview=`. */
  const previewQueryValue = useMemo(() => {
    if (!isPublicOfferingRoute) return undefined
    const raw = searchParams.get("preview")
    if (!raw?.trim()) return undefined
    try {
      return decodeURIComponent(raw.trim())
    } catch {
      return raw.trim()
    }
  }, [isPublicOfferingRoute, searchParams])

  /** UUID from `/deals/:id/offering-portfolio` or preview param after server resolution (same string used for API). */
  const effectiveDealId = useMemo(() => {
    if (isPublicOfferingRoute) return previewQueryValue
    return dealIdFromRoute?.trim() || undefined
  }, [isPublicOfferingRoute, previewQueryValue, dealIdFromRoute])

  const [detail, setDetail] = useState<DealDetailApi | null>(null)
  const [classes, setClasses] = useState<DealInvestorClass[]>([])
  const [investorsPayload, setInvestorsPayload] =
    useState<DealInvestorsPayload>(EMPTY_INVESTORS_PAYLOAD)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [lpShareToken, setLpShareToken] = useState<string | null>(null)
  const [lpShareTokenError, setLpShareTokenError] = useState(false)

  useEffect(() => {
    if (isPublicOfferingRoute || !dealIdFromRoute?.trim()) {
      setLpShareToken(null)
      setLpShareTokenError(false)
      return
    }
    let cancelled = false
    setLpShareToken(null)
    setLpShareTokenError(false)
    void (async () => {
      try {
        const t = await fetchOfferingPreviewToken(dealIdFromRoute.trim())
        if (!cancelled) setLpShareToken(t)
      } catch {
        if (!cancelled) setLpShareTokenError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dealIdFromRoute, isPublicOfferingRoute])

  const shareLinkLoading =
    !isPublicOfferingRoute &&
    Boolean(dealIdFromRoute?.trim()) &&
    lpShareToken === null &&
    !lpShareTokenError

  const previewShareUrl = useMemo(() => {
    if (typeof window === "undefined" || isPublicOfferingRoute) {
      return ""
    }
    if (lpShareToken?.trim()) {
      return buildPublicOfferingPreviewPageUrl(lpShareToken.trim())
    }
    if (
      lpShareTokenError &&
      dealIdFromRoute &&
      isDealUuidForOfferingPreview(dealIdFromRoute)
    ) {
      return buildLegacyPublicOfferingPreviewPageUrl(dealIdFromRoute)
    }
    return ""
  }, [
    lpShareToken,
    lpShareTokenError,
    dealIdFromRoute,
    isPublicOfferingRoute,
  ])

  const sharePreviewUsesLegacyLink =
    !isPublicOfferingRoute &&
    Boolean(previewShareUrl) &&
    !lpShareToken &&
    lpShareTokenError &&
    isDealUuidForOfferingPreview(dealIdFromRoute)

  const previewShareUrlDisplayText = useMemo(() => {
    const name =
      detail?.dealName?.trim() ||
      detail?.propertyName?.trim() ||
      "Deal"
    return `${name} Offering`
  }, [detail?.dealName, detail?.propertyName])

  const [copyLinkState, setCopyLinkState] = useState<"idle" | "copied" | "error">(
    "idle",
  )

  const [investorVisibilitySync, setInvestorVisibilitySync] = useState(0)

  useEffect(() => {
    if (!detail?.id || isPublicOfferingRoute) return
    const key = offeringPreviewInvestorVisibilityStorageKey(detail.id)
    const bump = () => setInvestorVisibilitySync((n) => n + 1)
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) bump()
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener("focus", bump)
    document.addEventListener("visibilitychange", bump)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("focus", bump)
      document.removeEventListener("visibilitychange", bump)
    }
  }, [detail?.id, isPublicOfferingRoute])

  const hasAnyInvestorVisibleSection = useMemo(() => {
    if (!detail?.id || isPublicOfferingRoute) return true
    const v = readOfferingPreviewInvestorVisibility(detail.id)
    return OFFERING_DETAILS_SECTION_ORDER.some(({ id }) => v[id] !== false)
  }, [detail?.id, isPublicOfferingRoute, investorVisibilitySync])

  const sharePreviewActionsDisabled =
    !previewShareUrl ||
    shareLinkLoading ||
    (!isPublicOfferingRoute && !hasAnyInvestorVisibleSection)

  const copyPreviewLink = useCallback(() => {
    if (!previewShareUrl || sharePreviewActionsDisabled) return
    void (async () => {
      try {
        await navigator.clipboard.writeText(previewShareUrl)
        setCopyLinkState("copied")
        window.setTimeout(() => setCopyLinkState("idle"), 2000)
      } catch {
        setCopyLinkState("error")
        window.setTimeout(() => setCopyLinkState("idle"), 2800)
      }
    })()
  }, [previewShareUrl, sharePreviewActionsDisabled])

  const shareModalTitleId = useId()
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [shareEmailsText, setShareEmailsText] = useState("")
  const [shareSubmitting, setShareSubmitting] = useState(false)
  const [shareResultMessage, setShareResultMessage] = useState<string | null>(
    null,
  )
  const [shareResultFailures, setShareResultFailures] = useState<
    { email: string; message: string }[]
  >([])

  const openShareModal = useCallback(() => {
    if (sharePreviewActionsDisabled) return
    setShareResultMessage(null)
    setShareResultFailures([])
    setShareModalOpen(true)
  }, [sharePreviewActionsDisabled])

  const closeShareModal = useCallback(() => {
    if (shareSubmitting) return
    setShareModalOpen(false)
    setShareResultMessage(null)
    setShareResultFailures([])
  }, [shareSubmitting])

  const submitShareByEmail = useCallback(() => {
    const dealId = dealIdFromRoute?.trim()
    if (!dealId) return
    const emails = parseEmailsFromShareInput(shareEmailsText)
    if (emails.length === 0) {
      setShareResultMessage("Add at least one email address (comma or line separated).")
      return
    }
    setShareSubmitting(true)
    setShareResultMessage(null)
    setShareResultFailures([])
    void (async () => {
      try {
        const r = await postOfferingPreviewShareByEmail(dealId, emails)
        setShareResultFailures(r.failures)
        setShareResultMessage(
          r.message ??
            (r.sent > 0 ? `Sent ${r.sent} email(s).` : "No emails were sent."),
        )
        if (r.sent > 0 && r.failures.length === 0) {
          setShareEmailsText("")
          window.setTimeout(() => {
            setShareModalOpen(false)
            setShareResultMessage(null)
          }, 1600)
        }
      } catch (e) {
        setShareResultMessage(
          e instanceof Error ? e.message : "Could not send emails.",
        )
      } finally {
        setShareSubmitting(false)
      }
    })()
  }, [dealIdFromRoute, shareEmailsText])

  useEffect(() => {
    if (!effectiveDealId) {
      setLoading(false)
      setNotFound(true)
      return
    }
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    void (async () => {
      try {
        if (isPublicOfferingRoute) {
          const pack = await fetchPublicOfferingPreview(effectiveDealId)
          if (cancelled) return
          applyOfferingInvestorPreviewJsonFromServer(
            pack.deal.id,
            pack.deal.offeringInvestorPreviewJson,
          )
          setDetail(pack.deal)
          setClasses(pack.investorClasses)
          setInvestorsPayload(pack.investorsPayload)
        } else {
          const d = await fetchDealById(effectiveDealId)
          const [icResult, invResult] = await Promise.allSettled([
            fetchDealInvestorClasses(effectiveDealId),
            fetchDealInvestors(effectiveDealId),
          ])
          if (cancelled) return
          applyOfferingInvestorPreviewJsonFromServer(
            d.id,
            d.offeringInvestorPreviewJson,
          )
          setDetail(d)
          setClasses(icResult.status === "fulfilled" ? icResult.value : [])
          setInvestorsPayload(
            invResult.status === "fulfilled"
              ? invResult.value
              : EMPTY_INVESTORS_PAYLOAD,
          )
        }
      } catch {
        if (!cancelled) {
          setDetail(null)
          setClasses([])
          setInvestorsPayload(EMPTY_INVESTORS_PAYLOAD)
          setNotFound(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [effectiveDealId, isPublicOfferingRoute])

  const title =
    detail?.dealName?.trim() ||
    detail?.propertyName?.trim() ||
    "Offering"

  useEffect(() => {
    if (loading) {
      setAppDocumentTitle("Investor Portal Offering", { plain: true })
      return
    }
    if (notFound || !detail) {
      setAppDocumentTitle("Investor Portal Offering not found", { plain: true })
      return
    }
    setAppDocumentTitle(`Investor Portal ${title} Offering`, { plain: true })
  }, [loading, notFound, detail, title])

  if (!effectiveDealId) {
    return (
      <div className="deals_list_page deals_detail_page">
        <p className="deals_list_not_found">
          {isPublicOfferingRoute
            ? "Missing or invalid preview link. Ask your sponsor for a valid offering link."
            : "Missing deal."}
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="deals_list_page deals_detail_page">
        <div className="deal_offer_pf deal_offer_pf_state" role="status">
          <Loader2
            className="deal_offer_pf_spinner"
            size={36}
            strokeWidth={2}
            aria-hidden
          />
          <p className="deal_offer_pf_state_text">Loading offering preview…</p>
        </div>
      </div>
    )
  }

  if (notFound || !detail) {
    return (
      <div className="deals_list_page deals_detail_page">
        <p className="deals_list_not_found">
          This offering could not be loaded.{" "}
          <Link to="/deals" className="deal_offer_pf_back">
            <ArrowLeft size={18} strokeWidth={2} aria-hidden />
            Back to deals
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="deals_list_page deals_detail_page deal_offer_pf_page">
      <div className="deal_offer_pf">
        <header className="deal_offer_pf_header">
          {!isPublicOfferingRoute ? (
            <Link
              to={`/deals/${encodeURIComponent(effectiveDealId)}`}
              className="deal_offer_pf_back"
            >
              <ArrowLeft size={18} strokeWidth={2} aria-hidden />
              Back to deal
            </Link>
          ) : (
            <div className="deal_offer_pf_public_top">
              <span className="deal_offer_pf_badge">Shared offering</span>
              <Link to="/signin" className="deal_offer_pf_signin_link">
                Sign in to the portal
              </Link>
            </div>
          )}
          <div className="deal_offer_pf_header_meta">
            {!isPublicOfferingRoute ? (
              <span className="deal_offer_pf_badge">Investment offering</span>
            ) : null}
            {/*
              Signed-in preview hint (hidden):
              Sections match “Make it visible to Investors” in Offering details
            */}
            {isPublicOfferingRoute ? (
              <span className="deal_offer_pf_header_hint">
                <Eye size={15} strokeWidth={2} aria-hidden />
                No login required for this page
              </span>
            ) : null}
          </div>
          {!isPublicOfferingRoute ? (
            <div className="deal_offer_pf_share">
              <div className="deal_offer_pf_share_title_row">
                <Share2
                  size={17}
                  strokeWidth={2}
                  className="deal_offer_pf_share_icon"
                  aria-hidden
                />
                <span className="deal_offer_pf_share_title">Share preview</span>
              </div>
              {sharePreviewUsesLegacyLink ? (
                <p className="deal_offer_pf_share_hint" role="status">
                  This link uses the offering id in the URL. Ask your administrator
                  to configure encrypted preview links if you need to hide it.
                </p>
              ) : null}
              {shareLinkLoading ? (
                <p className="deal_offer_pf_share_loading" role="status">
                  <Loader2
                    size={16}
                    strokeWidth={2}
                    className="deal_offer_pf_share_loading_icon"
                    aria-hidden
                  />
                  Generating secure link…
                </p>
              ) : lpShareTokenError && !previewShareUrl ? (
                <p className="deal_offer_pf_share_error" role="alert">
                  Could not create a share link. Try refreshing the page. If it
                  keeps failing, contact your administrator.
                </p>
              ) : (
                <>
                  {sharePreviewUsesLegacyLink ? (
                    <p className="deal_offer_pf_share_warning" role="status">
                      Encrypted link was not available (for example, preview
                      encryption may not be configured on the server). You can
                      still copy the preview link below.
                    </p>
                  ) : null}
                  <div
                    className="deal_offer_pf_share_row deal_offer_pf_share_row_btns_only"
                    aria-label={
                      previewShareUrl &&
                      !shareLinkLoading &&
                      !hasAnyInvestorVisibleSection
                        ? `${previewShareUrlDisplayText}. Sharing is off until at least one section is visible to investors.`
                        : `${previewShareUrlDisplayText}. Use Copy link or Share by email.`
                    }
                  >
                    {/*
                    <div
                      className="deal_offer_pf_share_url_field"
                      aria-label={`Shared preview: ${previewShareUrlDisplayText}. Use Copy link or Share to send the URL.`}
                    >
                      {previewShareUrl ? previewShareUrlDisplayText : ""}
                    </div>
                    */}
                    <div className="deal_offer_pf_share_actions">
                      <div className="deal_offer_pf_share_copy_group">
                        <button
                          type="button"
                          className="deal_offer_pf_share_action_btn deal_offer_pf_share_action_btn_secondary"
                          disabled={sharePreviewActionsDisabled}
                          onClick={copyPreviewLink}
                        >
                          {copyLinkState === "copied" ? (
                            <>
                              <Check size={16} strokeWidth={2} aria-hidden />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy size={16} strokeWidth={2} aria-hidden />
                              Copy link
                            </>
                          )}
                        </button>
                        {previewShareUrl && !shareLinkLoading ? (
                          <FormTooltip
                            label={
                              hasAnyInvestorVisibleSection
                                ? "More information: Copy link"
                                : "Why Copy link and Share are unavailable"
                            }
                            content={
                              <p className="deals_table_header_tooltip_p">
                                {hasAnyInvestorVisibleSection
                                  ? "Copy the link or send it by email — LP investors can open the same preview without signing in."
                                  : "Nothing is set to appear for investors on this preview yet. Turn on at least one “Make it visible to Investors” toggle in Offering details or the Documents tab, then share the link."}
                              </p>
                            }
                            placement="top"
                            panelAlign="start"
                          />
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="deal_offer_pf_share_action_btn deal_offer_pf_share_action_btn_primary"
                        disabled={sharePreviewActionsDisabled}
                        onClick={openShareModal}
                      >
                        <Send size={16} strokeWidth={2} aria-hidden />
                        Share
                      </button>
                    </div>
                  </div>
                  {previewShareUrl &&
                  !shareLinkLoading &&
                  !hasAnyInvestorVisibleSection ? (
                    <p className="deal_offer_pf_share_disabled_hint" role="status">
                      Turn on at least one{" "}
                      <strong>Make it visible to Investors</strong> option in
                      Offering details or the Documents tab to enable Copy link and
                      Share.
                    </p>
                  ) : null}
                  {copyLinkState === "error" ? (
                    <p className="deal_offer_pf_share_error" role="status">
                      Could not copy automatically — try Copy link again, or
                      open this preview in your browser and copy the URL from
                      the address bar.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </header>

        <DealOfferingPreviewInner
          detail={detail}
          classes={classes}
          investorsPayload={investorsPayload}
          applyInvestorLinkVisibility={true}
          isPublicOfferingRoute={isPublicOfferingRoute}
          showInvestNowCta={
            isPublicOfferingRoute || mode === "investing"
          }
          galleryUsesPersistedSourcesOnly={true}
        />

        {!isPublicOfferingRoute && shareModalOpen
          ? createPortal(
              <div
                className="um_modal_overlay deals_add_inv_modal_overlay portal_modal_z_boost"
                role="presentation"
                onClick={(e) => {
                  if (e.target === e.currentTarget) closeShareModal()
                }}
              >
                <div
                  className="um_modal deals_add_inv_modal_panel add_contact_panel deal_offer_pf_share_modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={shareModalTitleId}
                >
                  <div className="um_modal_head add_contact_modal_head">
                    <h2
                      id={shareModalTitleId}
                      className="um_modal_title add_contact_modal_title"
                    >
                      Share preview by email
                    </h2>
                    <button
                      type="button"
                      className="um_modal_close"
                      aria-label="Close"
                      disabled={shareSubmitting}
                      onClick={closeShareModal}
                    >
                      <X size={20} strokeWidth={2} aria-hidden />
                    </button>
                  </div>
                  <div className="deals_add_inv_modal_scroll deal_offer_pf_share_modal_scroll">
                    <p className="deal_offering_muted deal_offer_pf_share_modal_lead">
                      Enter recipient email addresses. Each person receives the
                      same offering preview link (no login required). Separate
                      addresses with commas or put one per line.
                    </p>
                    <label
                      className="deal_offer_pf_share_modal_label"
                      htmlFor="deal-offer-pf-share-emails"
                    >
                      Email addresses
                    </label>
                    <textarea
                      id="deal-offer-pf-share-emails"
                      className="deal_offer_pf_share_modal_textarea"
                      rows={6}
                      value={shareEmailsText}
                      onChange={(e) => setShareEmailsText(e.target.value)}
                      placeholder="name@company.com, another@company.com"
                      disabled={shareSubmitting}
                      autoComplete="off"
                    />
                    {shareResultMessage ? (
                      <p
                        className={
                          shareResultFailures.length > 0
                            ? "deal_offer_pf_share_modal_feedback deal_offer_pf_share_modal_feedback_warn"
                            : "deal_offer_pf_share_modal_feedback"
                        }
                        role="status"
                      >
                        {shareResultMessage}
                      </p>
                    ) : null}
                    {shareResultFailures.length > 0 ? (
                      <ul className="deal_offer_pf_share_modal_fail_list">
                        {shareResultFailures.map((f) => (
                          <li key={f.email}>
                            <span className="deal_offer_pf_share_modal_fail_email">
                              {f.email}
                            </span>
                            <span className="deal_offer_pf_share_modal_fail_msg">
                              {" "}
                              — {f.message}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="um_modal_actions">
                    <button
                      type="button"
                      className="um_btn_secondary"
                      disabled={shareSubmitting}
                      onClick={closeShareModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="um_btn_primary"
                      disabled={shareSubmitting}
                      onClick={submitShareByEmail}
                    >
                      {shareSubmitting ? (
                        <>
                          <Loader2
                            size={16}
                            strokeWidth={2}
                            className="deal_offer_pf_spinner"
                            aria-hidden
                          />
                          Sending…
                        </>
                      ) : (
                        <>
                          <Send size={16} strokeWidth={2} aria-hidden />
                          Share
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}
      </div>
    </div>
  )
}
