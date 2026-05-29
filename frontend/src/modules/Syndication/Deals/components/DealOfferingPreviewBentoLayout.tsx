import type { ReactNode } from "react"
import type { OfferingSidebarSummaryRow } from "../dealOfferingPreviewShared"

function SidebarSummaryRow({ label, value }: OfferingSidebarSummaryRow) {
  return (
    <div className="deal_offer_pf_sidebar_row">
      <dt className="deal_offer_pf_sidebar_label">{label}</dt>
      <dd className="deal_offer_pf_sidebar_value">{value}</dd>
    </div>
  )
}

export interface DealOfferingPreviewBentoLayoutProps {
  gallery: ReactNode
  /** Below metrics card: invest CTA, announcement, etc. */
  sidebar: ReactNode
  summaryRows: OfferingSidebarSummaryRow[]
  keyHighlights: ReactNode | null
  summary: ReactNode | null
  documents: ReactNode | null
  assets: ReactNode | null
  location: ReactNode | null
  classesRow: ReactNode | null
}

/**
 * Responsive grid: gallery → sticky metrics → rest on narrow screens;
 * metrics column stays sticky beside gallery + body from ~36rem up.
 */
export function DealOfferingPreviewBentoLayout({
  gallery,
  sidebar,
  summaryRows,
  keyHighlights,
  summary,
  documents,
  assets,
  location,
  classesRow,
}: DealOfferingPreviewBentoLayoutProps) {
  return (
    <div className="deal_offer_pf_wireframe">
      <div className="deal_offer_pf_wireframe_layout">
        <div className="deal_offer_pf_wireframe_main">
          <section
            className="deal_offer_pf_wireframe_block deal_offer_pf_wireframe_gallery"
            aria-label="Photo gallery"
          >
            {gallery}
          </section>

          <div className="deal_offer_pf_wireframe_body">
            {keyHighlights}
            {summary}
            <div className="deal_offer_pf_wireframe_stack">
              {documents}
              {assets}
              {location}
            </div>
            {classesRow ? (
              <div className="deal_offer_pf_wireframe_below">{classesRow}</div>
            ) : null}
          </div>
        </div>

        <aside
          className="deal_offer_pf_wireframe_sidebar"
          aria-label="Offering summary"
        >
          <div className="deal_offer_pf_sidebar_sticky">
            {summaryRows.length > 0 ? (
              <div className="deal_offer_pf_sidebar_card">
                <dl className="deal_offer_pf_sidebar_list">
                  {summaryRows.map((row) => (
                    <SidebarSummaryRow
                      key={row.label}
                      label={row.label}
                      value={row.value}
                    />
                  ))}
                </dl>
              </div>
            ) : null}
            {sidebar}
          </div>
        </aside>
      </div>
    </div>
  )
}
