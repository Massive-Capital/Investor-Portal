import DOMPurify from "dompurify"
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Copy,
  Eye,
  Loader2,
  Map,
  Megaphone,
  MoreVertical,
  Share2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import {
  Link,
  matchPath,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom"
import { setAppDocumentTitle } from "../../../../common/utils/appDocumentTitle"
import { formatDateDdMmmYyyy } from "../../../../common/utils/formatDateDisplay"
import {
  buildLegacyPublicOfferingPreviewPageUrl,
  buildPublicOfferingPreviewPageUrl,
  fetchDealById,
  fetchDealInvestorClasses,
  fetchDealInvestors,
  fetchOfferingPreviewToken,
  fetchPublicOfferingPreview,
  type DealDetailApi,
} from "./api/dealsApi"
import {
  acceptedAmountForPayload,
  formatUsdDashboardAmount,
  fundedAmountForPayload,
  targetAmountNumberForDeal,
} from "./dealsDashboardMoney"
import type { DealInvestorsPayload } from "./types/deal-investors.types"
import type { DealInvestorClass } from "./types/deal-investor-class.types"
import {
  investorClassStatusLabel,
  investorClassVisibilityLabel,
} from "./utils/offeringDisplayLabels"
import { formatMoneyFieldDisplay } from "./utils/offeringMoneyFormat"
import { orderedGalleryUrlsForOffering } from "./utils/offeringGalleryUrls"
import { dealStageChipCompactClassName } from "./utils/dealStageChip"
import { dealStageLabel } from "../deals-mock-data"
import "./deal-members/add-investment/add_deal_modal.css"
import "./deal-offering-portfolio.css"
import "./deals-list.css"

function boolLabel(value: boolean): string {
  return value ? "Yes" : "No"
}

/** Matches backend `offeringPreviewCrypto` UUID check for legacy `preview=` links. */
const DEAL_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isDealUuid(id: string | undefined): boolean {
  return Boolean(id?.trim() && DEAL_UUID_RE.test(id.trim()))
}

function dealIdFromOfferingPortfolioPathname(pathname: string): string | undefined {
  const normalized = pathname.replace(/\/+$/, "") || "/"
  const m = matchPath(
    { path: "/deals/:dealId/offering-portfolio", end: true },
    normalized,
  )
  const id = m?.params.dealId
  return typeof id === "string" && id.trim() ? id.trim() : undefined
}

const EMPTY_INVESTORS_PAYLOAD: DealInvestorsPayload = {
  kpis: {
    offeringSize: "—",
    committed: "—",
    remaining: "—",
    totalApproved: "—",
    totalPending: "—",
    totalFunded: "—",
    approvedCount: "—",
    pendingCount: "—",
    waitlistCount: "—",
    averageApproved: "—",
    nonAccreditedCount: "—",
  },
  investors: [],
}

/** Offering / raise target: sum of class sizes when present, else parsed list raise target / raw strings. */
function previewTargetDisplay(
  detail: DealDetailApi,
  classes: DealInvestorClass[],
): string {
  const n = targetAmountNumberForDeal(detail.listRow, classes)
  if (Number.isFinite(n) && n > 0) return formatUsdDashboardAmount(n)
  const raw =
    detail.offeringSize?.trim() ||
    detail.listRow.raiseTarget?.trim() ||
    ""
  if (raw && raw !== "—") return raw
  return "—"
}

function previewAcceptedDisplay(
  detail: DealDetailApi,
  payload: DealInvestorsPayload,
): string {
  const num = acceptedAmountForPayload(payload)
  if (Number.isFinite(num) && num > 0) return formatUsdDashboardAmount(num)
  const kpi = payload.kpis.committed?.trim()
  if (kpi && kpi !== "—") return kpi
  const lr = detail.listRow.totalAccepted?.trim()
  if (lr && lr !== "—") return lr
  return "—"
}

function previewFundedDisplay(payload: DealInvestorsPayload): string {
  const n = fundedAmountForPayload(payload)
  if (Number.isFinite(n) && n > 0) return formatUsdDashboardAmount(n)
  const kpi = payload.kpis.totalFunded?.trim()
  if (kpi && kpi !== "—") return kpi
  return "—"
}

function buildSummaryBits(
  detail: DealDetailApi,
  classes: DealInvestorClass[],
  payload: DealInvestorsPayload,
): string[] {
  const bits: string[] = []
  const target = previewTargetDisplay(detail, classes)
  if (target !== "—") bits.push(`Offering target: ${target}`)

  const accepted = previewAcceptedDisplay(detail, payload)
  if (accepted !== "—") bits.push(`Total accepted: ${accepted}`)

  const funded = previewFundedDisplay(payload)
  if (funded !== "—") bits.push(`Total funded: ${funded}`)

  const inv = detail.listRow.investors?.trim()
  if (inv && inv !== "—") bits.push(`Investors: ${inv}`)

  if (detail.dealType?.trim())
    bits.push(`Deal type: ${detail.dealType.trim()}`)
  if (detail.secType?.trim())
    bits.push(`Security type: ${detail.secType.trim()}`)
  const close = formatDateDdMmmYyyy(detail.closeDate?.trim())
  if (close !== "—") bits.push(`Target close: ${close}`)
  return bits
}

type KeyHighlightPreviewRow = { metric: string; newClass: string }

function keyHighlightRowsFromJson(
  raw: string | null | undefined,
): KeyHighlightPreviewRow[] {
  const t = raw?.trim()
  if (!t) return []
  try {
    const parsed = JSON.parse(t) as unknown
    if (!Array.isArray(parsed)) return []
    const out: KeyHighlightPreviewRow[] = []
    for (const item of parsed) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue
      const o = item as Record<string, unknown>
      const metric = typeof o.metric === "string" ? o.metric.trim() : ""
      const nc = typeof o.newClass === "string" ? o.newClass.trim() : ""
      if (!metric && !nc) continue
      out.push({ metric: metric || "—", newClass: nc || "—" })
    }
    return out
  } catch {
    return []
  }
}

function PanelHeader({
  titleId,
  children,
}: {
  titleId: string
  children: ReactNode
}) {
  return (
    <div className="deal_offer_pf_panel_head">
      <h2 id={titleId} className="deal_offer_pf_panel_title_text">
        {children}
      </h2>
      <span
        className="deal_offer_pf_panel_kebab"
        aria-hidden
        title="Preview only — edit in Offering details"
      >
        <MoreVertical size={18} strokeWidth={2} />
      </span>
    </div>
  )
}

export function DealOfferingPortfolioPage() {
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
      isDealUuid(dealIdFromRoute)
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
    isDealUuid(dealIdFromRoute)
  const galleryDialogTitleId = useId()
  const [detail, setDetail] = useState<DealDetailApi | null>(null)
  const [classes, setClasses] = useState<DealInvestorClass[]>([])
  const [investorsPayload, setInvestorsPayload] =
    useState<DealInvestorsPayload>(EMPTY_INVESTORS_PAYLOAD)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [copyLinkState, setCopyLinkState] = useState<"idle" | "copied" | "error">(
    "idle",
  )

  const copyPreviewLink = useCallback(() => {
    if (!previewShareUrl) return
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
  }, [previewShareUrl])

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

  useEffect(() => {
    setGalleryOpen(false)
  }, [effectiveDealId])

  const title =
    detail?.dealName?.trim() ||
    detail?.propertyName?.trim() ||
    "Offering"

  const summaryHtml = detail?.investorSummaryHtml?.trim() ?? ""

  useEffect(() => {
    if (loading) {
      setAppDocumentTitle("Offering preview")
      return
    }
    if (notFound || !detail) {
      setAppDocumentTitle("Offering not found")
      return
    }
    setAppDocumentTitle(`${title} — Offering`)
  }, [loading, notFound, detail, title])

  const openGalleryAt = useCallback((index: number) => {
    setGalleryIndex(index)
    setGalleryOpen(true)
  }, [])

  const closeGallery = useCallback(() => {
    setGalleryOpen(false)
  }, [])

  const galleryUrls = detail ? orderedGalleryUrlsForOffering(detail) : []
  const galleryTouchXRef = useRef<number | null>(null)
  const galleryModalThumbsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!galleryOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [galleryOpen])

  useEffect(() => {
    if (!galleryOpen || galleryUrls.length < 2) return
    const len = galleryUrls.length
    const safe = Math.min(Math.max(0, galleryIndex), len - 1)
    const root = galleryModalThumbsRef.current
    if (!root) return
    const active = root.querySelector(
      `[data-gallery-thumb-index="${safe}"]`,
    )
    active?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: "smooth",
    })
  }, [galleryOpen, galleryIndex, galleryUrls.length])

  useEffect(() => {
    if (!galleryOpen || galleryUrls.length === 0) return
    const len = galleryUrls.length
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        setGalleryOpen(false)
        return
      }
      if (len < 2) return
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        setGalleryIndex((i) => (i - 1 + len) % len)
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        setGalleryIndex((i) => (i + 1) % len)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [galleryOpen, galleryUrls.length])

  const goGalleryPrev = useCallback(() => {
    setGalleryIndex((i) => {
      const len = galleryUrls.length
      if (len < 2) return i
      return (i - 1 + len) % len
    })
  }, [galleryUrls.length])

  const goGalleryNext = useCallback(() => {
    setGalleryIndex((i) => {
      const len = galleryUrls.length
      if (len < 2) return i
      return (i + 1) % len
    })
  }, [galleryUrls.length])

  const onGalleryCarouselTouchStart = useCallback(
    (e: React.TouchEvent) => {
      galleryTouchXRef.current = e.touches[0]?.clientX ?? null
    },
    [],
  )

  const onGalleryCarouselTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = galleryTouchXRef.current
      galleryTouchXRef.current = null
      const len = galleryUrls.length
      if (start == null || len < 2) return
      const end = e.changedTouches[0]?.clientX
      if (end === undefined) return
      const dx = end - start
      if (Math.abs(dx) < 56) return
      if (dx > 0) {
        setGalleryIndex((i) => (i - 1 + len) % len)
      } else {
        setGalleryIndex((i) => (i + 1) % len)
      }
    },
    [galleryUrls.length],
  )

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

  const lr = detail.listRow
  const offeringSizeDisplay = previewTargetDisplay(detail, classes)
  const raiseTargetDisplay = offeringSizeDisplay
  const investorsDisplay = lr.investors?.trim() || "—"
  const totalAcceptedDisplay = previewAcceptedDisplay(detail, investorsPayload)
  const totalFundedDisplay = previewFundedDisplay(investorsPayload)

  const dealLocationLine =
    [detail.city, detail.country].filter((x) => x?.trim()).join(", ") || "—"

  const summaryBits = buildSummaryBits(detail, classes, investorsPayload)

  const announcementTitle = detail.dealAnnouncementTitle?.trim() ?? ""
  const announcementMessage = detail.dealAnnouncementMessage?.trim() ?? ""
  const keyHighlightPreviewRows = keyHighlightRowsFromJson(
    detail.keyHighlightsJson,
  )

  const targetNum = targetAmountNumberForDeal(detail.listRow, classes)
  const acceptedNum = acceptedAmountForPayload(investorsPayload)
  const acceptedTrendDown =
    Number.isFinite(targetNum) &&
    targetNum > 0 &&
    Number.isFinite(acceptedNum) &&
    acceptedNum < targetNum

  const galleryLen = galleryUrls.length
  const gallerySafeIndex = galleryLen
    ? Math.min(galleryIndex, galleryLen - 1)
    : 0

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
            <span className="deal_offer_pf_header_hint">
              <Eye size={15} strokeWidth={2} aria-hidden />
              {isPublicOfferingRoute
                ? "No login required for this page"
                : "Investor-facing preview"}
            </span>
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
              <p className="deal_offer_pf_share_hint">
                Copy this link for LP investors — they can open the same preview
                without signing in.{" "}
                {sharePreviewUsesLegacyLink
                  ? "This link uses the offering id in the URL. Ask your administrator to configure encrypted preview links if you need to hide it."
                  : "The link uses an encrypted token (not the raw deal id). The full deal workspace still requires portal access."}
              </p>
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
                  <div className="deal_offer_pf_share_row">
                    <input
                      type="text"
                      readOnly
                      className="deal_offer_pf_share_url_field"
                      value={previewShareUrl}
                      aria-label="Public preview link for LPs"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <button
                      type="button"
                      className="deal_offer_pf_share_copy_btn"
                      disabled={!previewShareUrl}
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
                  </div>
                  {copyLinkState === "error" ? (
                    <p className="deal_offer_pf_share_error" role="status">
                      Could not copy automatically — select the link above and
                      copy manually.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </header>

        <div className="deal_offer_pf_card">
          <div className="deal_offer_pf_titlebar">
            <div className="deal_offer_pf_titlebar_main">
              <h1 className="deal_offer_pf_page_title">{title}</h1>
              <p className="deal_offer_pf_property_line">
                {[detail.propertyName, dealLocationLine]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
            </div>
            {detail.dealStage?.trim() ? (
              <span
                className={`deal_offer_pf_stage_badge ${dealStageChipCompactClassName(detail.dealStage)}`}
              >
                {dealStageLabel(detail.dealStage)}
              </span>
            ) : null}
          </div>

          <nav
            className="deal_offer_pf_subnav"
            aria-label="Preview"
          >
            <span
              className="deal_offer_pf_subnav_link deal_offer_pf_subnav_link_active"
              aria-current="page"
            >
              Offering overview
            </span>
          </nav>

          <div className="deal_offer_pf_main_grid">
            <div className="deal_offer_pf_col_media">
              <div className="deal_offer_pf_col_media_stack">
                {galleryUrls.length === 0 ? (
                  <div className="deal_offer_pf_hero deal_offer_pf_hero--clean">
                    <div className="deal_offer_pf_media_empty">
                      <p className="deal_offer_pf_media_empty_text">
                        No gallery images yet
                      </p>
                      <p className="deal_offer_pf_media_empty_hint">
                        {isPublicOfferingRoute
                          ? "The sponsor has not added photos to this offering yet."
                          : "Add photos in Offering details → Gallery"}
                      </p>
                    </div>
                  </div>
                ) : galleryUrls.length === 1 ? (
                  <div className="deal_offer_pf_hero deal_offer_pf_hero--clean deal_offer_pf_hero--single">
                    <button
                      type="button"
                      className="deal_offer_pf_hero_img_btn"
                      onClick={() => openGalleryAt(0)}
                      aria-haspopup="dialog"
                      aria-label="Open image in gallery viewer"
                    >
                      <img
                        src={galleryUrls[0]}
                        alt=""
                        className="deal_offer_pf_hero_img"
                      />
                    </button>
                  </div>
                ) : (
                  <div
                    className="deal_offer_pf_gallery_mosaic"
                    role="list"
                    aria-label={`Property gallery, ${galleryLen} photos`}
                  >
                    {galleryUrls.map((src, i) => (
                      <button
                        key={`pf-gal-mosaic-${i}-${src.slice(0, 48)}`}
                        type="button"
                        role="listitem"
                        className={`deal_offer_pf_gallery_mosaic_cell${i === 0 ? " deal_offer_pf_gallery_mosaic_cell--lead" : ""}`}
                        onClick={() => openGalleryAt(i)}
                        aria-haspopup="dialog"
                        aria-label={`Open image ${i + 1} of ${galleryLen} in gallery viewer`}
                      >
                        <img
                          src={src}
                          alt=""
                          className="deal_offer_pf_gallery_mosaic_img"
                          loading={i > 8 ? "lazy" : undefined}
                        />
                      </button>
                    ))}
                  </div>
                )}

                {galleryLen > 0 ? (
                  <>
                    <div
                      className="deal_offer_pf_media_toolbar"
                      role="toolbar"
                      aria-label="Gallery tools"
                    >
                      <button
                        type="button"
                        className="deal_offer_pf_media_tool deal_offer_pf_media_tool--active"
                        onClick={() => openGalleryAt(0)}
                        aria-label="Open photo gallery"
                      >
                        <Compass size={18} strokeWidth={2} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="deal_offer_pf_media_tool"
                        disabled
                        title="Map view is not available in preview"
                        aria-label="Map (not available)"
                      >
                        <Map size={18} strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                    <p className="deal_offer_pf_gallery_manage_strip">
                      {isPublicOfferingRoute ? (
                        <>
                          {galleryLen}{" "}
                          {galleryLen === 1 ? "photo" : "photos"} in this
                          gallery.
                          {galleryLen > 1
                            ? " Tap any image to view full size."
                            : null}
                        </>
                      ) : (
                        <>
                          Gallery images are managed in{" "}
                          <strong>Offering details → Gallery</strong>.
                          {galleryLen > 1
                            ? " All photos appear above; tap to enlarge."
                            : null}
                        </>
                      )}
                    </p>
                  </>
                ) : null}

                <section
                  className="deal_offer_pf_panel deal_offer_pf_panel--left"
                  aria-labelledby="deal-pf-property"
                >
                  <PanelHeader titleId="deal-pf-property">
                    Property information
                  </PanelHeader>
                  <dl className="deal_offer_pf_kv_grid">
                    <div className="deal_offer_pf_kv">
                      <dt>Property</dt>
                      <dd>{detail.propertyName?.trim() || "—"}</dd>
                    </div>
                    <div className="deal_offer_pf_kv">
                      <dt>Location</dt>
                      <dd>{dealLocationLine}</dd>
                    </div>
                    <div className="deal_offer_pf_kv">
                      <dt>Market</dt>
                      <dd>{detail.city?.trim() || "—"}</dd>
                    </div>
                    <div className="deal_offer_pf_kv">
                      <dt>Sub market</dt>
                      <dd>{detail.country?.trim() || "—"}</dd>
                    </div>
                  </dl>
                </section>

                <section
                  className="deal_offer_pf_panel deal_offer_pf_panel--left"
                  aria-labelledby="deal-pf-financial"
                >
                  <PanelHeader titleId="deal-pf-financial">
                    Financial profile
                  </PanelHeader>
                  <p className="deal_offer_pf_fin_subhead">Offering</p>
                  <dl className="deal_offer_pf_kv_grid">
                    <div className="deal_offer_pf_kv">
                      <dt>Raise target</dt>
                      <dd>{raiseTargetDisplay}</dd>
                    </div>
                    <div className="deal_offer_pf_kv">
                      <dt>Total accepted</dt>
                      <dd>{totalAcceptedDisplay}</dd>
                    </div>
                    <div className="deal_offer_pf_kv">
                      <dt>Total funded</dt>
                      <dd>{totalFundedDisplay}</dd>
                    </div>
                    <div className="deal_offer_pf_kv">
                      <dt>Investors</dt>
                      <dd>{investorsDisplay}</dd>
                    </div>
                  </dl>
                </section>
              </div>
            </div>

            <aside
              className="deal_offer_pf_col_side"
              aria-label="Offering metrics and details"
            >
              <div className="deal_offer_pf_kpi_cards">
                <div className="deal_offer_pf_kpi_card">
                  <div className="deal_offer_pf_kpi_card_text">
                    <span className="deal_offer_pf_kpi_card_label">
                      Offering size
                    </span>
                    <span className="deal_offer_pf_kpi_card_value">
                      {offeringSizeDisplay}
                    </span>
                  </div>
                  <TrendingUp
                    size={22}
                    strokeWidth={2}
                    className="deal_offer_pf_kpi_icon deal_offer_pf_kpi_icon--up"
                    aria-hidden
                  />
                </div>
                <div className="deal_offer_pf_kpi_card">
                  <div className="deal_offer_pf_kpi_card_text">
                    <span className="deal_offer_pf_kpi_card_label">
                      Total accepted
                    </span>
                    <span className="deal_offer_pf_kpi_card_value">
                      {totalAcceptedDisplay}
                    </span>
                  </div>
                  {acceptedTrendDown ? (
                    <TrendingDown
                      size={22}
                      strokeWidth={2}
                      className="deal_offer_pf_kpi_icon deal_offer_pf_kpi_icon--down"
                      aria-hidden
                    />
                  ) : (
                    <TrendingUp
                      size={22}
                      strokeWidth={2}
                      className="deal_offer_pf_kpi_icon deal_offer_pf_kpi_icon--up"
                      aria-hidden
                    />
                  )}
                </div>
                <div className="deal_offer_pf_kpi_card">
                  <div className="deal_offer_pf_kpi_card_text">
                    <span className="deal_offer_pf_kpi_card_label">
                      Target close
                    </span>
                    <span className="deal_offer_pf_kpi_card_value deal_offer_pf_kpi_card_value--date">
                      {formatDateDdMmmYyyy(detail.closeDate?.trim())}
                    </span>
                  </div>
                  <Clock
                    size={22}
                    strokeWidth={2}
                    className="deal_offer_pf_kpi_icon deal_offer_pf_kpi_icon--time"
                    aria-hidden
                  />
                </div>
              </div>

              <section
                className="deal_offer_pf_panel"
                aria-labelledby="deal-pf-dates"
              >
                <PanelHeader titleId="deal-pf-dates">Key dates</PanelHeader>
                <dl className="deal_offer_pf_kv_grid">
                  <div className="deal_offer_pf_kv">
                    <dt>Deal created</dt>
                    <dd>{formatDateDdMmmYyyy(detail.createdAt)}</dd>
                  </div>
                  <div className="deal_offer_pf_kv">
                    <dt>Target close</dt>
                    <dd>{formatDateDdMmmYyyy(detail.closeDate?.trim())}</dd>
                  </div>
                  <div className="deal_offer_pf_kv">
                    <dt>Location</dt>
                    <dd>{dealLocationLine}</dd>
                  </div>
                </dl>
              </section>

              <section
                className="deal_offer_pf_panel"
                aria-labelledby="deal-pf-profile"
              >
                <PanelHeader titleId="deal-pf-profile">Deal profile</PanelHeader>
                {announcementTitle || announcementMessage ? (
                  <div
                    className="deal_offer_pf_preview_announcement"
                    role="status"
                  >
                    <Megaphone
                      size={15}
                      strokeWidth={2}
                      className="deal_offer_pf_preview_announcement_icon"
                      aria-hidden
                    />
                    <div className="deal_offer_pf_preview_announcement_body">
                      {announcementTitle ? (
                        <p className="deal_offer_pf_preview_announcement_title">
                          {announcementTitle}
                        </p>
                      ) : null}
                      {announcementMessage ? (
                        <p className="deal_offer_pf_preview_announcement_msg">
                          {announcementMessage}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <dl className="deal_offer_pf_kv_grid">
                  <div className="deal_offer_pf_kv">
                    <dt>Deal name</dt>
                    <dd>{detail.dealName?.trim() || "—"}</dd>
                  </div>
                  <div className="deal_offer_pf_kv">
                    <dt>Deal type</dt>
                    <dd>{detail.dealType?.trim() || "—"}</dd>
                  </div>
                  <div className="deal_offer_pf_kv">
                    <dt>Asking price</dt>
                    <dd>{offeringSizeDisplay}</dd>
                  </div>
                  <div className="deal_offer_pf_kv">
                    <dt>Security type</dt>
                    <dd>{detail.secType?.trim() || "—"}</dd>
                  </div>
                  <div className="deal_offer_pf_kv">
                    <dt>Owning entity</dt>
                    <dd>{detail.owningEntityName?.trim() || "—"}</dd>
                  </div>
                </dl>
              </section>

              {keyHighlightPreviewRows.length > 0 ? (
                <section
                  className="deal_offer_pf_panel"
                  aria-labelledby="deal-pf-kh"
                >
                  <PanelHeader titleId="deal-pf-kh">
                    Key highlights
                  </PanelHeader>
                  <dl className="deal_offer_pf_kv_grid">
                    {keyHighlightPreviewRows.map((row, i) => (
                      <div
                        className="deal_offer_pf_kv"
                        key={`${row.metric}-${row.newClass}-${i}`}
                      >
                        <dt>{row.metric}</dt>
                        <dd>{row.newClass}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ) : null}

              <section
                className="deal_offer_pf_panel"
                aria-labelledby="deal-pf-summary"
              >
                <PanelHeader titleId="deal-pf-summary">
                  Investment highlights
                </PanelHeader>
                {summaryHtml ? (
                  <div
                    className="deal_offer_pf_summary_prose deal_offer_pf_summary_prose--compact"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(summaryHtml),
                    }}
                  />
                ) : summaryBits.length > 0 ? (
                  <ul className="deal_offer_pf_bullets deal_offer_pf_bullets--compact">
                    {summaryBits.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="deal_offer_pf_muted deal_offer_pf_muted--compact">
                    Add a summary in Offering details, or metrics will appear
                    here when available.
                  </p>
                )}
              </section>

              <section
                className="deal_offer_pf_panel"
                aria-labelledby="deal-pf-funding"
              >
                <PanelHeader titleId="deal-pf-funding">Funding</PanelHeader>
                <dl className="deal_offer_pf_kv_grid">
                  <div className="deal_offer_pf_kv">
                    <dt>Total funded</dt>
                    <dd>{totalFundedDisplay}</dd>
                  </div>
                  <div className="deal_offer_pf_kv">
                    <dt>Auto-send instructions</dt>
                    <dd>{boolLabel(detail.autoSendFundingInstructions)}</dd>
                  </div>
                  <div className="deal_offer_pf_kv">
                    <dt>Funds before GP sign</dt>
                    <dd>{boolLabel(detail.fundsRequiredBeforeGpSign)}</dd>
                  </div>
                </dl>
              </section>
            </aside>
          </div>

        <section className="deal_offer_pf_section deal_offer_pf_section--in_card" aria-labelledby="deal-pf-classes">
          <h2 id="deal-pf-classes" className="deal_offer_pf_section_title">
            Investor classes
          </h2>
          {classes.length === 0 ? (
            <p className="deal_offer_pf_muted">
              No investor classes have been added for this offering yet.
            </p>
          ) : (
            <div className="deal_offer_pf_class_grid">
              {classes.map((c) => (
                <article key={c.id} className="deal_offer_pf_class_card">
                  <h3 className="deal_offer_pf_class_name">
                    {c.name?.trim() || "—"}
                  </h3>
                  <p className="deal_offer_pf_class_meta">
                    {[
                      c.subscriptionType,
                      c.entityName,
                      c.startDate?.trim()
                        ? formatDateDdMmmYyyy(c.startDate)
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                  <dl className="deal_offer_pf_class_dl">
                    <div>
                      <dt>Offering size</dt>
                      <dd>{formatMoneyFieldDisplay(c.offeringSize)}</dd>
                    </div>
                    <div>
                      <dt>Raise / distributions</dt>
                      <dd>{formatMoneyFieldDisplay(c.raiseAmountDistributions)}</dd>
                    </div>
                    <div>
                      <dt>Billing / raise quota</dt>
                      <dd>{formatMoneyFieldDisplay(c.billingRaiseQuota)}</dd>
                    </div>
                    <div>
                      <dt>Minimum</dt>
                      <dd>{formatMoneyFieldDisplay(c.minimumInvestment)}</dd>
                    </div>
                    <div>
                      <dt>Price / unit</dt>
                      <dd>{formatMoneyFieldDisplay(c.pricePerUnit)}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{investorClassStatusLabel(c.status)}</dd>
                    </div>
                    <div>
                      <dt>Visibility</dt>
                      <dd>{investorClassVisibilityLabel(c.visibility)}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>
        </div>

        {galleryOpen && galleryLen > 0
          ? createPortal(
              <div
                className="um_modal_overlay deals_add_inv_modal_overlay portal_modal_z_boost"
                role="presentation"
              >
                <div
                  className="um_modal um_modal_view deals_add_inv_modal_panel add_contact_panel deal_offer_pf_gallery_modal_panel"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={galleryDialogTitleId}
                >
                  <div className="um_modal_head add_contact_modal_head">
                    <div className="deal_offer_pf_gallery_modal_head_text">
                      <h2
                        id={galleryDialogTitleId}
                        className="um_modal_title add_contact_modal_title"
                      >
                        Photo gallery
                      </h2>
                      {galleryLen > 1 ? (
                        <p className="deal_offer_pf_gallery_modal_sub">
                          {galleryLen} photos — use arrows, swipe, or thumbnails
                          to browse
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="um_modal_close"
                      onClick={closeGallery}
                      aria-label="Close gallery"
                    >
                      <X size={20} strokeWidth={2} aria-hidden />
                    </button>
                  </div>
                  <div className="deal_offer_pf_gallery_carousel">
                    <div
                      className="deal_offer_pf_gallery_slide_wrap"
                      onTouchStart={onGalleryCarouselTouchStart}
                      onTouchEnd={onGalleryCarouselTouchEnd}
                    >
                      {galleryLen > 1 ? (
                        <>
                          <button
                            type="button"
                            className="deal_offer_pf_gallery_edge_nav deal_offer_pf_gallery_edge_nav_prev"
                            onClick={goGalleryPrev}
                            aria-label="Previous image"
                          >
                            <ChevronLeft size={28} strokeWidth={2} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="deal_offer_pf_gallery_edge_nav deal_offer_pf_gallery_edge_nav_next"
                            onClick={goGalleryNext}
                            aria-label="Next image"
                          >
                            <ChevronRight
                              size={28}
                              strokeWidth={2}
                              aria-hidden
                            />
                          </button>
                        </>
                      ) : null}
                      <img
                        src={galleryUrls[gallerySafeIndex]}
                        alt=""
                        className="deal_offer_pf_gallery_slide_img"
                      />
                      <p
                        className="deal_offer_pf_gallery_counter"
                        aria-live="polite"
                      >
                        {gallerySafeIndex + 1} / {galleryLen}
                      </p>
                    </div>
                  </div>
                  {galleryLen > 1 ? (
                    <div
                      ref={galleryModalThumbsRef}
                      className="deal_offer_pf_gallery_modal_thumbs"
                      role="tablist"
                      aria-label="All gallery images"
                    >
                      {galleryUrls.map((src, i) => (
                        <button
                          key={`pf-gal-modal-t-${i}-${src.slice(0, 36)}`}
                          type="button"
                          role="tab"
                          data-gallery-thumb-index={i}
                          aria-selected={i === gallerySafeIndex}
                          aria-label={`Show image ${i + 1} of ${galleryLen}`}
                          className={`deal_offer_pf_gallery_modal_thumb_btn${i === gallerySafeIndex ? " deal_offer_pf_gallery_modal_thumb_btn_active" : ""}`}
                          onClick={() => setGalleryIndex(i)}
                        >
                          <img
                            src={src}
                            alt=""
                            className="deal_offer_pf_gallery_modal_thumb_img"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="um_modal_actions deal_offer_pf_gallery_modal_footer">
                    <button
                      type="button"
                      className="um_btn_primary"
                      onClick={closeGallery}
                    >
                      Close
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
