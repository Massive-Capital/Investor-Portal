import DOMPurify from "dompurify";
import {
  Building2,
  Download,
  ExternalLink,
  FileText,
  MapPin,
  Megaphone,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { DealDetailApi } from "@/modules/Syndication/InvestorPortal/Deals/api/dealsApi";
import { keyHighlightRowsFromJson } from "@/modules/Syndication/InvestorPortal/Deals/dealOfferingPreviewShared";
import { buildOfferingPreviewAssetBlocks } from "@/modules/Syndication/InvestorPortal/Deals/utils/offeringPreviewAssets";
import { orderedGalleryUrlsForOffering } from "@/modules/Syndication/InvestorPortal/Deals/utils/offeringGalleryUrls";
import { readOfferingPreviewInvestorVisibility } from "@/modules/Syndication/InvestorPortal/Deals/utils/offeringPreviewInvestorVisibility";
import { OfferingOverviewLocationMap } from "@/modules/Syndication/InvestorPortal/Deals/components/OfferingOverviewLocationMap";
import type { DealInvestorsPayload } from "@/modules/Syndication/InvestorPortal/Deals/types/deal-investors.types";
import type { DealInvestorClass } from "@/modules/Syndication/InvestorPortal/Deals/types/deal-investor-class.types";
import { LpDealGalleryCarousel } from "../components/lp-deal-gallery-carousel";
import { LpDealStickyCta } from "../components/lp-deal-sticky-cta";
import { useLpDealRecord } from "../hooks/useLpDealRecord";
import { listDocumentsForLpDealPage } from "../utils/lpDealDocuments";
import "../lp-deal-details.css";

function safeDownloadFilename(name: string): string {
  const base = name.trim() || "document";
  return base.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 200);
}

export interface LpDealDetailsPageProps {
  deal: DealDetailApi;
  classes: DealInvestorClass[];
  investorsPayload: DealInvestorsPayload;
  onInvestNow: () => void;
  backTo: string;
  viewerRoleLabel?: string | null;
}

export function LpDealDetailsPage({
  deal,
  classes,
  investorsPayload,
  onInvestNow,
  backTo,
  viewerRoleLabel,
}: LpDealDetailsPageProps) {
  const { cardMetrics, merged } = useLpDealRecord(
    deal,
    classes,
    investorsPayload,
  );
  const [docQuery, setDocQuery] = useState("");

  const vis = useMemo(
    () => readOfferingPreviewInvestorVisibility(deal.id),
    [deal.id],
  );

  const title =
    deal.dealName?.trim() || deal.propertyName?.trim() || "Offering";

  /** "Summary for all investors" in Offering details — not KPI bullets. */
  const summaryHtml = deal.investorSummaryHtml?.trim() ?? "";

  const keyRows = useMemo(
    () => keyHighlightRowsFromJson(deal.keyHighlightsJson),
    [deal.keyHighlightsJson],
  );

  const galleryUrls = useMemo(
    () =>
      orderedGalleryUrlsForOffering(deal, {
        persistedOnly: false,
      }),
    [deal],
  );

  const galleryUrlsVisible = useMemo(() => {
    if (vis.gallery === false) return [];
    return galleryUrls;
  }, [galleryUrls, vis.gallery]);

  const assetBlocks = useMemo(
    () => buildOfferingPreviewAssetBlocks(deal, galleryUrlsVisible),
    [deal, galleryUrlsVisible],
  );

  const docRows = useMemo(() => listDocumentsForLpDealPage(deal.id), [deal.id]);

  const docRowsFiltered = useMemo(() => {
    const q = docQuery.trim().toLowerCase();
    if (!q) return docRows;
    return docRows.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.sectionLabel.toLowerCase().includes(q),
    );
  }, [docRows, docQuery]);

  const showAnnouncement =
    vis.make_announcement !== false &&
    Boolean(
      (deal.dealAnnouncementTitle?.trim() ||
        deal.dealAnnouncementMessage?.trim()) ??
      false,
    );

  if (!merged) return null;

  return (
    <div className="lpdd">
      <div className="lpdd_shell">
        <div className="lpdd_back_row">
          <Link className="lpdd_back" to={backTo}>
            ← Back to deals
          </Link>
        </div>

        <header className="lpdd_hero">
          <div className="lpdd_hero_grid">
            <div className="lpdd_hero_left">
              <LpDealGalleryCarousel
                imageUrls={galleryUrlsVisible}
                title={title}
              />
            </div>
            <div className="lpdd_hero_right">
              {/* <div className="lpdd_hero_eyebrow">
                <span className="lpdd_chip">{stage || "—"}</span>
                {deal.secType?.trim() ? (
                  <span className="lpdd_chip lpdd_chip_muted">{deal.secType}</span>
                ) : null}
              </div> */}
              <div className="lpdd_header">
                <h1 className="lpdd_title">{title}</h1>
                {deal.listRow.locationDisplay?.trim() &&
                deal.listRow.locationDisplay !== "—" ? (
                  <p className="lpdd_sub">
                    <MapPin
                      size={16}
                      strokeWidth={2}
                      className="lpdd_sub_icon"
                      aria-hidden
                    />
                    {deal.listRow.locationDisplay}
                  </p>
                ) : null}
                {/* {viewerRoleLabel ? (
                  <p className="lpdd_role_note">Your role: {viewerRoleLabel}</p>
                ) : null} */}
              </div>

              <div className="lpdd_hero_cta_row">
                <button
                  type="button"
                  className="lpdd_btn_primary lpdd_hero_invest"
                  onClick={onInvestNow}
                >
                  <TrendingUp /> Invest now
                </button>
              </div>
              <section
                className="lpdd_section lpdd_hero_deal_overview"
                aria-labelledby="lpdd-overview"
              >
                <div className="lpd_section_head">
                  <Building2
                    size={20}
                    strokeWidth={1.75}
                    className="lpd_section_icon"
                    aria-hidden
                  />
                  <h2 id="lpdd-overview" className="lpd_section_title">
                    Deal overview (Standard)
                  </h2>
                </div>
                <dl className="lpdd_grid">
                  {cardMetrics.map((m) => (
                    <div key={m.label} className="lpdd_row">
                      <dt>{m.label}</dt>
                      <dd>{m.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          </div>
        </header>

        {showAnnouncement && (
          <section
            className="lpdd_section lpdd_announcement"
            aria-labelledby="lpdd-ann"
          >
            <div className="lpd_section_head">
              <Megaphone
                size={20}
                strokeWidth={1.75}
                className="lpd_section_icon"
                aria-hidden
              />
              <h2 id="lpdd-ann" className="lpd_section_title">
                Announcement
              </h2>
            </div>
            {deal.dealAnnouncementTitle?.trim() ? (
              <p className="lpdd_ann_title">{deal.dealAnnouncementTitle}</p>
            ) : null}
            {deal.dealAnnouncementMessage?.trim() ? (
              <p className="lpdd_ann_msg">{deal.dealAnnouncementMessage}</p>
            ) : null}
          </section>
        )}

          {vis.summary !== false && (
          <section className="lpdd_section" aria-labelledby="lpdd-about">
            <div className="lpd_section_head">
              <Sparkles
                size={20}
                strokeWidth={1.75}
                className="lpd_section_icon"
                aria-hidden
              />
              <h2 id="lpdd-about" className="lpd_section_title">
                About the offering
              </h2>
            </div>
            {summaryHtml ? (
              <div
                className="lpdd_prose"
                // eslint-disable-next-line react/no-danger -- same pattern as offering preview
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(summaryHtml),
                }}
              />
            ) : (
              <p className="lpd_muted">
                No deal summary yet. The sponsor can add the summary for
                investors under Offering details (Summary for all investors).
              </p>
            )}
          </section>
        )}


        {vis.key_highlights !== false && (
          <section className="lpdd_section" aria-labelledby="lpdd-kh">
            <div className="lpd_section_head">
              <Star
                size={20}
                strokeWidth={1.75}
                className="lpd_section_icon"
                aria-hidden
              />
              <h2 id="lpdd-kh" className="lpd_section_title">
                Key highlights
              </h2>
            </div>
            {keyRows.length > 0 ? (
              <dl className="lpdd_grid lpdd_grid_tight">
                {keyRows.map((row, i) => (
                  <div key={`${row.metric}-${i}`} className="lpdd_row">
                    <dt>{row.metric}</dt>
                    <dd>{row.newClass}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="lpd_muted">
                The sponsor can add key highlights for this offering in
                Offering details.
              </p>
            )}
          </section>
        )}

      
        {vis.documents !== false && (
          <section className="lpdd_section" aria-labelledby="lpdd-docs">
            <div className="lpd_section_head">
              <FileText
                size={20}
                strokeWidth={1.75}
                className="lpd_section_icon"
                aria-hidden
              />
              <h2 id="lpdd-docs" className="lpd_section_title">
                Documents
              </h2>
            </div>
            {docRows.length > 0 ? (
              <>
                <div className="lpdd_doc_search">
                  <label className="lpd_sr" htmlFor="lpdd-doc-q">
                    Filter documents
                  </label>
                  <input
                    id="lpdd-doc-q"
                    type="search"
                    className="lpd_input"
                    placeholder="Filter by name or section…"
                    value={docQuery}
                    onChange={(e) => setDocQuery(e.target.value)}
                  />
                </div>
                {docRowsFiltered.length === 0 ? (
                  <p className="lpd_muted">No documents match that filter.</p>
                ) : (
                  <ul className="lpd_doc_list">
                    {docRowsFiltered.map((d) => (
                      <li key={d.id} className="lpd_doc_item">
                        <div className="lpd_doc_main">
                          <FileText
                            className="lpd_doc_ico"
                            size={18}
                            aria-hidden
                          />
                          <div>
                            <div className="lpd_doc_name">{d.name}</div>
                            <div className="lpd_doc_meta">
                              {d.sectionLabel} · {d.sharedWithLabel}
                            </div>
                          </div>
                        </div>
                        <div className="lpd_doc_actions">
                          {d.url ? (
                            <>
                              <a
                                className="lpd_link"
                                href={d.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                View
                                <ExternalLink size={14} aria-hidden />
                              </a>
                              <a
                                className="lpd_link"
                                href={d.url}
                                download={safeDownloadFilename(d.name)}
                                rel="noopener noreferrer"
                              >
                                <Download size={14} aria-hidden />
                                Download
                              </a>
                            </>
                          ) : (
                            <span className="lpd_muted">Link pending</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="lpd_muted">
                No documents uploaded for this deal yet, or the sponsor has not
                published them to investors.
              </p>
            )}
          </section>
        )}

        {vis.assets !== false && assetBlocks.length > 0 && (
          <section className="lpdd_section" aria-labelledby="lpdd-assets">
            <div className="lpd_section_head">
              <Building2
                size={20}
                strokeWidth={1.75}
                className="lpd_section_icon"
                aria-hidden
              />
              <h2 id="lpdd-assets" className="lpd_section_title">
                Assets
              </h2>
            </div>
            <ul className="lpd_asset_list">
              {assetBlocks.map((a) => (
                <li key={a.id} className="lpd_asset_card">
                  <h3 className="lpd_asset_name">{a.name}</h3>
                  <p className="lpd_muted sm">{a.address}</p>
                  <dl className="lpd_asset_dl">
                    <div>
                      <dt>Type</dt>
                      <dd>{a.assetType}</dd>
                    </div>
                    <div>
                      <dt>Units</dt>
                      <dd>{a.numberOfUnits}</dd>
                    </div>
                    <div>
                      <dt>Acq. price</dt>
                      <dd>{a.acquisitionPrice}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </section>
        )}

        {vis.gallery !== false && (
          <section
            className="lpdd_section lpdd_loc_section"
            aria-labelledby="lpdd-loc"
          >
            <h2 id="lpdd-loc" className="lpd_section_title lpd_only_sr">
              Location
            </h2>
            <OfferingOverviewLocationMap detail={deal} />
          </section>
        )}

        <p className="lpdd_footer_note">
          Information reflects offering details as configured by the deal team
          and visibility set for LPs. Contact the sponsor for questions.
        </p>
      </div>
      <LpDealStickyCta label="Invest now" onInvest={onInvestNow} />
    </div>
  );
}
