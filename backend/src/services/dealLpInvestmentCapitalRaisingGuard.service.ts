import { getAddDealFormById } from "./dealForm.service.js";
import { isDealStageCapitalRaising } from "../utils/dealStageCapitalRaising.js";

/**
 * Matches copy_code LP self-serve commitment guard (403 when not raising capital).
 * Optional: call from `patchDealLpInvestorMyCommitment` after loading the deal row.
 */
export async function assertDealAllowsLpInvestmentRecording(
  dealId: string,
): Promise<void> {
  const dealRow = await getAddDealFormById(dealId.trim());
  if (!dealRow || !isDealStageCapitalRaising(dealRow.dealStage)) {
    throw new Error(
      "Investments can only be recorded while the deal is raising capital.",
    );
  }
}
