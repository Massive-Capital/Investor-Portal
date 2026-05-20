import type { ReactNode } from "react"
import type { OfferingMetricChip } from "../dealOfferingPreviewShared"
import { DealOfferingPreviewBentoAdaptiveGrid } from "./DealOfferingPreviewBentoAdaptiveGrid"

function BentoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="deal_offer_pf_bento_chip">
      <p className="deal_offer_pf_bento_chip_label">{label}</p>
      <p className="deal_offer_pf_bento_chip_value">{value}</p>
    </div>
  )
}

export interface DealOfferingPreviewBentoLayoutProps {
  profileChips: { label: string; value: string }[]
  metricChips: OfferingMetricChip[]
  gallery: ReactNode
  fundingColumn: ReactNode
  /** About offering, key highlights, etc. (1–2 tiles). */
  infoRow: ReactNode | null
  /** Full-width investor class bento (1–3 tiles). */
  classesRow: ReactNode | null
  documents: ReactNode | null
  assets: ReactNode | null
}

/** Wireframe bento: profile chips → gallery + funding (metrics + info under funding) → classes → documents → assets. */
export function DealOfferingPreviewBentoLayout({
  profileChips,
  metricChips,
  gallery,
  fundingColumn,
  infoRow,
  classesRow,
  documents,
  assets,
}: DealOfferingPreviewBentoLayoutProps) {
  return (
    <div className="deal_offer_pf_bento">
      {profileChips.length > 0 ? (
        <div
          className="deal_offer_pf_bento_chips"
          role="list"
          aria-label="Deal profile"
        >
          {profileChips.map((chip) => (
            <BentoChip key={chip.label} label={chip.label} value={chip.value} />
          ))}
        </div>
      ) : null}

      <div className="deal_offer_pf_bento_media_row">
        <div className="deal_offer_pf_bento_tile deal_offer_pf_bento_tile--gallery">
          {gallery}
        </div>
        <div className="deal_offer_pf_bento_tile deal_offer_pf_bento_tile--funding">
          <div className="deal_offer_pf_bento_funding_stack">
            {fundingColumn}

            {metricChips.length > 0 ? (
              <div
                className="deal_offer_pf_bento_chips deal_offer_pf_bento_chips--metrics"
                role="list"
                aria-label="Offering metrics"
              >
                {metricChips.map((chip) => (
                  <BentoChip
                    key={chip.label}
                    label={chip.label}
                    value={chip.value}
                  />
                ))}
              </div>
            ) : null}

            {infoRow ? (
              <DealOfferingPreviewBentoAdaptiveGrid
                className="deal_offer_pf_bento_info_row deal_offer_pf_bento_info_row--under_funding"
                ariaLabel="Offering summary"
              >
                {infoRow}
              </DealOfferingPreviewBentoAdaptiveGrid>
            ) : null}
          </div>
        </div>
      </div>

      {classesRow ? (
        <div className="deal_offer_pf_bento_classes_row">{classesRow}</div>
      ) : null}

      {documents}
      {assets}
    </div>
  )
}
