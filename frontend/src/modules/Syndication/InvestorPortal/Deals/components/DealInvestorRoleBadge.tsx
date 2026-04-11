import { Award, ClipboardList, Shield, UserCircle, Users } from "lucide-react"
import {
  investorRoleLabel,
  LP_INVESTOR_ROLE_VALUE,
} from "../constants/investor-profile"

/**
 * Same chrome as Members page `UserRoleBadge` (`um_role_badge` + icon) for deal investor roles.
 */
export function DealInvestorRoleBadge({
  investorRole,
}: {
  investorRole?: string
}) {
  const label = investorRoleLabel(investorRole ?? "")
  if (!label || label === "—") {
    return <span className="um_status_muted">—</span>
  }
  const raw = String(investorRole ?? "").trim().toLowerCase()
  const Icon = (() => {
    if (raw === LP_INVESTOR_ROLE_VALUE || raw === "lp investors") return Users
    if (raw === "lead sponsor") return Award
    if (raw === "admin sponsor") return ClipboardList
    if (raw === "co-sponsor") return UserCircle
    return Shield
  })()

  return (
    <span className="um_role_badge deal_inv_role_badge">
      <Icon
        className="um_role_badge_icon"
        size={16}
        strokeWidth={2}
        aria-hidden
      />
      <span className="um_role_badge_label">{label}</span>
    </span>
  )
}
