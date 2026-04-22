import { getSessionUserEmail } from "../../../../../common/auth/sessionUserEmail"
import { fetchDealInvestors } from "../api/dealsApi"
import { resolveInvestmentStatusSelectValue } from "../constants/investment-status"
import { parseMoneyDigits } from "./offeringMoneyFormat"

export interface LpInvestNowPrefill {
  profileId: string
  amount: string
  status: string
  docSignedDate: string
}

/**
 * Loads profile, commitment, status, and doc signed date for the signed-in LP on this deal
 * (same source as the Investors tab) so Invest Now opens with sponsor-recorded values.
 */
export async function fetchLpInvestNowPrefill(
  dealId: string,
): Promise<LpInvestNowPrefill | null> {
  const did = dealId.trim()
  if (!did) return null
  const email = getSessionUserEmail()?.trim().toLowerCase()
  if (!email) return null
  try {
    const payload = await fetchDealInvestors(did, { lpInvestorsOnly: true })
    const row = payload.investors.find(
      (r) => String(r.userEmail ?? "").trim().toLowerCase() === email,
    )
    if (!row) return null
    const profileId = String(row.profileId ?? "").trim()
    let amount = ""
    const n = parseMoneyDigits(String(row.committed ?? "").trim())
    if (Number.isFinite(n) && n > 0) amount = String(n)
    const status = resolveInvestmentStatusSelectValue(
      String(row.status ?? "").trim(),
    )
    let docSignedDate = ""
    const iso = String(row.docSignedDateIso ?? "").trim()
    if (iso) {
      const d = iso.slice(0, 10)
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) docSignedDate = d
    }
    return { profileId, amount, status, docSignedDate }
  } catch {
    return null
  }
}
