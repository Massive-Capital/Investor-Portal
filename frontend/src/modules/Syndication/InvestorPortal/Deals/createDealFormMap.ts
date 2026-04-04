import type { DealDetailApi } from "./api/dealsApi"
import {
  DEAL_STAGE_CHOICES,
  DEFAULT_ASSET_COUNTRY,
  type AssetStepDraft,
  type DealStepDraft,
} from "./types/deals.types"

/** Maps GET /deals/:id response into the same draft shape as the create-deal wizard. */
export function mapDealDetailApiToCreateDrafts(detail: DealDetailApi): {
  deal: DealStepDraft
  asset: AssetStepDraft
} {
  const stageRaw = String(detail.dealStage ?? "").trim()
  const stageOk = DEAL_STAGE_CHOICES.some((c) => c.value === stageRaw)
  const dealStage = stageOk
    ? (stageRaw as Exclude<DealStepDraft["dealStage"], "">)
    : ""

  let closeDate = ""
  if (detail.closeDate != null && String(detail.closeDate).trim() !== "") {
    const s = String(detail.closeDate)
    closeDate = s.length >= 10 ? s.slice(0, 10) : s
  }

  return {
    deal: {
      dealName: detail.dealName ?? "",
      dealType: detail.dealType ?? "",
      dealStage,
      secType: detail.secType ?? "",
      closeDate,
      owningEntityName: detail.owningEntityName ?? "",
      fundsBeforeGpCountersigns: detail.fundsRequiredBeforeGpSign
        ? "yes"
        : "no",
      autoFundingAfterGpCountersigns: detail.autoSendFundingInstructions
        ? "yes"
        : "no",
    },
    asset: {
      propertyName: detail.propertyName ?? "",
      country: detail.country?.trim() || DEFAULT_ASSET_COUNTRY,
      streetAddress1: "",
      streetAddress2: "",
      city: detail.city ?? "",
      state: "",
      zipCode: "",
    },
  }
}
