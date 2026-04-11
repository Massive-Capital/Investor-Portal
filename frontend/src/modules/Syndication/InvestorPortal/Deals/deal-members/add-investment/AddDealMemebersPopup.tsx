import type { LucideIcon } from "lucide-react"
import {
  Activity,
  Briefcase,
  Calendar,
  DollarSign,
  IdCard,
  Loader2,
  Mail,
  Pencil,
  Save,
  Shield,
  Tag,
  UserRound,
  X,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react"
import type { ReactNode } from "react"
import { toast } from "../../../../../../common/components/Toast"
import {
  DataTable,
  type DataTableColumn,
} from "../../../../../../common/components/data-table/DataTable"
import {
  DropdownSelect,
  type DropdownSelectSection,
} from "../../../../../../common/components/dropdown-select"
import {
  createContact,
  fetchContacts,
} from "../../../../../contacts/api/contactsApi"
import { AddContactPanel } from "../../../../../contacts/components/AddContactPanel"
import type { ContactRow } from "../../../../../contacts/types/contact.types"
import {
  fetchDealInvestorClasses,
  fetchDealMembers,
  fetchUsersForMemberSelect,
  postDealInvestment,
  putDealInvestment,
} from "../../api/dealsApi"
import { getApiV1Base } from "../../../../../../common/utils/apiBaseUrl"
import { MEMBER_SELECT_OPTIONS } from "../../constants/member-options"
import { INVESTMENT_STATUS_SELECT_OPTIONS } from "../../constants/investment-status"
import {
  INVESTOR_PROFILE_SELECT_OPTIONS,
  INVESTOR_ROLE_SELECT_OPTIONS,
  LEAD_SPONSOR_ROLE_VALUE,
  isAdminSponsorOrCoSponsorRole,
  isLeadSponsorRole,
  leadSponsorContactIdExcludingRow,
  leadSponsorTakenByAnotherMember,
} from "../../constants/investor-profile"

import type { AddInvestmentFormValues } from "./add_deal_member_types"
import {
  addMemberDraftEligibleForBackendAutosave,
  addMemberDraftHasContent,
  clearAddMemberDraft,
  loadAddMemberDraft,
  saveAddMemberDraft,
  type AddMemberFormDraft,
} from "./addMemberFormDraftStorage"
import type { DealInvestorClass } from "../../types/deal-investor-class.types"
import { rowDisplayName } from "../../../../../usermanagement/memberAdminShared"
import { blurFormatMoneyInput } from "../../utils/offeringMoneyFormat"
import { InfoIconPanel } from "../../components/FieldInfoHeading"
import "../../../../../contacts/contacts.css"
import "../../../../../usermanagement/user_management.css"
import "../../components/deal-step-form.css"
import "./add_deal_modal.css"

const INVESTOR_CLASS_UNAVAILABLE_HINT =
  "Please complete the Classes section to assign an investor class."

const PREFIX_CONTACT = "contact:"
const PREFIX_USER = "user:"

const DROPDOWN_TRIGGER_PILL =
  "um_field_select deals_add_inv_field_control deals_add_inv_field_pill"

function contactOptionLabel(c: ContactRow): string {
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim()
  if (name && c.email.trim()) return `${name} — ${c.email.trim()}`
  if (c.email.trim()) return c.email.trim()
  return name || "Contact"
}

function buildMemberLabel(u: Record<string, unknown>): string {
  const name = rowDisplayName(u)
  const email = String(u.email ?? "").trim()
  if (name && name !== "—" && email) return `${name} — ${email}`
  if (email) return email
  return name !== "—" ? name : "—"
}

function memberOptionFromUser(
  u: Record<string, unknown>,
): { value: string; label: string } | null {
  const id = String(u.id ?? "").trim()
  if (!id) return null
  const label = buildMemberLabel(u)
  if (label === "—" || label === id) {
    const email = String(u.email ?? "").trim()
    const un = String(u.username ?? "").trim()
    const fallback = email || un || "Member"
    return { value: id, label: fallback }
  }
  return { value: id, label }
}

/** Rich dropdown row: name/email + subtle “Already added” (deal roster). */
function alreadyAddedOptionLabel(baseLabel: string) {
  return (
    <span className="portal_dropdown_select_option_label_row">
      <span className="portal_dropdown_select_option_label_text">{baseLabel}</span>
      <span className="portal_dropdown_select_option_suffix">Already added</span>
    </span>
  )
}

/** Field row matching Add contact (`um_field` + `um_field_label_row`). */
function InvFormField({
  id,
  label,
  Icon,
  children,
  tight,
  labelSuffix,
}: {
  id: string
  label: string
  Icon: LucideIcon
  children: ReactNode
  tight?: boolean
  labelSuffix?: ReactNode
}) {
  return (
    <div className={tight ? "um_field add_contact_field_tight" : "um_field"}>
      <label htmlFor={id} className="um_field_label_row">
        <Icon className="um_field_label_icon" size={17} aria-hidden />
        <span>{label}</span>
        {labelSuffix}
      </label>
      {children}
    </div>
  )
}

function withInvitationMailPolicy(
  f: AddInvestmentFormValues,
  blockInvites: boolean,
): AddInvestmentFormValues {
  if (!blockInvites) return f
  return { ...f, sendInvitationMail: "no" }
}

function emptyForm(): AddInvestmentFormValues {
  return {
    offeringId: "",
    contactId: "",
    profileId: "",
    investorRole: "",
    status: "",
    investorClass: "",
    docSignedDate: "",
    commitmentAmount: "",
    extraContributionAmounts: [],
    documentFileName: null,
    sendInvitationMail: "yes",
  }
}

interface AddInvestmentModalProps {
  /** Used to load investor classes from Offering Details */
  dealId: string
  open: boolean
  onClose: () => void
  onSave: (
    values: AddInvestmentFormValues,
    subscriptionDocument: File | null,
  ) => void | Promise<void>
  /** Primary offering label (e.g. deal name) */
  defaultOfferingLabel: string
  mode?: "add" | "edit"
  /** When `mode` is `edit`, prefill the form (e.g. from an investor row). */
  initialValues?: AddInvestmentFormValues | null
  /** Stable key when opening add vs edit (e.g. investment row id) so class prefill syncs correctly. */
  prefillKey?: string
  /** Add mode only: “Add Investor” (Investors tab) vs “Add Member” (Deal Members). */
  addEntry?: "member" | "investor"
  /**
   * Add mode: when true (“Continue editing”), restore session draft into the form.
   * When false (“Add Member”), always open an empty form; the table draft row still reflects
   * saved session data until the user deletes it or saves a completed member.
   */
  restoreAddMemberSessionDraft?: boolean
  /**
   * After debounced backend autosave (add mode). `createdInvestment` is true only
   * on first POST when an investment id is assigned — use that to refresh Deal Members
   * once; omitting it on every PUT avoids DataTable flicker while typing.
   */
  onBackendAutosave?: (
    detail?: { createdInvestment?: boolean },
  ) => void | Promise<void>
  /**
   * While the deal is in draft / incomplete, do not send invitation emails
   * (save/autosave forces `send_invitation_mail` off).
   */
  dealBlocksInvitationEmails?: boolean
}

export function AddInvestmentModal({
  dealId,
  open,
  onClose,
  onSave,
  defaultOfferingLabel,
  mode = "add",
  initialValues = null,
  prefillKey = "default",
  addEntry = "member",
  restoreAddMemberSessionDraft = true,
  onBackendAutosave,
  dealBlocksInvitationEmails = false,
}: AddInvestmentModalProps) {
  const isInvestorEntry = addEntry === "investor"
  const titleId = useId()
  const addMemberDraftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const latestAddMemberDraftRef = useRef({ form: emptyForm(), step: 1 as 1 | 2 })
  const skipFlushDraftAfterSaveRef = useRef(false)
  const prevModalOpenRef = useRef(false)
  const [backendInvestmentId, setBackendInvestmentId] = useState<string | null>(
    null,
  )
  const backendInvestmentIdRef = useRef<string | null>(null)
  const backendInvAutosaveTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)
  const backendInvPostInFlightRef = useRef(false)
  const backendInvAutosaveInFlightRef = useRef(false)
  const [form, setForm] = useState<AddInvestmentFormValues>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [memberRows, setMemberRows] = useState<Record<string, unknown>[]>([])
  const [contactRows, setContactRows] = useState<ContactRow[]>([])
  const [dealClasses, setDealClasses] = useState<DealInvestorClass[]>([])
  const [investorClassesReady, setInvestorClassesReady] = useState(false)
  const [investorClassOptions, setInvestorClassOptions] = useState<
    { value: string; label: string }[]
  >([{ value: "", label: "Loading investor classes…" }])
  const [membersLoading, setMembersLoading] = useState(false)
  const [addContactModalOpen, setAddContactModalOpen] = useState(false)
  const [memberRosterForGate, setMemberRosterForGate] = useState<
    {
      id: string
      investorRole?: string
      contactId?: string
      profileId?: string
      userEmail?: string
    }[]
  >([])

  const refreshMemberRosterForGate = useCallback(() => {
    void fetchDealMembers(dealId).then((rows) => {
      setMemberRosterForGate(
        rows.map((r) => ({
          id: r.id,
          investorRole: r.investorRole,
          contactId: r.contactId,
          profileId: r.profileId,
          userEmail: r.userEmail,
        })),
      )
    })
  }, [dealId])

  /** Any stable row id from `editRow.id` — not only UUIDs (mock/API may use other shapes). */
  const editingRowIdForLeadSponsorGate = useMemo(() => {
    if (mode !== "edit") return null
    const k = prefillKey?.trim() ?? ""
    if (!k || k.startsWith("add-")) return null
    return k
  }, [mode, prefillKey])

  /** Edit: exclude the row being edited. Add: exclude autosaved `deal_investment` for this modal. */
  const excludeRowIdForLeadSponsorGate = useMemo(() => {
    if (mode === "edit") return editingRowIdForLeadSponsorGate
    const bid = backendInvestmentId?.trim()
    return bid || null
  }, [mode, editingRowIdForLeadSponsorGate, backendInvestmentId])

  const leadSponsorOptionDisabled = useMemo(
    () =>
      leadSponsorTakenByAnotherMember(
        memberRosterForGate,
        excludeRowIdForLeadSponsorGate,
      ),
    [memberRosterForGate, excludeRowIdForLeadSponsorGate],
  )

  const leadSponsorContactId = useMemo(
    () =>
      leadSponsorContactIdExcludingRow(
        memberRosterForGate,
        excludeRowIdForLeadSponsorGate,
      ),
    [memberRosterForGate, excludeRowIdForLeadSponsorGate],
  )

  const adminCoBlockedForSelectedContact = useMemo(
    () =>
      Boolean(leadSponsorContactId) &&
      form.contactId.trim() === leadSponsorContactId,
    [leadSponsorContactId, form.contactId],
  )

  /** Lead Sponsor is a single roster identity — do not allow changing member/contact while editing that row. */
  const memberContactSelectLocked = useMemo(
    () => mode === "edit" && isLeadSponsorRole(form.investorRole),
    [mode, form.investorRole],
  )

  const investorRoleDropdownOptions = useMemo(
    () =>
      INVESTOR_ROLE_SELECT_OPTIONS.map((o) => ({
        value: o.value,
        label: o.label,
        disabled:
          (o.value === LEAD_SPONSOR_ROLE_VALUE && leadSponsorOptionDisabled) ||
          (adminCoBlockedForSelectedContact &&
            (o.value === "admin sponsor" || o.value === "Co-sponsor")),
      })),
    [leadSponsorOptionDisabled, adminCoBlockedForSelectedContact],
  )

  useEffect(() => {
    if (!open) return
    refreshMemberRosterForGate()
  }, [open, refreshMemberRosterForGate])

  useLayoutEffect(() => {
    if (!open) return
    if (mode === "edit" && initialValues) {
      setForm({ ...emptyForm(), ...initialValues })
      setBackendInvestmentId(null)
      backendInvestmentIdRef.current = null
      setError(null)
      return
    }
    if (mode === "add" && !restoreAddMemberSessionDraft) {
      setForm({ ...emptyForm(), offeringId: "primary" })
      setBackendInvestmentId(null)
      backendInvestmentIdRef.current = null
      setError(null)
      return
    }
    const restored = loadAddMemberDraft(dealId)
    if (mode === "add" && restored && addMemberDraftHasContent(restored)) {
      setForm({
        ...emptyForm(),
        ...restored.form,
        offeringId: restored.form.offeringId?.trim() || "primary",
      })
      const bid = restored.backendInvestmentId?.trim()
      if (bid) {
        setBackendInvestmentId(bid)
        backendInvestmentIdRef.current = bid
      } else {
        setBackendInvestmentId(null)
        backendInvestmentIdRef.current = null
      }
    } else {
      setForm({ ...emptyForm(), offeringId: "primary" })
      setBackendInvestmentId(null)
      backendInvestmentIdRef.current = null
    }
    setError(null)
  }, [open, dealId, mode, initialValues, prefillKey, restoreAddMemberSessionDraft])

  latestAddMemberDraftRef.current = { form, step: 1 as const }

  /** Autosave Add Member draft (per deal) while adding — restored next time you open this modal. */
  useEffect(() => {
    if (!open || mode !== "add") {
      if (addMemberDraftTimerRef.current) {
        clearTimeout(addMemberDraftTimerRef.current)
        addMemberDraftTimerRef.current = null
      }
      return
    }
    if (addMemberDraftTimerRef.current)
      clearTimeout(addMemberDraftTimerRef.current)
    addMemberDraftTimerRef.current = setTimeout(() => {
      addMemberDraftTimerRef.current = null
      const { form: f } = latestAddMemberDraftRef.current
      const draft: AddMemberFormDraft = {
        form: f,
        step: 1 as const,
        ...(backendInvestmentIdRef.current
          ? { backendInvestmentId: backendInvestmentIdRef.current }
          : {}),
      }
      /* Fresh “Add Member”: do not overwrite stored draft with an empty form — keeps draft row visible. */
      if (!restoreAddMemberSessionDraft && !addMemberDraftHasContent(draft)) return
      saveAddMemberDraft(dealId, draft)
    }, 500)
    return () => {
      if (addMemberDraftTimerRef.current) {
        clearTimeout(addMemberDraftTimerRef.current)
        addMemberDraftTimerRef.current = null
      }
    }
  }, [open, mode, dealId, form, restoreAddMemberSessionDraft, backendInvestmentId])

  backendInvestmentIdRef.current = backendInvestmentId

  /** Debounced POST/PUT — same pattern as Add Deal (placeholder contact + first class on server). */
  useEffect(() => {
    if (!getApiV1Base()) return
    if (!open || mode !== "add") return
    if (!investorClassesReady || dealClasses.length === 0) return

    if (backendInvAutosaveTimerRef.current)
      clearTimeout(backendInvAutosaveTimerRef.current)
    backendInvAutosaveTimerRef.current = setTimeout(() => {
      backendInvAutosaveTimerRef.current = null
      void (async () => {
        const f = latestAddMemberDraftRef.current.form
        const draft: AddMemberFormDraft = {
          form: f,
          step: 1,
          ...(backendInvestmentIdRef.current
            ? { backendInvestmentId: backendInvestmentIdRef.current }
            : {}),
        }
        if (!addMemberDraftEligibleForBackendAutosave(draft)) return

        const values: AddInvestmentFormValues = withInvitationMailPolicy(
          {
            ...f,
            offeringId: f.offeringId?.trim() || "primary",
          },
          dealBlocksInvitationEmails,
        )

        const invId = backendInvestmentIdRef.current
        if (backendInvAutosaveInFlightRef.current) return

        if (invId) {
          backendInvAutosaveInFlightRef.current = true
          try {
            const result = await putDealInvestment(
              dealId,
              invId,
              values,
              null,
              { autosave: true },
            )
            if (result.ok && result.mode === "api") {
              refreshMemberRosterForGate()
              if (onBackendAutosave) await onBackendAutosave()
            }
          } catch {
            /* silent — user may be offline */
          } finally {
            backendInvAutosaveInFlightRef.current = false
          }
          return
        }

        if (backendInvPostInFlightRef.current) return
        backendInvPostInFlightRef.current = true
        backendInvAutosaveInFlightRef.current = true
        try {
          const result = await postDealInvestment(dealId, values, null, {
            autosave: true,
          })
          if (result.ok && result.mode === "api" && result.investmentId) {
            backendInvestmentIdRef.current = result.investmentId
            setBackendInvestmentId(result.investmentId)
            saveAddMemberDraft(dealId, {
              form: f,
              step: 1,
              backendInvestmentId: result.investmentId,
            })
          }
          if (result.ok && result.mode === "api") {
            refreshMemberRosterForGate()
            if (onBackendAutosave)
              await onBackendAutosave({
                createdInvestment: Boolean(result.investmentId),
              })
          }
        } finally {
          backendInvPostInFlightRef.current = false
          backendInvAutosaveInFlightRef.current = false
        }
      })()
    }, 1200)
    return () => {
      if (backendInvAutosaveTimerRef.current) {
        clearTimeout(backendInvAutosaveTimerRef.current)
        backendInvAutosaveTimerRef.current = null
      }
    }
  }, [
    open,
    mode,
    dealId,
    form,
    dealClasses.length,
    investorClassesReady,
    onBackendAutosave,
    refreshMemberRosterForGate,
    dealBlocksInvitationEmails,
  ])

  useEffect(() => {
    if (!dealBlocksInvitationEmails || !open) return
    setForm((prev) =>
      prev.sendInvitationMail === "no"
        ? prev
        : { ...prev, sendInvitationMail: "no" },
    )
  }, [dealBlocksInvitationEmails, open])

  /** Persist partial add-member data when the modal closes (covers close before debounced autosave). */
  useEffect(() => {
    const wasOpen = prevModalOpenRef.current
    prevModalOpenRef.current = open
    if (!wasOpen || open) return
    if (addMemberDraftTimerRef.current) {
      clearTimeout(addMemberDraftTimerRef.current)
      addMemberDraftTimerRef.current = null
    }
    if (skipFlushDraftAfterSaveRef.current) {
      skipFlushDraftAfterSaveRef.current = false
      return
    }
    if (mode !== "add") return
    const draft: AddMemberFormDraft = {
      form: latestAddMemberDraftRef.current.form,
      step: 1 as const,
      ...(backendInvestmentIdRef.current
        ? { backendInvestmentId: backendInvestmentIdRef.current }
        : {}),
    }
    if (!addMemberDraftHasContent(draft)) return
    saveAddMemberDraft(dealId, draft)
  }, [open, mode, dealId])

  useEffect(() => {
    if (!open) {
      setInvestorClassesReady(false)
      return
    }
    let cancelled = false
    setMembersLoading(true)
    setInvestorClassesReady(false)
    setInvestorClassOptions([{ value: "", label: "Loading investor classes…" }])
    void (async () => {
      const [users, contacts, classes] = await Promise.all([
        fetchUsersForMemberSelect(),
        fetchContacts(),
        fetchDealInvestorClasses(dealId),
      ])
      if (cancelled) return
      setMemberRows(users)
      setContactRows(contacts)
      setDealClasses(classes)

      if (classes.length > 0) {
        setInvestorClassOptions([
          { value: "", label: "Select investor class" },
          ...classes.map((row) => ({
            value: row.id,
            label: row.name.trim() || "Unnamed class",
          })),
        ])
      } else {
        setInvestorClassOptions([
          { value: "", label: "No investor classes defined" },
        ])
        setForm((prev) => ({ ...prev, investorClass: "" }))
      }

      setInvestorClassesReady(true)
      setMembersLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open, dealId])

  useEffect(() => {
    if (!open || !investorClassesReady || dealClasses.length === 0) return
    if (mode !== "edit" || !initialValues?.investorClass?.trim()) return
    const raw = initialValues.investorClass.trim()
    const byId = dealClasses.find((c) => c.id === raw)
    const resolved = byId
      ? raw
      : dealClasses.find(
          (c) => c.name.trim().toLowerCase() === raw.toLowerCase(),
        )?.id ?? ""
    if (!resolved) return
    setForm((prev) => ({ ...prev, investorClass: resolved }))
  }, [
    open,
    investorClassesReady,
    dealClasses,
    mode,
    initialValues?.investorClass,
    prefillKey,
  ])

  useEffect(() => {
    if (!open) return
    function onWindowKeyDown(ev: globalThis.KeyboardEvent) {
      if (ev.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onWindowKeyDown)
    return () => window.removeEventListener("keydown", onWindowKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open) setAddContactModalOpen(false)
  }, [open])

  const offeringOptions = [
    {
      value: "primary",
      label: defaultOfferingLabel.trim() || "Default offering",
    },
  ]

  const patch = useCallback((p: Partial<AddInvestmentFormValues>) => {
    setForm((prev) => ({ ...prev, ...p }))
  }, [])

  const patchMemberById = useCallback(
    (raw: string) => {
      if (memberContactSelectLocked) return

      function isLeadSponsorBlockedForAdminCo(nextContactId: string): boolean {
        if (
          !leadSponsorContactId ||
          nextContactId.trim() !== leadSponsorContactId
        )
          return false
        if (!isAdminSponsorOrCoSponsorRole(form.investorRole)) return false
        toast.error(
          "This person is already Lead Sponsor on this deal. They cannot also be Admin sponsor or Co-sponsor.",
        )
        return true
      }

      if (!raw) {
        patch({
          contactId: "",
          contactDisplayName: undefined,
          contactEmail: undefined,
          contactUsername: undefined,
        })
        return
      }

      if (raw.startsWith(PREFIX_CONTACT)) {
        const id = raw.slice(PREFIX_CONTACT.length)
        if (isLeadSponsorBlockedForAdminCo(id)) return
        const c = contactRows.find((x) => x.id === id)
        if (c) {
          const display = contactOptionLabel(c)
          patch({
            contactId: id,
            contactDisplayName: display.split(" — ")[0]?.trim() || display,
            contactEmail: c.email.trim(),
            contactUsername: undefined,
          })
        }
        return
      }

      const userId = raw.startsWith(PREFIX_USER)
        ? raw.slice(PREFIX_USER.length)
        : raw
      if (isLeadSponsorBlockedForAdminCo(userId)) return
      const u = memberRows.find((x) => String(x.id) === userId)
      if (u) {
        const display =
          rowDisplayName(u) !== "—"
            ? rowDisplayName(u)
            : String(u.email ?? "").trim() || "—"
        patch({
          contactId: userId,
          contactDisplayName: display,
          contactEmail: String(u.email ?? "").trim(),
          contactUsername: String(u.username ?? ""),
        })
        return
      }

      const fallbackOpt = MEMBER_SELECT_OPTIONS.find((o) => o.value === userId)
      if (fallbackOpt?.value) {
        const parts = fallbackOpt.label.split(" — ")
        patch({
          contactId: userId,
          contactDisplayName: parts[0]?.trim() || userId,
          contactEmail: parts[1]?.trim() ?? "",
          contactUsername: undefined,
        })
        return
      }

      patch({
        contactId: userId,
        contactDisplayName: undefined,
        contactEmail: undefined,
        contactUsername: undefined,
      })
    },
    [
      contactRows,
      memberRows,
      patch,
      leadSponsorContactId,
      form.investorRole,
      memberContactSelectLocked,
    ],
  )

  const memberSelectValue = useMemo(() => {
    const id = form.contactId.trim()
    if (!id) return ""
    if (contactRows.some((c) => c.id === id))
      return `${PREFIX_CONTACT}${id}`
    if (memberRows.some((u) => String(u.id) === id))
      return `${PREFIX_USER}${id}`
    if (MEMBER_SELECT_OPTIONS.some((o) => o.value === id))
      return `${PREFIX_USER}${id}`
    return id
  }, [form.contactId, contactRows, memberRows])

  const memberDropdownSections = useMemo((): DropdownSelectSection[] => {
    const lsId = leadSponsorContactId?.trim() ?? ""
    const blockLsPersonForAdminCo =
      Boolean(lsId) && isAdminSponsorOrCoSponsorRole(form.investorRole)
    function optionDisabledForLeadSponsorConflict(value: string): boolean {
      if (!blockLsPersonForAdminCo) return false
      if (value.startsWith(PREFIX_CONTACT)) {
        const id = value.slice(PREFIX_CONTACT.length).trim()
        return id === lsId
      }
      if (value.startsWith(PREFIX_USER)) {
        const id = value.slice(PREFIX_USER.length).trim()
        return id === lsId
      }
      return value.trim() === lsId
    }

    function isAlreadyOnDealRoster(contactOrUserId: string, email: string): boolean {
      const em = email.trim().toLowerCase()
      for (const r of memberRosterForGate) {
        if (
          excludeRowIdForLeadSponsorGate &&
          r.id === excludeRowIdForLeadSponsorGate
        )
          continue
        const cid = String(r.contactId ?? "").trim()
        if (cid && cid === contactOrUserId) return true
        const rowEm = String(r.userEmail ?? "").trim().toLowerCase()
        if (em && rowEm && rowEm === em) return true
      }
      return false
    }

    const sections: DropdownSelectSection[] = []
    if (contactRows.length > 0) {
      sections.push({
        heading: "Contacts",
        options: contactRows.map((c) => {
          const value = `${PREFIX_CONTACT}${c.id}`
          const baseLabel = contactOptionLabel(c)
          const onDeal = isAlreadyOnDealRoster(c.id, c.email ?? "")
          const disabled =
            optionDisabledForLeadSponsorConflict(value) || onDeal
          return {
            value,
            label: baseLabel,
            disabled,
            ...(onDeal ? { labelContent: alreadyAddedOptionLabel(baseLabel) } : {}),
          }
        }),
      })
    }
    const directoryOptions =
      memberRows.length > 0
        ? memberRows
            .map((u) => memberOptionFromUser(u))
            .filter((o): o is { value: string; label: string } => Boolean(o))
            .map((o) => {
              const value = `${PREFIX_USER}${o.value}`
              const dirRow = memberRows.find((x) => String(x.id) === o.value)
              const email = dirRow ? String(dirRow.email ?? "").trim() : ""
              const onDeal = isAlreadyOnDealRoster(o.value, email)
              const disabled =
                optionDisabledForLeadSponsorConflict(value) || onDeal
              return {
                value,
                label: o.label,
                disabled,
                ...(onDeal ? { labelContent: alreadyAddedOptionLabel(o.label) } : {}),
              }
            })
        : MEMBER_SELECT_OPTIONS.filter((o) => o.value !== "").map((o) => {
            const value = `${PREFIX_USER}${o.value}`
            const parts = o.label.split(" — ")
            const emailGuess = parts[1]?.trim() ?? ""
            const onDeal = isAlreadyOnDealRoster(o.value, emailGuess)
            const disabled =
              optionDisabledForLeadSponsorConflict(value) || onDeal
            return {
              value,
              label: o.label,
              disabled,
              ...(onDeal ? { labelContent: alreadyAddedOptionLabel(o.label) } : {}),
            }
          })
    sections.push({
      heading: isInvestorEntry ? "Directory users" : "Directory members",
      options: directoryOptions,
    })
    return sections
  }, [
    contactRows,
    memberRows,
    isInvestorEntry,
    leadSponsorContactId,
    form.investorRole,
    memberRosterForGate,
    excludeRowIdForLeadSponsorGate,
  ])

  const handleContactCreated = useCallback(
    (contact: ContactRow) => {
      setContactRows((prev) => {
        if (prev.some((c) => c.id === contact.id)) return prev
        return [...prev, contact]
      })
      const display = contactOptionLabel(contact)
      const namePart = display.split(" — ")[0]?.trim() || display
      patch({
        contactId: contact.id,
        contactDisplayName: namePart,
        contactEmail: contact.email.trim(),
        contactUsername: undefined,
      })
      toast.success(
        "Contact added",
        isInvestorEntry
          ? `${namePart} is selected as the investor for this investment.`
          : `${namePart} is selected as the member for this investment.`,
      )
    },
    [patch, isInvestorEntry],
  )

  const handleAddContactSave = useCallback(
    async (
      contact: Omit<ContactRow, "id" | "createdByDisplayName">,
    ) => {
      const created = await createContact(contact)
      handleContactCreated(created)
    },
    [handleContactCreated],
  )

  const noDealClasses =
    investorClassesReady && dealClasses.length === 0

  function validateInvestmentStep1(): boolean {
    if (!form.offeringId.trim()) {
      setError("Select an offering.")
      return false
    }
    if (!form.contactId.trim()) {
      setError(
        isInvestorEntry
          ? "Select an investor or contact."
          : "Select a member.",
      )
      return false
    }
    if (!investorClassesReady) {
      setError("Loading investor classes…")
      return false
    }
    if (noDealClasses) {
      setError(
        "Add at least one investor class in the Classes section before recording an investment.",
      )
      return false
    }
    if (!form.investorClass.trim()) {
      setError("Select an investor class.")
      return false
    }
    if (!dealClasses.some((c) => c.id === form.investorClass.trim())) {
      setError("Select a valid investor class from this deal.")
      return false
    }
    if (!form.commitmentAmount.trim()) {
      setError("Enter a commitment amount.")
      return false
    }
    if (
      leadSponsorContactId &&
      form.contactId.trim() === leadSponsorContactId &&
      isAdminSponsorOrCoSponsorRole(form.investorRole)
    ) {
      setError(
        "This person is already Lead Sponsor on this deal. They cannot also be Admin sponsor or Co-sponsor.",
      )
      return false
    }
    if (
      form.investorRole === LEAD_SPONSOR_ROLE_VALUE &&
      leadSponsorTakenByAnotherMember(
        memberRosterForGate,
        excludeRowIdForLeadSponsorGate,
      )
    ) {
      setError(
        "This deal already has a Lead Sponsor. Choose another role or edit the existing Lead Sponsor row.",
      )
      return false
    }
    if (
      form.sendInvitationMail === "yes" &&
      !String(form.profileId ?? "").trim()
    ) {
      setError(
        "Select an investor profile before choosing to send the invitation email.",
      )
      return false
    }
    return true
  }

  async function performSave() {
    setError(null)
    if (!validateInvestmentStep1()) return
    setSubmitting(true)
    try {
      await onSave(
        withInvitationMailPolicy(form, dealBlocksInvitationEmails),
        null,
      )
      if (mode === "add") {
        skipFlushDraftAfterSaveRef.current = true
        backendInvestmentIdRef.current = null
        setBackendInvestmentId(null)
        clearAddMemberDraft(dealId)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save. Try again.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault()
    void performSave()
  }

  type ContactDraftTableRow = {
    id: string
    name: string
    email: string
    phone: string
    status: string
  }

  const handleEditContactDraft = useCallback(() => {
    setAddContactModalOpen(true)
  }, [])

  /** Rows for “All Contacts” draft preview — wire to storage when `contactAddDraft*` exists. */
  const contactDraftTableRows = useMemo((): ContactDraftTableRow[] => [], [])

  const contactDraftColumns = useMemo(
    (): DataTableColumn<ContactDraftTableRow>[] => [
      { id: "name", header: "Name", cell: (r) => r.name },
      { id: "email", header: "Email", cell: (r) => r.email },
      { id: "phone", header: "Phone", cell: (r) => r.phone },
      { id: "status", header: "Status", cell: (r) => r.status },
      {
        id: "actions",
        header: "Actions",
        align: "center",
        cell: () => (
          <button
            type="button"
            className="um_btn_secondary deals_add_inv_draft_edit_btn"
            onClick={handleEditContactDraft}
          >
            <Pencil size={14} strokeWidth={2} aria-hidden />
            Edit
          </button>
        ),
      },
    ],
    [handleEditContactDraft],
  )

  if (!open) return null

  return (
    <>
    <div
      className="um_modal_overlay deals_add_inv_modal_overlay portal_modal_z_boost"
      role="presentation"
    >
      <div
        className="um_modal um_modal_view deals_add_inv_modal_panel add_contact_panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="um_modal_head add_contact_modal_head">
          <div className="add_contact_modal_head_main">
            <h3 id={titleId} className="um_modal_title add_contact_modal_title">
              {mode === "edit"
                ? addEntry === "investor"
                  ? "Edit Investor"
                  : "Edit Member"
                : addEntry === "investor"
                  ? "Add Investor"
                  : "Add Member"}
              {mode === "add" ? (
                <span className="deals_add_inv_autosave_badge" aria-live="polite">
                  {/* Autosave on */}
                </span>
              ) : null}
            </h3>
          </div>
          <button
            type="button"
            className="um_modal_close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <form
          className="deals_add_inv_modal_form"
          onSubmit={handleFormSubmit}
          noValidate
        >
          <div className="deals_add_inv_modal_scroll">
            {error ? (
              <p className="um_msg_error um_modal_form_error" role="alert">
                {error}
              </p>
            ) : null}

            <>
                <div className="add_contact_section">
                  <div className="add_contact_name_grid">
                    <InvFormField
                      id="add-inv-offering"
                      label="Offering"
                      // label="Select offering"
                      Icon={Briefcase}
                      tight
                    >
                      <DropdownSelect
                        id="add-inv-offering"
                        options={offeringOptions.map((o) => ({
                          value: o.value,
                          label: o.label,
                        }))}
                        value={form.offeringId}
                        onChange={(v) => patch({ offeringId: v })}
                        placeholder="Select offering"
                        ariaLabel="Select offering"
                        triggerClassName={DROPDOWN_TRIGGER_PILL}
                      />
                    </InvFormField>

                    <InvFormField
                      id="add-inv-member"
                      label={isInvestorEntry ? "Investor" : "Member"}
                      Icon={UserRound}
                      tight
                      labelSuffix={
                        memberContactSelectLocked ? (
                          <span className="deals_add_inv_field_locked_badge">
                            Read-only
                          </span>
                        ) : null
                      }
                    >
                      <DropdownSelect
                        id="add-inv-member"
                        sections={memberDropdownSections}
                        value={memberSelectValue}
                        disabled={membersLoading || memberContactSelectLocked}
                        onChange={(v) => patchMemberById(v)}
                        placeholder={
                          membersLoading
                            ? isInvestorEntry
                              ? "Loading contacts and directory users…"
                              : "Loading contacts and members…"
                            : isInvestorEntry
                              ? "Select investor or contact"
                              : "Select member or contact"
                        }
                        ariaLabel={
                          isInvestorEntry
                            ? "Investor or contact"
                            : "Member or contact"
                        }
                        header={
                          memberContactSelectLocked
                            ? undefined
                            : {
                                label: "+ Add Contact",
                                onClick: () => setAddContactModalOpen(true),
                              }
                        }
                        triggerClassName={[
                          DROPDOWN_TRIGGER_PILL,
                          memberContactSelectLocked
                            ? "deals_add_inv_field_control_readonly"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      />
                      {memberContactSelectLocked ? (
                        <p className="um_field_hint deals_add_inv_member_readonly_hint" role="note">
                          The Lead Sponsor&apos;s name and email cannot be changed
                          here. Change their role first, or manage members from the
                          deal roster.
                        </p>
                      ) : null}
                    </InvFormField>
                  </div>
                  {contactDraftTableRows.length > 0 ? (
                    <div
                      className="deals_add_inv_draft_table_wrap"
                      aria-labelledby="add-inv-draft-label"
                    >
                      <p
                        className="deals_add_inv_draft_table_label"
                        id="add-inv-draft-label"
                      >
                        Autosaved contact (All Contacts draft)
                      </p>
                      <DataTable<ContactDraftTableRow>
                        visualVariant="members"
                        membersTableClassName="um_table_members deal_inv_table deals_add_inv_draft_table"
                        columns={contactDraftColumns}
                        rows={contactDraftTableRows}
                        getRowKey={(r) => r.id}
                        emptyLabel="No autosaved draft."
                        membersShell="plain"
                        stickyFirstColumn={false}
                      />
                    </div>
                  ) : null}
                </div>

                <hr className="add_contact_section_rule" />

                <div className="add_contact_section">
                  <div className="add_contact_name_grid">
                    <InvFormField
                      id="add-inv-profile"
                      label="Profile"
                      Icon={IdCard}
                      tight
                    >
                      <DropdownSelect
                        id="add-inv-profile"
                        options={INVESTOR_PROFILE_SELECT_OPTIONS.map((o) => ({
                          value: o.value,
                          label: o.label,
                        }))}
                        value={form.profileId}
                        onChange={(v) => patch({ profileId: v })}
                        placeholder="Select profile"
                        ariaLabel="Profile"
                        triggerClassName={DROPDOWN_TRIGGER_PILL}
                        // footer={{
                        //   label: "Clear profile",
                        //   onClick: () => patch({ profileId: "" }),
                        // }}
                      />
                    </InvFormField>

                    <InvFormField
                      id="add-inv-role"
                      label="Role"
                      Icon={Shield}
                      tight
                    >
                      <DropdownSelect
                        id="add-inv-role"
                        options={investorRoleDropdownOptions}
                        value={form.investorRole}
                        onChange={(v) => {
                          if (
                            leadSponsorContactId &&
                            form.contactId.trim() === leadSponsorContactId &&
                            isAdminSponsorOrCoSponsorRole(v)
                          ) {
                            toast.error(
                              "This person is already Lead Sponsor on this deal. They cannot also be Admin sponsor or Co-sponsor.",
                            )
                            return
                          }
                          patch({ investorRole: v })
                        }}
                        placeholder="Select role"
                        ariaLabel="Role"
                        triggerClassName={DROPDOWN_TRIGGER_PILL}
                      />
                      {/* {leadSponsorOptionDisabled ? (
                        <p
                          className="deals_add_inv_role_lead_taken_hint"
                          role="note"
                        >
                          This deal already has a Lead Sponsor. Edit that row to
                          change them, or pick another role for this member.
                        </p>
                      ) : null} */}
                    </InvFormField>
                  </div>

                  <InvFormField id="add-inv-status" label="Status" Icon={Activity}>
                    <DropdownSelect
                      id="add-inv-status"
                      options={INVESTMENT_STATUS_SELECT_OPTIONS.map((o) => ({
                        value: o.value,
                        label: o.label,
                      }))}
                      value={form.status}
                      onChange={(v) => patch({ status: v })}
                      placeholder="Select status"
                      ariaLabel="Status"
                      triggerClassName={DROPDOWN_TRIGGER_PILL}
                    />
                  </InvFormField>

                  <InvFormField
                    id="add-inv-class"
                    label="Investor class"
                    Icon={Tag}
                    labelSuffix={
                      noDealClasses ? (
                        <span className="deals_add_inv_label_info">
                          <InfoIconPanel
                            ariaLabel="More information: Investor class"
                            infoContent={INVESTOR_CLASS_UNAVAILABLE_HINT}
                          />
                        </span>
                      ) : null
                    }
                  >
                    <DropdownSelect
                      id="add-inv-class"
                      options={investorClassOptions.map((o) => ({
                        value: o.value,
                        label: o.label,
                      }))}
                      value={form.investorClass}
                      disabled={
                        !investorClassesReady || dealClasses.length === 0
                      }
                      onChange={(v) => patch({ investorClass: v })}
                      placeholder="Select investor class"
                      ariaLabel="Investor class"
                      ariaDescribedBy={
                        noDealClasses ? "add-inv-class-hint" : undefined
                      }
                      triggerClassName={DROPDOWN_TRIGGER_PILL}
                    />
                    {noDealClasses ? (
                      <p id="add-inv-class-hint" className="visually_hidden">
                        {INVESTOR_CLASS_UNAVAILABLE_HINT}
                      </p>
                    ) : null}
                  </InvFormField>

                  <div className="add_contact_name_grid">
                    <InvFormField
                      id="add-inv-doc-date"
                      label="Doc signed date"
                      Icon={Calendar}
                      tight
                    >
                      <input
                        id="add-inv-doc-date"
                        type="date"
                        className="deals_add_inv_field_pill"
                        value={form.docSignedDate}
                        onChange={(e) =>
                          patch({ docSignedDate: e.target.value })
                        }
                        aria-label="Document signed date"
                      />
                    </InvFormField>

                    <InvFormField
                      id="add-inv-commitment"
                      label="Commitment amount"
                      Icon={DollarSign}
                      tight
                    >
                      <input
                        id="add-inv-commitment"
                        type="text"
                        className="deals_add_inv_field_pill"
                        placeholder="Enter amount"
                        value={form.commitmentAmount}
                        onChange={(e) =>
                          patch({ commitmentAmount: e.target.value })
                        }
                        onBlur={(e) =>
                          patch({
                            commitmentAmount: blurFormatMoneyInput(
                              e.target.value,
                            ),
                          })
                        }
                        aria-label="Commitment amount"
                        inputMode="decimal"
                      />
                    </InvFormField>
                  </div>

                  <div className="um_field">
                    <div
                      className="um_field_label_row"
                      id="add-inv-send-invite-label"
                    >
                      <Mail
                        className="um_field_label_icon"
                        size={17}
                        aria-hidden
                      />
                      <span className="mail_text_label">
                        {isInvestorEntry
                          ? "Would you like to notify the investor about their addition to the deal?"
                          : "Would you like to notify the member about their addition to the deal?"}
                      </span>
                    </div>
                    {dealBlocksInvitationEmails ? (
                      <p className="deals_create_field_hint" role="status">
                        Invitation emails are unavailable while the deal is in
                        draft or required deal details are incomplete. Finalize
                        the deal before sending invitations. You can still choose{" "}
                        <strong>No</strong> below.
                      </p>
                    ) : null}
                    <div
                      className="deal_step_yesno"
                      role="radiogroup"
                      aria-labelledby="add-inv-send-invite-label"
                    >
                      <label className="deal_step_yesno_label">
                        <input
                          type="radio"
                          name="add-inv-send-invitation"
                          value="yes"
                          checked={form.sendInvitationMail === "yes"}
                          disabled={dealBlocksInvitationEmails}
                          title={
                            dealBlocksInvitationEmails
                              ? "Unavailable until the deal is finalized"
                              : undefined
                          }
                          onChange={() => patch({ sendInvitationMail: "yes" })}
                        />
                        <span>Yes</span>
                         <span className="deal_step_yesno_common">
                            {" "}
                            (Standard)
                          </span>
                      </label>
                      <label className="deal_step_yesno_label">
                        <input
                          type="radio"
                          name="add-inv-send-invitation"
                          value="no"
                          checked={form.sendInvitationMail === "no"}
                          onChange={() => patch({ sendInvitationMail: "no" })}
                        />
                        <span>
                          No
                         
                        </span>
                      </label>
                    </div>
                  </div>
{/* 
                  {form.extraContributionAmounts.map((amt, idx) => (
                    <InvFormField
                      key={idx}
                      id={`add-inv-extra-${idx}`}
                      label={`Additional contribution ${idx + 1}`}
                      Icon={DollarSign}
                    >
                      <input
                        id={`add-inv-extra-${idx}`}
                        type="text"
                        className="deals_add_inv_field_pill"
                        placeholder="Enter amount"
                        value={amt}
                        onChange={(e) => {
                          const next = [...form.extraContributionAmounts]
                          next[idx] = e.target.value
                          patch({ extraContributionAmounts: next })
                        }}
                        onBlur={(e) => {
                          const next = [...form.extraContributionAmounts]
                          next[idx] = blurFormatMoneyInput(e.target.value)
                          patch({ extraContributionAmounts: next })
                        }}
                        aria-label={`Additional contribution ${idx + 1}`}
                        inputMode="decimal"
                      />
                    </InvFormField>
                  ))}
                  <div className="deals_add_inv_add_row">
                    <button
                      type="button"
                      className="um_btn_secondary"
                      onClick={handleAddContribution}
                      disabled={submitting}
                    >
                      + Add contribution
                    </button>
                  </div> */}
                </div>
              </>
          </div>

          <div className="um_modal_actions add_contact_modal_actions">
            <button
              type="button"
              className="um_btn_secondary"
              onClick={onClose}
              disabled={submitting}
            >
              <X size={16} strokeWidth={2} aria-hidden />
              Cancel
            </button>
            <div className="add_contact_modal_actions_trailing">
              <button
                type="submit"
                className="um_btn_primary"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2
                      size={16}
                      strokeWidth={2}
                      className="add_contact_modal_btn_spin"
                      aria-hidden
                    />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save size={16} strokeWidth={2} aria-hidden />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
    <AddContactPanel
      open={addContactModalOpen}
      onClose={() => setAddContactModalOpen(false)}
      onSave={handleAddContactSave}
      contactToEdit={null}
      existingContacts={contactRows}
    />
    </>
  )
}
