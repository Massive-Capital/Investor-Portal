import { FilePenLine } from "lucide-react"
import {
  formatMemberUsername,
  formatValue,
} from "../../../../usermanagement/memberAdminShared"
import type { DealInvestorRow } from "../types/deal-investors.types"

function dealMemberInitials(r: DealInvestorRow): string {
  const name = String(r.displayName ?? "").trim()
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  if (name.length >= 2) return name.slice(0, 2).toUpperCase()
  const u = String(r.userDisplayName ?? "")
    .trim()
    .replace(/^@+/, "")
  if (u.length >= 2 && !/^invited_[0-9a-f]+$/i.test(u))
    return u.slice(0, 2).toUpperCase()
  const e = String(r.userEmail ?? "").trim()
  if (e.length >= 2) return e.slice(0, 2).toUpperCase()
  return "?"
}

export function DealMemberUserCell({
  row,
  isDraft,
}: {
  row: DealInvestorRow
  isDraft?: boolean
}) {
  const initials = dealMemberInitials(row)
  const rawEmail = String(row.userEmail ?? "").trim()
  const displayNameTrim = String(row.displayName ?? "").trim()
  const usernameFormatted = formatMemberUsername(row.userDisplayName)
  const nameLine =
    displayNameTrim ||
    (usernameFormatted !== "—" ? usernameFormatted : "—")
  const emailText = String(formatValue(row.userEmail)).trim() || "—"

  return (
    <div className="um_user_cell">
      <div className="um_user_avatar_ring" aria-hidden>
        <span className="um_user_initials">{initials}</span>
      </div>
      <div className="um_user_meta">
        <div className="deal_member_user_name_row">
          <span
            className={`um_user_meta_username${
              nameLine === "—" ? " um_user_meta_username--placeholder" : ""
            }`}
          >
            {nameLine}
          </span>
          {isDraft ? (
            <span
              className="deals_list_draft_icon deals_list_draft_icon--draft"
              title="Unsaved draft"
            >
              <FilePenLine size={14} strokeWidth={2} aria-hidden />
              <span className="deals_list_sr_only">Draft</span>
            </span>
          ) : null}
        </div>
        {rawEmail.includes("@") ? (
          <a
            href={`mailto:${encodeURIComponent(rawEmail)}`}
            className="um_user_meta_email um_user_meta_email_link"
          >
            {rawEmail}
          </a>
        ) : (
          <span className="um_user_meta_email">{emailText}</span>
        )}
      </div>
    </div>
  )
}
