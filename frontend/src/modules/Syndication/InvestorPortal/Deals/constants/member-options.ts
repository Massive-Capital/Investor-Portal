/**
 * Fallback when GET /users returns no rows (offline / no API base).
 * Prefer live directory from `fetchUsersForMemberSelect` in the add-deal-member form.
 */
export const MEMBER_SELECT_OPTIONS = [
  { value: "", label: "Select member" },
  {
    value: "rebecca_duffy",
    label: "Rebecca Duffy — rebecca.duffy@example.com",
  },
  {
    value: "nigam_family",
    label: "Nigam Family LLC — contact@nigamfamily.com",
  },
  {
    value: "j_smith",
    label: "J. Smith — j.smith@example.com",
  },
] as const
