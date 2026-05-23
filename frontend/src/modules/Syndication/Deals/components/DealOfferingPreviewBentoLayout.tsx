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
  /** Sticky right column: summary, invest CTA, announcement, funding. */
  sidebar: ReactNode
  summaryRows: OfferingSidebarSummaryRow[]
  keyHighlights: ReactNode | null
  summary: ReactNode | null
  documents: ReactNode | null
  assets: ReactNode | null
  location: ReactNode | null
  /** Full-width sections below the main stack (e.g. classes). */
  classesRow: ReactNode | null
}

/**
 * Wireframe portfolio: gallery + sidebar grid, then key highlights → summary →
 * documents → assets → location.
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
        <div className="deal_offer_pf_wireframe_primary">
          <section
            className="deal_offer_pf_wireframe_block deal_offer_pf_wireframe_block--gallery"
            aria-label="Photo gallery"
          >
            {gallery}
          </section>

          {keyHighlights}

          {summary}
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

        <div className="deal_offer_pf_wireframe_secondary">
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
    </div>
  )
}
