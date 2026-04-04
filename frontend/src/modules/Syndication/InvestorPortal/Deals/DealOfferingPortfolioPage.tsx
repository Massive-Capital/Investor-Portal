import { ArrowLeft, Eye, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { assetImagePathToUrl } from "../../../../common/utils/apiBaseUrl"
import { setAppDocumentTitle } from "../../../../common/utils/appDocumentTitle"
import { formatDateDdMmmYyyy } from "../../../../common/utils/formatDateDisplay"
import {
  fetchDealById,
  fetchDealInvestorClasses,
  type DealDetailApi,
} from "./api/dealsApi"
import type { DealInvestorClass } from "./types/deal-investor-class.types"
import {
  investorClassStatusLabel,
  investorClassVisibilityLabel,
} from "./utils/offeringDisplayLabels"
import { formatMoneyFieldDisplay } from "./utils/offeringMoneyFormat"
import "./deal-offering-portfolio.css"
import "./deals-list.css"

function boolLabel(value: boolean): string {
  return value ? "Yes" : "No"
}

function buildSummaryBits(detail: DealDetailApi): string[] {
  const lr = detail.listRow
  return [
    lr.raiseTarget && `Raise target: ${lr.raiseTarget}`,
    lr.totalAccepted && `Total accepted: ${lr.totalAccepted}`,
    lr.investors && `Investors: ${lr.investors}`,
    detail.dealType && `Type: ${detail.dealType}`,
  ].filter(Boolean) as string[]
}

export function DealOfferingPortfolioPage() {
  const { dealId } = useParams<{ dealId: string }>()
  const [detail, setDetail] = useState<DealDetailApi | null>(null)
  const [classes, setClasses] = useState<DealInvestorClass[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!dealId) {
      setLoading(false)
      setNotFound(true)
      return
    }
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    void (async () => {
      try {
        const [d, ic] = await Promise.all([
          fetchDealById(dealId),
          fetchDealInvestorClasses(dealId),
        ])
        if (cancelled) return
        setDetail(d)
        setClasses(ic)
      } catch {
        if (!cancelled) {
          setDetail(null)
          setClasses([])
          setNotFound(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dealId])

  const title =
    detail?.dealName?.trim() ||
    detail?.propertyName?.trim() ||
    "Offering"

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

  if (!dealId) {
    return (
      <div className="deals_list_page deals_detail_page">
        <p className="deals_list_not_found">Missing deal.</p>
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

  const galleryUrl = assetImagePathToUrl(detail.assetImagePath)
  const lr = detail.listRow
  const offeringSizeDisplay =
    detail.offeringSize?.trim() ||
    lr.raiseTarget?.trim() ||
    "—"

  const location =
    [detail.city, detail.country].filter((x) => x?.trim()).join(", ") || "—"

  const summaryBits = buildSummaryBits(detail)

  return (
    <div className="deals_list_page deals_detail_page deal_offer_pf_page">
      <div className="deal_offer_pf">
        <header className="deal_offer_pf_header">
          <Link
            to={`/deals/${encodeURIComponent(dealId)}`}
            className="deal_offer_pf_back"
          >
            <ArrowLeft size={18} strokeWidth={2} aria-hidden />
            Back to deal
          </Link>
          <div className="deal_offer_pf_header_meta">
            <span className="deal_offer_pf_badge">Investment offering</span>
            <span className="deal_offer_pf_header_hint">
              <Eye size={15} strokeWidth={2} aria-hidden />
              Investor-facing preview
            </span>
          </div>
        </header>

        <div className="deal_offer_pf_hero">
          {galleryUrl ? (
            <>
              <img
                src={galleryUrl}
                alt=""
                className="deal_offer_pf_hero_img"
              />
              <div className="deal_offer_pf_hero_overlay">
                <h1 className="deal_offer_pf_title">{title}</h1>
                <p className="deal_offer_pf_sub">
                  {[detail.propertyName, location].filter(Boolean).join(" · ") ||
                    "—"}
                </p>
              </div>
            </>
          ) : (
            <div className="deal_offer_pf_hero_overlay deal_offer_pf_hero_plain">
              <h1 className="deal_offer_pf_title">{title}</h1>
              <p className="deal_offer_pf_sub">
                {[detail.propertyName, location].filter(Boolean).join(" · ") ||
                  "—"}
              </p>
            </div>
          )}
        </div>

        <div className="deal_offer_pf_stats">
          <div className="deal_offer_pf_stat">
            <p className="deal_offer_pf_stat_label">Offering size</p>
            <p className="deal_offer_pf_stat_value">{offeringSizeDisplay}</p>
          </div>
          <div className="deal_offer_pf_stat">
            <p className="deal_offer_pf_stat_label">Raise target</p>
            <p className="deal_offer_pf_stat_value">
              {lr.raiseTarget?.trim() || "—"}
            </p>
          </div>
          <div className="deal_offer_pf_stat">
            <p className="deal_offer_pf_stat_label">Investors</p>
            <p className="deal_offer_pf_stat_value">
              {lr.investors?.trim() || "—"}
            </p>
          </div>
          <div className="deal_offer_pf_stat">
            <p className="deal_offer_pf_stat_label">Total accepted</p>
            <p className="deal_offer_pf_stat_value">
              {lr.totalAccepted?.trim() || "—"}
            </p>
          </div>
        </div>

        <section className="deal_offer_pf_section" aria-labelledby="deal-pf-facts">
          <h2 id="deal-pf-facts" className="deal_offer_pf_section_title">
            Deal details
          </h2>
          <dl className="deal_offer_pf_facts">
            <div className="deal_offer_pf_fact">
              <dt>Deal type</dt>
              <dd>{detail.dealType?.trim() || "—"}</dd>
            </div>
            <div className="deal_offer_pf_fact">
              <dt>Stage</dt>
              <dd>{detail.dealStage?.trim() || "—"}</dd>
            </div>
            <div className="deal_offer_pf_fact">
              <dt>Security type</dt>
              <dd>{detail.secType?.trim() || "—"}</dd>
            </div>
            <div className="deal_offer_pf_fact">
              <dt>Target close</dt>
              <dd>{formatDateDdMmmYyyy(detail.closeDate?.trim())}</dd>
            </div>
            <div className="deal_offer_pf_fact">
              <dt>Owning entity</dt>
              <dd>{detail.owningEntityName?.trim() || "—"}</dd>
            </div>
            <div className="deal_offer_pf_fact">
              <dt>Location</dt>
              <dd>{location}</dd>
            </div>
          </dl>
        </section>

        <section className="deal_offer_pf_section" aria-labelledby="deal-pf-summary">
          <h2 id="deal-pf-summary" className="deal_offer_pf_section_title">
            Summary
          </h2>
          {summaryBits.length > 0 ? (
            <ul className="deal_offer_pf_bullets">
              {summaryBits.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : (
            <p className="deal_offer_pf_muted">
              Summary metrics will appear here when available.
            </p>
          )}
        </section>

        <section className="deal_offer_pf_section" aria-labelledby="deal-pf-funding">
          <h2 id="deal-pf-funding" className="deal_offer_pf_section_title">
            Funding
          </h2>
          <dl className="deal_offer_pf_facts">
            <div className="deal_offer_pf_fact">
              <dt>Auto-send funding instructions</dt>
              <dd>{boolLabel(detail.autoSendFundingInstructions)}</dd>
            </div>
            <div className="deal_offer_pf_fact">
              <dt>Funds required before GP sign</dt>
              <dd>{boolLabel(detail.fundsRequiredBeforeGpSign)}</dd>
            </div>
          </dl>
        </section>

        <section className="deal_offer_pf_section" aria-labelledby="deal-pf-classes">
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
    </div>
  )
}
