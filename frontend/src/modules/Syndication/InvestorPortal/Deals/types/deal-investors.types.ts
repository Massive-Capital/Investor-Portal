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
  status: string
  committed: string
  signedDate: string
  fundedDate: string
  selfAccredited: string
  verifiedAccLabel: string
  /** Editable row fields (from API) — used when opening Edit investment */
  contactId?: string
  profileId?: string
  offeringId?: string
  commitmentAmountRaw?: string
  extraContributionAmounts?: string[]
  docSignedDateIso?: string
  /** Portal user who added this member (`deal_member.added_by` → `users` display name). */
  addedByDisplayName?: string
  /**
   * Member invitation email was sent (from API e.g. `invitation_mail_sent`).
   * When true, actions show “Invitation sent” (disabled); when false, “Send invitation email”.
   */
  invitationMailSent?: boolean
  /** `lp_roster` = row from `deal_lp_investor` only (no `deal_investment`). */
  investorKind?: "investment" | "lp_roster"
}

export interface DealInvestorsPayload {
  kpis: DealInvestorsKpis
  investors: DealInvestorRow[]
}
