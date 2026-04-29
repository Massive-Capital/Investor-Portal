/** KPI strip on deal detail → Investors tab (populated state) */
export interface DealInvestorsKpis {
  offeringSize: string
  committed: string
  remaining: string
  totalApproved: string
  totalPending: string
  totalFunded: string
  approvedCount: string
  pendingCount: string
  waitlistCount: string
  averageApproved: string
  nonAccreditedCount: string
}

/** Single row in the Investors table */
export interface DealInvestorRow {
  id: string
  /** Member / contact name — first line in identity cell */
  displayName: string
  /** Investor profile label (e.g. Individual, LLC) — second line in identity cell */
  entitySubtitle: string
  /** Portal user login / display name for this member */
  userDisplayName: string
  /** Portal user email */
  userEmail: string
  investorClass: string
  /** Investor role label from investment row; empty → show "—" in UI */
  investorRole?: string
  /**
   * Optional: multiple deal-level roles for this contact (e.g. roster + LP). When present,
   * the Role column renders these instead of `investorRole` alone.
   */
  memberRoleLabels?: string[]
  status: string
  /**
   * Stored `deal_investment.fund_approved` when API sends it; otherwise infer from
   * workflow status for older payloads.
   */
  fundApproved?: boolean
  /**
   * Stored approved commitment total when sponsor last approved fund (numeric string).
   * With further LP commits before re-approval, UI shows snapshot + new amount.
   */
  fundApprovedCommitmentSnapshot?: string
  committed: string
  signedDate: string
  fundedDate: string
  selfAccredited: string
  verifiedAccLabel: string
  /** Editable row fields (from API) — used when opening Edit investment */
  contactId?: string
  profileId?: string
  /** Investing → Profiles saved row id, when set on the deal investment. */
  userInvestorProfileId?: string
  /**
   * My Profiles **display name** denormalized on the deal investment when the commitment
   * is saved (so the client need not map id → name). When absent, fall back to the book.
   */
  userInvestorProfileName?: string
  offeringId?: string
  commitmentAmountRaw?: string
  extraContributionAmounts?: string[]
  docSignedDateIso?: string
  /** Portal user who added this member (`deal_member.added_by` → `users` display name). */
  addedByDisplayName?: string
  /** `users.id` of the sponsor who added this investor (when API sends it). */
  addedByUserId?: string
  /** True when `addedByUserId` is a Lead / Admin / Co-sponsor on this deal’s roster. */
  addedByIsSponsorOnDeal?: boolean
  /**
   * Deal Members tab: total committed (USD) on other investors this member added to the
   * roster (excludes their own commitment). From API `addedInvestorsCommitted`.
   */
  addedInvestorsCommitted?: string
  /**
   * `send_invitation_mail` on `deal_member` or `deal_lp_investor` (yes = Mail Sent, no = Not sent).
   * When true, the kebab action is “Re-send invitation mail”.
   */
  invitationMailSent?: boolean
  /** `lp_roster` = row from `deal_lp_investor` only (no `deal_investment`). */
  investorKind?: "investment" | "lp_roster"
}

export interface DealInvestorsPayload {
  kpis: DealInvestorsKpis
  investors: DealInvestorRow[]
}
