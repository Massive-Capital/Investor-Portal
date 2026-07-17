export type ContactStatus = "active" | "suspended"

export type ContactSource = "local" | "ghl"

export interface ContactRow {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  note: string
  tags: string[]
  lists: string[]
  owners: string[]
  /** `active` (default) or `suspended` */
  status?: ContactStatus
  /** Text from the most recent edit (required when saving edits) */
  lastEditReason?: string
  /** Resolved display name for the user who created the row (from API) */
  createdByDisplayName?: string
  /** ISO timestamp when the contact was created (from API) */
  createdAt?: string
  /** Rows in deal_investment with contact_id = this contact id (viewer deal scope) */
  dealCount?: number
  /** Present when the row is sourced from GoHighLevel CRM */
  source?: ContactSource
  /** GoHighLevel contact id when `source` is `ghl` */
  ghlId?: string
  /** GHL rows are read-only in SyndicationX */
  readOnly?: boolean
  /** Original GHL lead source label */
  ghlSource?: string
  companyName?: string
  address?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  website?: string
  timezone?: string
  assignedTo?: string
  contactType?: string
  customFields?: Array<{ label: string; value: string }>
  updatedAt?: string
}
