import DOMPurify from "dompurify"
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  FileText,
  Map,
  MapPin,
  Megaphone,
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
  type TouchEvent,
} from "react"
import { createPortal } from "react-dom"
import { Link } from "react-router-dom"
import type { DealDetailApi } from "./api/dealsApi"
import type { DealInvestorsPayload } from "./types/deal-investors.types"
import type { DealInvestorClass } from "./types/deal-investor-class.types"
import { readOfferingPreviewDocuments } from "./utils/offeringPreviewDocuments"
import { readOfferingPreviewInvestorVisibility } from "./utils/offeringPreviewInvestorVisibility"
import { buildOfferingPreviewAssetBlocks } from "./utils/offeringPreviewAssets"
import {
  galleryUrlsReferToSameAsset,
  orderedGalleryUrlsForOffering,
} from "./utils/offeringGalleryUrls"
import { dealStageChipCompactClassName } from "./utils/dealStageChip"
import {
  investorClassStatusLabel,
  investorClassVisibilityLabel,
} from "./utils/offeringDisplayLabels"
import { formatMoneyFieldDisplay } from "./utils/offeringMoneyFormat"
import { dealStageLabel } from "../deals-mock-data"
import {
  buildSummaryBits,
  keyHighlightRowsFromJson,
  previewTargetDisplay,
} from "./dealOfferingPreviewShared"
import "./deal-members/add-investment/add_deal_modal.css"
import "./deal-offering-portfolio.css"
import "./deals-list.css"

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
    </div>
  )
}

function safeDownloadFilename(name: string): string {
  const base = name.trim() || "document"
  return base.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 200)
}

export type DealOfferingPreviewInnerProps = {
  detail: DealDetailApi
  classes: DealInvestorClass[]
  investorsPayload: DealInvestorsPayload
  /** When true, gallery / summary / documents / assets / etc. follow “Make it visible to Investors” (localStorage). */
  applyInvestorLinkVisibility: boolean
  isPublicOfferingRoute: boolean
  /** False on syndicated “Preview offering” — show only on shared link + investing deal view. */
  showInvestNowCta: boolean
  /**
   * When set (authenticated preview only), “Invest now” opens this handler instead of
   * in-page anchor navigation — e.g. LP commitment modal on the investing deal page.
   */
  onInvestNow?: () => void
  /**
   * When true, gallery URLs are API-only (matches anonymous shared links).
   * When false, the same sources as Offering details → Gallery are used (local asset previews in this browser).
   */
  galleryUsesPersistedSourcesOnly?: boolean
}

export function DealOfferingPreviewInner({
  detail,
  classes,
  investorsPayload,
  applyInvestorLinkVisibility,
  isPublicOfferingRoute,
  showInvestNowCta,
  onInvestNow,
  galleryUsesPersistedSourcesOnly = true,
}: DealOfferingPreviewInnerProps) {
  const galleryDialogTitleId = useId()
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  useEffect(() => {
    setGalleryOpen(false)
  }, [detail.id])

  const title =
    detail.dealName?.trim() ||
    detail.propertyName?.trim() ||
    "Offering"

  const summaryHtml = detail.investorSummaryHtml?.trim() ?? ""

  const openGalleryAt = useCallback((index: number) => {
    setGalleryIndex(index)
    setGalleryOpen(true)
  }, [])

  const closeGallery = useCallback(() => {
    setGalleryOpen(false)
  }, [])

  const galleryUrlsAll = useMemo(
    () =>
      orderedGalleryUrlsForOffering(detail, {
        persistedOnly: galleryUsesPersistedSourcesOnly,
      }),
    [detail, galleryUsesPersistedSourcesOnly],
  )
  const investorPreviewVisibility = useMemo(
    () => readOfferingPreviewInvestorVisibility(detail.id ?? ""),
    [detail.id],
  )
  const galleryUrls = useMemo(() => {
    if (!applyInvestorLinkVisibility) return galleryUrlsAll
    if (investorPreviewVisibility.gallery === false) return []
    return galleryUrlsAll
  }, [
    applyInvestorLinkVisibility,
    galleryUrlsAll,
    investorPreviewVisibility.gallery,
  ])
  const previewAssetBlocks = useMemo(
    () => buildOfferingPreviewAssetBlocks(detail, galleryUrls),
    [detail, galleryUrls],
  )
  const previewDocuments = useMemo(() => {
    const docs = readOfferingPreviewDocuments(detail.id)
    if (
      applyInvestorLinkVisibility &&
      investorPreviewVisibility.documents === false
    ) {
      return []
    }
    /*
      Shared-with scope (from Documents tab, per section):
      - offering_page: show on Preview offering, the shared link, and portal LPs.
      - lp_investor: portal (deal workspace / LP views) only — hidden on Preview
        offering and on the no-login preview link.
      Legacy rows without sharedWithScope behave like offering_page.
    */
    const hideLpInvestorOnlyDocs =
      isPublicOfferingRoute || applyInvestorLinkVisibility
    if (hideLpInvestorOnlyDocs) {
      return docs.filter((d) => d.sharedWithScope !== "lp_investor")
    }
    return docs
  }, [
    detail.id,
    applyInvestorLinkVisibility,
    investorPreviewVisibility.documents,
    isPublicOfferingRoute,
  ])
  const publicGallerySuppressed =
    applyInvestorLinkVisibility &&
    investorPreviewVisibility.gallery === false &&
    galleryUrlsAll.length > 0
  const showInvestorPreviewAnnouncement =
    !applyInvestorLinkVisibility ||
    investorPreviewVisibility.make_announcement !== false
  const showInvestorPreviewOverviewKv =
    !applyInvestorLinkVisibility ||
    investorPreviewVisibility.overview !== false
  const showInvestorPreviewOfferingInformation =
    !applyInvestorLinkVisibility ||
    investorPreviewVisibility.offering_information !== false
  const showInvestorPreviewFundingInstructions =
    !applyInvestorLinkVisibility ||
    investorPreviewVisibility.funding_instructions !== false
  const showInvestorPreviewDealProfileSection =
    showInvestorPreviewAnnouncement || showInvestorPreviewOverviewKv
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

  const onGalleryCarouselTouchStart = useCallback((e: TouchEvent) => {
    galleryTouchXRef.current = e.touches[0]?.clientX ?? null
  }, [])

  const onGalleryCarouselTouchEnd = useCallback(
    (e: TouchEvent) => {
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

  const offeringSizeDisplay = previewTargetDisplay(detail, classes)

  const dealLocationLine =
    [detail.city, detail.country].filter((x) => x?.trim()).join(", ") || "—"

  const summaryBits = buildSummaryBits(detail, classes, investorsPayload)
  const classPreviewLines = useMemo(
    () =>
      classes.map((ic) => {
        const name = ic.name?.trim() || "Untitled class"
        const min = formatMoneyFieldDisplay(ic.minimumInvestment)
        const visibility = investorClassVisibilityLabel(ic.visibility ?? "")
        const status = investorClassStatusLabel(ic.status ?? "")
        return `${name}: minimum ${min} · ${status} · ${visibility}`
      }),
    [classes],
  )

  const announcementTitle = detail.dealAnnouncementTitle?.trim() ?? ""
  const announcementMessage = detail.dealAnnouncementMessage?.trim() ?? ""
  const keyHighlightPreviewRows = keyHighlightRowsFromJson(
    detail.keyHighlightsJson,
  )

  const galleryLen = galleryUrls.length
  const gallerySafeIndex = galleryLen
    ? Math.min(galleryIndex, galleryLen - 1)
    : 0

  return (
    <>
        <div className="deal_offer_pf_card" id="deal-offer-pf-card">
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

          {/*
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
          */}

          <div className="deal_offer_pf_main_grid">
            <div className="deal_offer_pf_col_media">
              <div className="deal_offer_pf_col_media_stack">
                <div className="deal_offer_pf_media_card">
                {publicGallerySuppressed ? (
                      <div className="deal_offer_pf_hero deal_offer_pf_hero--clean">
                        <div className="deal_offer_pf_media_empty">
                          <p className="deal_offer_pf_media_empty_text">
                            Gallery not on this preview link
                          </p>
                          <p className="deal_offer_pf_media_empty_hint">
                            The sponsor chose not to include the photo gallery on
                            the shared investor preview.
                          </p>
                        </div>
                      </div>
                    ) : galleryUrls.length === 0 ? (
                      <div className="deal_offer_pf_hero deal_offer_pf_hero--clean">
                        <div className="deal_offer_pf_media_empty">
                          <p className="deal_offer_pf_media_empty_text">
                            No gallery images yet
                          </p>
                          <p className="deal_offer_pf_media_empty_hint">
                            {applyInvestorLinkVisibility
                              ? "The sponsor has not added photos to this offering yet."
                              : "Add photos in Offering details → Gallery"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="deal_offer_pf_media_gallery_stack">
                        <div className="deal_offer_pf_hero deal_offer_pf_hero--clean deal_offer_pf_hero--cover_main">
                          <button
                            type="button"
                            className="deal_offer_pf_hero_img_btn"
                            onClick={() => openGalleryAt(0)}
                            aria-haspopup="dialog"
                            aria-label="Open cover image in gallery viewer"
                          >
                            <img
                              src={galleryUrls[0]}
                              alt=""
                              className="deal_offer_pf_hero_img"
                            />
                          </button>
                        </div>
                        {galleryUrls.length > 1 ? (
                          <div
                            className="deal_offer_pf_media_thumb_row"
                            role="list"
                            aria-label="Additional gallery photos"
                          >
                            {galleryUrls.slice(1, 4).map((src, j) => {
                              const index = j + 1
                              const hasMoreOverlay =
                                galleryUrls.length > 4 && j === 2
                              const moreCount = galleryUrls.length - 4
                              return (
                                <button
                                  key={`pf-media-sub-${index}-${src.slice(0, 48)}`}
                                  type="button"
                                  role="listitem"
                                  className={`deal_offer_pf_media_thumb_cell${hasMoreOverlay ? " deal_offer_pf_media_thumb_cell--more" : ""}`}
                                  onClick={() => openGalleryAt(index)}
                                  aria-haspopup="dialog"
                                  aria-label={
                                    hasMoreOverlay
                                      ? `Open gallery (${galleryUrls.length} photos; ${moreCount} more not shown here)`
                                      : `Open image ${index + 1} of ${galleryUrls.length} in gallery viewer`
                                  }
                                >
                                  <img
                                    src={src}
                                    alt=""
                                    className="deal_offer_pf_media_thumb_img"
                                    loading="lazy"
                                  />
                                  {hasMoreOverlay ? (
                                    <span
                                      className="deal_offer_pf_gallery_preview_more_overlay"
                                      aria-hidden
                                    >
                                      +{moreCount}
                                    </span>
                                  ) : null}
                                </button>
                              )
                            })}
                          </div>
                        ) : null}
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
                        {/*
                        deal_offer_pf_gallery_manage_strip (hidden):
                        {applyInvestorLinkVisibility ? (
                          <p className="deal_offer_pf_gallery_manage_strip">
                            {galleryLen}{" "}
                            {galleryLen === 1 ? "photo" : "photos"} in this
                            gallery.
                            {galleryLen > 4
                              ? " Cover above; row shows the next 3 photos (+N if more). Tap any to browse all."
                              : galleryLen > 1
                                ? " Cover above; tap smaller previews or the cover to open the gallery."
                                : null}
                          </p>
                        ) : null}

                        Authenticated preview caption (was commented / not shown):
                        Gallery images are managed in Offering details → Gallery.
                        Cover above; tap smaller previews or the cover to open the gallery.
                        (Previously also used galleryLen branches for +3 photos / tap any, same as public.)
                        */}
                      </>
                    ) : null}
                </div>

                {!applyInvestorLinkVisibility ||
                investorPreviewVisibility.summary !== false ? (
                  <section
                    className="deal_offer_pf_about_offering_section deal_offer_pf_panel deal_offer_pf_panel--left"
                    aria-labelledby="deal-pf-about-offering"
                  >
                    <h2
                      id="deal-pf-about-offering"
                      className="deal_offer_pf_assets_main_title"
                    >
                      About Offering
                    </h2>
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
                ) : null}

                {!applyInvestorLinkVisibility ||
                investorPreviewVisibility.documents !== false ? (
                  <section
                    className="deal_offer_pf_documents_section deal_offer_pf_panel deal_offer_pf_panel--left"
                    aria-labelledby="deal-pf-documents"
                  >
                    <h2
                      id="deal-pf-documents"
                      className="deal_offer_pf_assets_main_title"
                    >
                      Documents
                    </h2>
                    {previewDocuments.length === 0 ? (
                      <p className="deal_offer_pf_muted deal_offer_pf_muted--compact">
                        {applyInvestorLinkVisibility
                          ? "No documents are listed on this shared preview yet."
                          : "No documents yet. Add links or uploads under the deal Documents tab."}
                      </p>
                    ) : (
                      <ul className="deal_offer_pf_documents_list">
                        {previewDocuments.map((doc) => (
                          <li
                            key={doc.id}
                            className="deal_offer_pf_documents_item"
                          >
                            <FileText
                              size={18}
                              strokeWidth={2}
                              className="deal_offer_pf_documents_icon"
                              aria-hidden
                            />
                            <div className="deal_offer_pf_documents_item_body">
                              <span className="deal_offer_pf_documents_name">
                                {doc.name}
                              </span>
                              {doc.url ? (
                                <div
                                  className="deal_offer_pf_documents_actions"
                                  role="group"
                                  aria-label={`${doc.name} document actions`}
                                >
                                  <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="deal_offer_pf_documents_action"
                                    aria-label={`View ${doc.name} (opens in a new tab)`}
                                  >
                                    View
                                  </a>
                                  <a
                                    href={doc.url}
                                    download={safeDownloadFilename(doc.name)}
                                    rel="noopener noreferrer"
                                    className="deal_offer_pf_documents_action"
                                    aria-label={`Download ${doc.name}`}
                                  >
                                    Download
                                  </a>
                                </div>
                              ) : (
                                <span className="deal_offer_pf_documents_file_note">
                                  Preview shows the file name only.
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ) : null}

                {!applyInvestorLinkVisibility ||
                investorPreviewVisibility.assets !== false ? (
                  <section
                    className="deal_offer_pf_assets_section deal_offer_pf_panel deal_offer_pf_panel--left deal_offer_pf_section_invest_anchor"
                    aria-labelledby="deal-pf-assets"
                  >
                    <h2 id="deal-pf-assets" className="deal_offer_pf_assets_main_title">
                      Assets
                    </h2>
                    {previewAssetBlocks.map((block, blockIdx) => (
                    (() => {
                      const blockGalleryCount = block.galleryUrls.length
                      const openAssetGallery = () => {
                        if (blockGalleryCount === 0) return
                        const first = block.galleryUrls[0]
                        if (!first) return
                        const idx = galleryUrls.findIndex((u) =>
                          galleryUrlsReferToSameAsset(u, first),
                        )
                        openGalleryAt(idx >= 0 ? idx : 0)
                      }
                      return (
                    <article
                      key={block.id}
                      className={`deal_offer_pf_asset_card${blockIdx > 0 ? " deal_offer_pf_asset_card--follow" : ""}`}
                    >
                      <div className="deal_offer_pf_asset_card_inner">
                        <div className="deal_offer_pf_asset_pin_col" aria-hidden>
                          <div className="deal_offer_pf_asset_pin">
                            <MapPin size={16} strokeWidth={2} />
                          </div>
                          <div className="deal_offer_pf_asset_timeline" />
                        </div>
                        <div className="deal_offer_pf_asset_body">
                          <h3 className="deal_offer_pf_asset_name">{block.name}</h3>
                          <p className="deal_offer_pf_asset_address">{block.address}</p>
                          {blockGalleryCount > 0 ? (
                            <button
                              type="button"
                              className="deal_offer_pf_assets_view_images"
                              onClick={openAssetGallery}
                            >
                              View {blockGalleryCount}{" "}
                              {blockGalleryCount === 1 ? "image" : "images"}
                            </button>
                          ) : block.viewImagesCount > 0 ? (
                            <p
                              className="deal_offer_pf_assets_image_note"
                              role="status"
                            >
                              {block.viewImagesCount}{" "}
                              {block.viewImagesCount === 1 ? "image" : "images"}{" "}
                              on file
                            </p>
                          ) : (
                            <p className="deal_offer_pf_assets_image_note deal_offer_pf_muted">
                              No images yet
                            </p>
                          )}
                          <div className="deal_offer_pf_asset_metrics">
                            <div className="deal_offer_pf_asset_metric_stack">
                              <div className="deal_offer_pf_asset_metric">
                                <span className="deal_offer_pf_asset_metric_label">
                                  Asset type
                                </span>
                                <span className="deal_offer_pf_asset_metric_value">
                                  {block.assetType}
                                </span>
                              </div>
                              <div className="deal_offer_pf_asset_metric">
                                <span className="deal_offer_pf_asset_metric_label">
                                  Year built
                                </span>
                                <span className="deal_offer_pf_asset_metric_value">
                                  {block.yearBuilt}
                                </span>
                              </div>
                            </div>
                            <div className="deal_offer_pf_asset_metric">
                              <span className="deal_offer_pf_asset_metric_label">
                                Number of units
                              </span>
                              <span className="deal_offer_pf_asset_metric_value">
                                {block.numberOfUnits}
                              </span>
                            </div>
                            <div className="deal_offer_pf_asset_metric">
                              <span className="deal_offer_pf_asset_metric_label">
                                Acquisition price
                              </span>
                              <span className="deal_offer_pf_asset_metric_value">
                                {block.acquisitionPrice}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                      )
                    })()
                  ))}
                  </section>
                ) : null}
              </div>
            </div>

            <aside
              className="deal_offer_pf_col_side"
              aria-label="Offering metrics and details"
            >
              {showInvestNowCta ? (
                <div className="deal_offer_pf_side_invest_cta_wrap">
                  {isPublicOfferingRoute ? (
                    <Link
                      to="/signin"
                      className="deal_offer_pf_invest_cta deal_offer_pf_invest_cta_side_top"
                    >
                      <span>Invest now</span>
                      <TrendingUp size={18} strokeWidth={2} aria-hidden />
                    </Link>
                  ) : onInvestNow ? (
                    <button
                      type="button"
                      className="deal_offer_pf_invest_cta deal_offer_pf_invest_cta_side_top"
                      onClick={onInvestNow}
                    >
                      <span>Invest now</span>
                      <TrendingUp size={18} strokeWidth={2} aria-hidden />
                    </button>
                  ) : (
                    <a
                      href={
                        applyInvestorLinkVisibility &&
                        investorPreviewVisibility.assets === false
                          ? "#deal-offer-pf-card"
                          : "#deal-pf-assets"
                      }
                      className="deal_offer_pf_invest_cta deal_offer_pf_invest_cta_side_top"
                    >
                      <span>Invest now</span>
                      <TrendingUp size={18} strokeWidth={2} aria-hidden />
                    </a>
                  )}
                </div>
              ) : null}

              {showInvestorPreviewDealProfileSection ? (
                <section
                  className="deal_offer_pf_panel"
                  aria-labelledby="deal-pf-profile"
                >
                  <PanelHeader titleId="deal-pf-profile">Deal profile</PanelHeader>
                  {showInvestorPreviewAnnouncement &&
                  (announcementTitle || announcementMessage) ? (
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
                  {showInvestorPreviewOverviewKv ? (
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
                  ) : null}
                </section>
              ) : null}

              {showInvestorPreviewOfferingInformation ? (
                <section
                  className="deal_offer_pf_panel"
                  aria-labelledby="deal-pf-offering-info"
                >
                  <PanelHeader titleId="deal-pf-offering-info">
                    Classes
                  </PanelHeader>
                  {classPreviewLines.length > 0 ? (
                    <ul className="deal_offer_pf_bullets deal_offer_pf_bullets--compact">
                      {classPreviewLines.map((line, i) => (
                        <li key={`${line}-${i}`}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="deal_offer_pf_muted deal_offer_pf_muted--compact">
                      No classes are configured yet.
                    </p>
                  )}
                </section>
              ) : null}

              {showInvestorPreviewFundingInstructions ? (
                <section
                  className="deal_offer_pf_panel"
                  aria-labelledby="deal-pf-funding-info"
                >
                  <PanelHeader titleId="deal-pf-funding-info">
                    Funding info
                  </PanelHeader>
                  <dl className="deal_offer_pf_kv_grid">
                    <div className="deal_offer_pf_kv">
                      <dt>Funds required before GP signs</dt>
                      <dd>{detail.fundsRequiredBeforeGpSign ? "Yes" : "No"}</dd>
                    </div>
                    <div className="deal_offer_pf_kv">
                      <dt>Auto-send funding instructions</dt>
                      <dd>{detail.autoSendFundingInstructions ? "Yes" : "No"}</dd>
                    </div>
                  </dl>
                </section>
              ) : null}

              {keyHighlightPreviewRows.length > 0 &&
              (!applyInvestorLinkVisibility ||
                investorPreviewVisibility.key_highlights !== false) ? (
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
            </aside>
          </div>
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
    </>
  )
}
