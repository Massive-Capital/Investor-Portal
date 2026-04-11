import {
  AlertTriangle,
  AlignLeft,
  Archive,
  Ban,
  Check,
  CheckCircle2,
  ClipboardList,
  ContactRound,
  Download,
  Info,
  LayoutList,
  Mail,
  Pencil,
  Plus,
  Search,
  Tag,
  User,
  X,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react"
import { useSearchParams } from "react-router-dom"
import {
  DataTable,
  type DataTableColumn,
} from "../../common/components/data-table/DataTable"
import { toast } from "../../common/components/Toast"
import { ViewReadonlyField } from "../../common/components/ViewReadonlyField"
import "../../modules/usermanagement/user_management.css"
import {
  createContact,
  fetchContacts,
  notifyContactsExportAudit,
  patchContactStatus,
  updateContact,
} from "./api/contactsApi"
import { AddContactPanel } from "./components/AddContactPanel"
import { ContactRowActions } from "./components/ContactRowActions"
import { ExportContactsModal } from "./components/ExportContactsModal"
import { ViewContactModal } from "./components/ViewContactModal"
import "./contacts.css"
import type { ContactRow } from "./types/contact.types"
import {
  buildContactsCsv,
  downloadContactsCsv,
  exportAuditLinesForContacts,
  formatContactSinceLabel,
} from "./utils/contactCsv"

function contactRowIsSuspended(row: ContactRow): boolean {
  return row.status === "suspended"
}

type ContactsListTab = "active" | "archived"

type ContactsMainTab = "contacts" | "tags" | "lists"

type CatalogUsageFilter = "all" | "in_use" | "unused"

type ContactLabelRow = {
  id: string
  name: string
  description: string
}

function newLabelId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `lbl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function toContactUpdatePayload(
  r: ContactRow,
): Omit<ContactRow, "id" | "createdByDisplayName"> {
  return {
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    phone: r.phone,
    note: r.note,
    tags: r.tags,
    lists: r.lists,
    owners: r.owners,
    status: r.status,
    lastEditReason: r.lastEditReason,
  }
}

function contactRowMatchesSearch(row: ContactRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = [
    row.firstName,
    row.lastName,
    row.email,
    row.phone,
    row.note,
    ...row.tags,
    ...row.lists,
    ...row.owners,
    row.createdByDisplayName ?? "",
    String(row.dealCount ?? 0),
  ]
    .map((s) => String(s).toLowerCase())
    .join(" ")
  return hay.includes(q)
}

function initialsFromContact(row: ContactRow): string {
  const first = row.firstName.trim()
  const last = row.lastName.trim()
  if (first && last) {
    return (first[0] + last[0]).toUpperCase()
  }
  if (first.length >= 2) return first.slice(0, 2).toUpperCase()
  const e = row.email.trim()
  if (e.length >= 2) return e.slice(0, 2).toUpperCase()
  return "?"
}

function contactDisplayName(row: ContactRow): string {
  const n = [row.firstName, row.lastName].filter(Boolean).join(" ").trim()
  return n || "—"
}

function TagsCell({ items }: { items: string[] }) {
  if (!items.length)
    return <span className="um_status_muted">—</span>
  return (
    <div className="contacts_cell_chips">
      {items.map((t, i) => (
        <span key={`${t}-${i}`} className="contacts_cell_chip" title={t}>
          {t}
        </span>
      ))}
    </div>
  )
}

function ContactsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [rows, setRows] = useState<ContactRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [contactToEdit, setContactToEdit] = useState<ContactRow | null>(null)
  const [viewContactId, setViewContactId] = useState<string | null>(null)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [searchQuery, setSearchQuery] = useState("")
  const [toolbarNotice, setToolbarNotice] = useState("")
  const [suspendRow, setSuspendRow] = useState<ContactRow | null>(null)
  const [suspendReason, setSuspendReason] = useState("")
  const [suspendSaving, setSuspendSaving] = useState(false)
  const [suspendErr, setSuspendErr] = useState("")
  const [contactsListTab, setContactsListTab] =
    useState<ContactsListTab>("active")
  const [mainTab, setMainTab] = useState<ContactsMainTab>("contacts")
  const [tagCatalog, setTagCatalog] = useState<ContactLabelRow[]>([])
  const [listCatalog, setListCatalog] = useState<ContactLabelRow[]>([])
  const [tagsSearchQuery, setTagsSearchQuery] = useState("")
  const [listsSearchQuery, setListsSearchQuery] = useState("")
  const [tagsPage, setTagsPage] = useState(1)
  const [tagsPageSize, setTagsPageSize] = useState(10)
  const [listsPage, setListsPage] = useState(1)
  const [listsPageSize, setListsPageSize] = useState(10)
  const [tagsUsageFilter, setTagsUsageFilter] =
    useState<CatalogUsageFilter>("all")
  const [listsUsageFilter, setListsUsageFilter] =
    useState<CatalogUsageFilter>("all")
  const [labelModal, setLabelModal] = useState<
    | { kind: "tag"; mode: "add" }
    | { kind: "tag"; mode: "edit"; row: ContactLabelRow }
    | { kind: "list"; mode: "add" }
    | { kind: "list"; mode: "edit"; row: ContactLabelRow }
    | null
  >(null)
  const [labelModalName, setLabelModalName] = useState("")
  const [labelModalDesc, setLabelModalDesc] = useState("")
  const [labelModalErr, setLabelModalErr] = useState("")
  const [labelModalBusy, setLabelModalBusy] = useState(false)

  useEffect(() => {
    setTagCatalog((prev) => {
      const byLower = new Map<string, ContactLabelRow>()
      for (const r of prev) {
        byLower.set(r.name.toLowerCase(), r)
      }
      for (const c of rows) {
        for (const t of c.tags) {
          const trimmed = t.trim()
          if (!trimmed) continue
          const lk = trimmed.toLowerCase()
          if (!byLower.has(lk)) {
            byLower.set(lk, {
              id: newLabelId(),
              name: trimmed,
              description: "",
            })
          }
        }
      }
      return Array.from(byLower.values()).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      )
    })
  }, [rows])

  useEffect(() => {
    setListCatalog((prev) => {
      const byLower = new Map<string, ContactLabelRow>()
      for (const r of prev) {
        byLower.set(r.name.toLowerCase(), r)
      }
      for (const c of rows) {
        for (const t of c.lists) {
          const trimmed = t.trim()
          if (!trimmed) continue
          const lk = trimmed.toLowerCase()
          if (!byLower.has(lk)) {
            byLower.set(lk, {
              id: newLabelId(),
              name: trimmed,
              description: "",
            })
          }
        }
      }
      return Array.from(byLower.values()).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      )
    })
  }, [rows])

  const tabRows = useMemo(
    () =>
      rows.filter((r) =>
        contactsListTab === "archived"
          ? contactRowIsSuspended(r)
          : !contactRowIsSuspended(r),
      ),
    [rows, contactsListTab],
  )

  const activeCount = useMemo(
    () => rows.filter((r) => !contactRowIsSuspended(r)).length,
    [rows],
  )

  const archivedCount = useMemo(
    () => rows.filter((r) => contactRowIsSuspended(r)).length,
    [rows],
  )

  const filteredRows = useMemo(
    () => tabRows.filter((r) => contactRowMatchesSearch(r, searchQuery)),
    [tabRows, searchQuery],
  )

  const loadContacts = useCallback(async () => {
    setLoading(true)
    const list = await fetchContacts()
    setRows(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadContacts()
  }, [loadContacts])

  useEffect(() => {
    if (searchParams.get("addContact") !== "1") return
    setViewContactId(null)
    setContactToEdit(null)
    setAddOpen(true)
    const next = new URLSearchParams(searchParams)
    next.delete("addContact")
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  function handleSuspendAll() {
    setToolbarNotice("Bulk suspend is not available yet.")
  }

  async function handleSave(contact: Omit<ContactRow, "id" | "createdByDisplayName">) {
    const created = await createContact(contact)
    setRows((prev) => [created, ...prev])
  }

  const handleUpdate = useCallback(
    async (
      id: string,
      contact: Omit<ContactRow, "id" | "createdByDisplayName">,
      editReason: string,
    ) => {
      const updated = await updateContact(id, contact, editReason)
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)))
    },
    [],
  )

  const openAddPanel = useCallback(() => {
    setViewContactId(null)
    setContactToEdit(null)
    setAddOpen(true)
  }, [])

  const openEditPanel = useCallback((row: ContactRow) => {
    setViewContactId(null)
    setContactToEdit(row)
    setAddOpen(true)
  }, [])

  const viewContact = useMemo(
    () =>
      viewContactId ? rows.find((r) => r.id === viewContactId) ?? null : null,
    [rows, viewContactId],
  )

  useEffect(() => {
    if (viewContactId && !rows.some((r) => r.id === viewContactId)) {
      setViewContactId(null)
    }
  }, [rows, viewContactId])

  const openViewPanel = useCallback((row: ContactRow) => {
    setViewContactId(row.id)
  }, [])

  const openSuspendContact = useCallback((row: ContactRow) => {
    setSuspendRow(row)
    setSuspendReason("")
    setSuspendErr("")
  }, [])

  const closeSuspendContact = useCallback(() => {
    setSuspendRow(null)
    setSuspendReason("")
    setSuspendErr("")
  }, [])

  const exportContactRow = useCallback((row: ContactRow) => {
    const csv = buildContactsCsv([row])
    const safe = String(row.email || row.id || "contact").replace(
      /[^\w.-]+/g,
      "_",
    )
    const filename = `contact-${safe}.csv`
    downloadContactsCsv(csv, filename)
    void notifyContactsExportAudit({
      rowCount: 1,
      exportedContactLines: exportAuditLinesForContacts([row]),
    })
    toast.success("Contact exported", `Saved as ${filename}`)
  }, [])

  const submitSuspendContact = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (!suspendRow) return
      const activating = contactRowIsSuspended(suspendRow)
      const reason = suspendReason.trim()
      if (!activating && !reason) {
        setSuspendErr("Please enter a reason for suspending this contact.")
        return
      }
      setSuspendSaving(true)
      setSuspendErr("")
      try {
        const nextStatus = activating ? "active" : "suspended"
        const updated = await patchContactStatus(suspendRow.id, nextStatus)
        setRows((prev) =>
          prev.map((r) => (r.id === updated.id ? updated : r)),
        )
        toast.success(
          activating ? "Contact activated" : "Contact suspended",
          activating
            ? "This contact is active again."
            : "This contact is suspended.",
        )
        closeSuspendContact()
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Could not update contact."
        setSuspendErr(msg)
        toast.error(
          activating ? "Could not activate contact" : "Could not suspend contact",
          msg,
        )
      } finally {
        setSuspendSaving(false)
      }
    },
    [suspendRow, suspendReason, closeSuspendContact],
  )

  const openEditFromView = useCallback(() => {
    if (!viewContactId) return
    const row = rows.find((r) => r.id === viewContactId)
    setViewContactId(null)
    if (row) {
      setContactToEdit(row)
      setAddOpen(true)
    }
  }, [viewContactId, rows])

  const pagination = useMemo(
    () => ({
      page,
      pageSize,
      totalItems: filteredRows.length,
      onPageChange: setPage,
      onPageSizeChange: setPageSize,
      ariaLabel:
        contactsListTab === "archived"
          ? "Archived contacts table pagination"
          : "Active contacts table pagination",
    }),
    [page, pageSize, filteredRows.length, contactsListTab],
  )

  const tagCountInUse = useMemo(
    () =>
      tagCatalog.filter(
        (t) => rows.filter((c) => c.tags.includes(t.name)).length > 0,
      ).length,
    [tagCatalog, rows],
  )
  const tagCountUnused = tagCatalog.length - tagCountInUse

  const listCountInUse = useMemo(
    () =>
      listCatalog.filter(
        (t) => rows.filter((c) => c.lists.includes(t.name)).length > 0,
      ).length,
    [listCatalog, rows],
  )
  const listCountUnused = listCatalog.length - listCountInUse

  const tagCatalogUsageFiltered = useMemo(() => {
    if (tagsUsageFilter === "all") return tagCatalog
    return tagCatalog.filter((t) => {
      const n = rows.filter((c) => c.tags.includes(t.name)).length
      return tagsUsageFilter === "in_use" ? n > 0 : n === 0
    })
  }, [tagCatalog, rows, tagsUsageFilter])

  const listCatalogUsageFiltered = useMemo(() => {
    if (listsUsageFilter === "all") return listCatalog
    return listCatalog.filter((t) => {
      const n = rows.filter((c) => c.lists.includes(t.name)).length
      return listsUsageFilter === "in_use" ? n > 0 : n === 0
    })
  }, [listCatalog, rows, listsUsageFilter])

  const filteredTagCatalogRows = useMemo(() => {
    const q = tagsSearchQuery.trim().toLowerCase()
    if (!q) return tagCatalogUsageFiltered
    return tagCatalogUsageFiltered.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    )
  }, [tagCatalogUsageFiltered, tagsSearchQuery])

  const filteredListCatalogRows = useMemo(() => {
    const q = listsSearchQuery.trim().toLowerCase()
    if (!q) return listCatalogUsageFiltered
    return listCatalogUsageFiltered.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    )
  }, [listCatalogUsageFiltered, listsSearchQuery])

  useEffect(() => {
    setTagsPage(1)
  }, [tagsSearchQuery, tagsUsageFilter])

  useEffect(() => {
    setListsPage(1)
  }, [listsSearchQuery, listsUsageFilter])

  useEffect(() => {
    const total = Math.max(
      1,
      Math.ceil(filteredTagCatalogRows.length / tagsPageSize),
    )
    if (tagsPage > total) setTagsPage(total)
  }, [filteredTagCatalogRows.length, tagsPage, tagsPageSize])

  useEffect(() => {
    const total = Math.max(
      1,
      Math.ceil(filteredListCatalogRows.length / listsPageSize),
    )
    if (listsPage > total) setListsPage(total)
  }, [filteredListCatalogRows.length, listsPage, listsPageSize])

  const tagsPagination = useMemo(
    () => ({
      page: tagsPage,
      pageSize: tagsPageSize,
      totalItems: filteredTagCatalogRows.length,
      onPageChange: setTagsPage,
      onPageSizeChange: setTagsPageSize,
      ariaLabel: "Tags table pagination",
    }),
    [tagsPage, tagsPageSize, filteredTagCatalogRows.length],
  )

  const listsPagination = useMemo(
    () => ({
      page: listsPage,
      pageSize: listsPageSize,
      totalItems: filteredListCatalogRows.length,
      onPageChange: setListsPage,
      onPageSizeChange: setListsPageSize,
      ariaLabel: "Lists table pagination",
    }),
    [listsPage, listsPageSize, filteredListCatalogRows.length],
  )

  const catalogTagNames = useMemo(
    () => tagCatalog.map((t) => t.name.trim()).filter(Boolean),
    [tagCatalog],
  )
  const catalogListNames = useMemo(
    () => listCatalog.map((t) => t.name.trim()).filter(Boolean),
    [listCatalog],
  )

  function openLabelAdd(kind: "tag" | "list") {
    setLabelModalErr("")
    setLabelModalName("")
    setLabelModalDesc("")
    setLabelModal({ kind, mode: "add" })
  }

  function openLabelEdit(kind: "tag" | "list", row: ContactLabelRow) {
    setLabelModalErr("")
    setLabelModalName(row.name)
    setLabelModalDesc(row.description)
    setLabelModal({ kind, mode: "edit", row })
  }

  function closeLabelModal() {
    if (labelModalBusy) return
    setLabelModal(null)
    setLabelModalErr("")
  }

  const submitLabelModal = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (!labelModal) return
      const nameTrim = labelModalName.trim()
      const descTrim = labelModalDesc.trim()
      if (!nameTrim) {
        setLabelModalErr("Name is required.")
        return
      }
      const catalog = labelModal.kind === "tag" ? tagCatalog : listCatalog
      const setCatalog = labelModal.kind === "tag" ? setTagCatalog : setListCatalog
      const dup = catalog.some(
        (x) =>
          x.name.toLowerCase() === nameTrim.toLowerCase() &&
          (labelModal.mode === "add" || x.id !== labelModal.row.id),
      )
      if (dup) {
        setLabelModalErr(
          `A ${labelModal.kind === "tag" ? "tag" : "list"} with this name already exists.`,
        )
        return
      }
      if (labelModal.mode === "add") {
        setCatalog((prev) =>
          [...prev, { id: newLabelId(), name: nameTrim, description: descTrim }].sort(
            (a, b) =>
              a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
          ),
        )
        toast.success(
          labelModal.kind === "tag" ? "Tag added" : "List added",
          `${nameTrim} is available when editing contacts.`,
        )
        setLabelModal(null)
        return
      }
      const prevRow = labelModal.row
      const field = labelModal.kind === "tag" ? "tags" : "lists"
      const oldName = prevRow.name
      if (nameTrim === oldName && descTrim === prevRow.description.trim()) {
        setLabelModal(null)
        return
      }
      if (nameTrim !== oldName) {
        const affected = rows.filter((r) =>
          field === "tags"
            ? r.tags.includes(oldName)
            : r.lists.includes(oldName),
        )
        if (affected.length === 0) {
          setCatalog((prev) =>
            prev.map((x) =>
              x.id === prevRow.id
                ? { ...x, name: nameTrim, description: descTrim }
                : x,
            ),
          )
          toast.success(
            labelModal.kind === "tag" ? "Tag updated" : "List updated",
            "Saved.",
          )
          setLabelModal(null)
          return
        }
        setLabelModalBusy(true)
        setLabelModalErr("")
        try {
          for (const r of affected) {
            const nextTagsOrLists =
              field === "tags"
                ? r.tags.map((t) => (t === oldName ? nameTrim : t))
                : r.lists.map((t) => (t === oldName ? nameTrim : t))
            const payload =
              field === "tags"
                ? { ...toContactUpdatePayload(r), tags: nextTagsOrLists }
                : { ...toContactUpdatePayload(r), lists: nextTagsOrLists }
            const updated = await updateContact(
              r.id,
              payload,
              labelModal.kind === "tag"
                ? "Contact tag renamed"
                : "Contact list renamed",
            )
            setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
          }
          setCatalog((prev) =>
            prev.map((x) =>
              x.id === prevRow.id
                ? { ...x, name: nameTrim, description: descTrim }
                : x,
            ),
          )
          toast.success(
            labelModal.kind === "tag" ? "Tag updated" : "List updated",
            `Renamed on ${affected.length} contact${affected.length === 1 ? "" : "s"}.`,
          )
          setLabelModal(null)
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : "Could not update contacts."
          setLabelModalErr(msg)
          toast.error("Update failed", msg)
        } finally {
          setLabelModalBusy(false)
        }
        return
      }
      setCatalog((prev) =>
        prev.map((x) =>
          x.id === prevRow.id ? { ...x, description: descTrim } : x,
        ),
      )
      toast.success(
        labelModal.kind === "tag" ? "Tag updated" : "List updated",
        "Saved.",
      )
      setLabelModal(null)
    },
    [
      labelModal,
      labelModalName,
      labelModalDesc,
      rows,
      tagCatalog,
      listCatalog,
    ],
  )

  const tagColumns: DataTableColumn<ContactLabelRow>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Name",
        sortValue: (r) => r.name.toLowerCase(),
        cell: (r) => r.name,
      },
      {
        id: "description",
        header: "Description",
        sortValue: (r) => r.description.toLowerCase(),
        cell: (r) => (r.description.trim() ? r.description : "—"),
      },
      {
        id: "contacts",
        header: "Contacts",
        align: "center",
        sortValue: (r) => rows.filter((c) => c.tags.includes(r.name)).length,
        cell: (r) => rows.filter((c) => c.tags.includes(r.name)).length,
      },
      {
        id: "actions",
        header: "Actions",
        align: "center",
        thClassName: "um_th_actions contacts_th_actions_catalog",
        tdClassName: "um_td_actions contacts_td_actions_catalog",
        cell: (r) => (
          <button
            type="button"
            className="contacts_catalog_row_action_btn"
            aria-label={`Edit tag “${r.name}”`}
            onClick={() => openLabelEdit("tag", r)}
          >
            <Pencil size={17} strokeWidth={2} aria-hidden />
          </button>
        ),
      },
    ],
    [rows],
  )

  const listColumns: DataTableColumn<ContactLabelRow>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Name",
        sortValue: (r) => r.name.toLowerCase(),
        cell: (r) => r.name,
      },
      {
        id: "description",
        header: "Description",
        sortValue: (r) => r.description.toLowerCase(),
        cell: (r) => (r.description.trim() ? r.description : "—"),
      },
      {
        id: "contacts",
        header: "Contacts",
        align: "center",
        sortValue: (r) => rows.filter((c) => c.lists.includes(r.name)).length,
        cell: (r) => rows.filter((c) => c.lists.includes(r.name)).length,
      },
      {
        id: "actions",
        header: "Actions",
        align: "center",
        thClassName: "um_th_actions contacts_th_actions_catalog",
        tdClassName: "um_td_actions contacts_td_actions_catalog",
        cell: (r) => (
          <button
            type="button"
            className="contacts_catalog_row_action_btn"
            aria-label={`Edit list “${r.name}”`}
            onClick={() => openLabelEdit("list", r)}
          >
            <Pencil size={17} strokeWidth={2} aria-hidden />
          </button>
        ),
      },
    ],
    [rows],
  )

  const columns: DataTableColumn<ContactRow>[] = useMemo(
    () => [
      {
        id: "user",
        header: "User",
        sortValue: (row) =>
          `${row.firstName} ${row.lastName} ${row.email}`.toLowerCase(),
        tdClassName: "um_td_user",
        cell: (row) => {
          const primary = contactDisplayName(row)
          const rawEmail = row.email.trim()
          const emailShown = rawEmail || "—"
          return (
            <div className="um_user_cell">
              <div className="um_user_avatar_ring" aria-hidden>
                <span className="um_user_initials">
                  {initialsFromContact(row)}
                </span>
              </div>
              <div className="um_user_meta">
                <span
                  className={`um_user_meta_username${
                    primary === "—" ? " um_user_meta_username--placeholder" : ""
                  }`}
                >
                  {primary}
                </span>
                {rawEmail.includes("@") ? (
                  <a
                    href={`mailto:${encodeURIComponent(rawEmail)}`}
                    className="um_user_meta_email um_user_meta_email_link"
                  >
                    {rawEmail}
                  </a>
                ) : (
                  <span className="um_user_meta_email">{emailShown}</span>
                )}
                {/* {dealN > 0 ? (
                  <span
                    className="contacts_user_deal_line"
                    title="Add Investment rows in deal_investment where contact_id is this contact (same count as Deals column)."
                  >
                    {dealN} investment{dealN === 1 ? "" : "s"}
                  </span>
                ) : null} */}
              </div>
            </div>
          )
        },
      },
      {
        id: "deals",
        header: "Deals",
        align: "center",
        thClassName: "contacts_th_deals_count",
        tdClassName: "contacts_td_deals_count",
        sortValue: (row) => row.dealCount ?? 0,
        cell: (row) => {
          const n = row.dealCount ?? 0
          if (n <= 0) {
            return (
              <span className="contacts_deals_count_num contacts_deals_count_num--empty">
                0
              </span>
            )
          }
          return (
            <span
              className="contacts_deals_count_num contacts_deals_count_num--value"
              // title="Count of deal_investment rows with contact_id = this contact (your visible deals only)."
            >
              {n}
            </span>
          )
        },
      },
      {
        id: "phone",
        header: "Phone",
        sortValue: (row) => row.phone ?? "",
        cell: (row) => row.phone || "—",
      },
      // {
      //   id: "note",
      //   header: "Note",
      //   sortValue: (row) => row.note ?? "",
      //   cell: (row) => (
      //     <span title={row.note || undefined}>
      //       {row.note ? row.note : "—"}
      //     </span>
      //   ),
      // },
      /* Hidden: Contact tags & Lists columns (restore by uncommenting)
      {
        id: "tags",
        header: "Contact tags",
        sortValue: (row) => row.tags.join(" "),
        cell: (row) => <TagsCell items={row.tags} />,
      },
      {
        id: "lists",
        header: "Lists",
        sortValue: (row) => row.lists.join(" "),
        cell: (row) => (
          <span>{row.lists.length ? row.lists.join(", ") : "—"}</span>
        ),
      },
      */
      {
        id: "owners",
        header: "Owners",
        sortValue: (row) => row.owners.join(" "),
        cell: (row) => <TagsCell items={row.owners} />,
      },
      {
        id: "createdBy",
        header: "Added by",
        sortValue: (row) => row.createdByDisplayName ?? "",
        cell: (row) => row.createdByDisplayName?.trim() || "—",
      },
      {
        id: "since",
        header: "Since",
        sortValue: (row) => {
          const t = row.createdAt
            ? new Date(row.createdAt).getTime()
            : NaN
          return Number.isFinite(t) ? t : 0
        },
        cell: (row) => (
          <span title={row.createdAt}>{formatContactSinceLabel(row.createdAt)}</span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        align: "center",
        thClassName: "um_th_actions contacts_th_actions_directory",
        tdClassName: "um_td_actions contacts_td_actions_directory",
        cell: (row) => (
          <ContactRowActions
            contactLabel={
              [row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
              row.email ||
              "Contact"
            }
            isSuspended={contactRowIsSuspended(row)}
            onView={() => openViewPanel(row)}
            onEdit={
              contactsListTab === "archived"
                ? undefined
                : () => openEditPanel(row)
            }
            onSuspend={() => openSuspendContact(row)}
            onExport={() => exportContactRow(row)}
          />
        ),
      },
    ],
    [
      contactsListTab,
      exportContactRow,
      openEditPanel,
      openSuspendContact,
      openViewPanel,
    ],
  )

  useEffect(() => {
    setPage(1)
  }, [searchQuery, contactsListTab])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
    if (page > totalPages) setPage(totalPages)
  }, [filteredRows.length, page, pageSize])

  const archivedTabEmptyNoTable =
    contactsListTab === "archived" && tabRows.length === 0

  const tagsTableEmptyLabel = useMemo(() => {
    if (tagCatalog.length === 0) {
      return "No tags yet. Add a tag or assign tags on a contact."
    }
    if (tagCatalogUsageFiltered.length === 0) {
      if (tagsUsageFilter === "in_use") {
        return "No tags are used on any contact yet."
      }
      if (tagsUsageFilter === "unused") {
        return "No unused tags."
      }
    }
    return "No tags match your search or filter."
  }, [
    tagCatalog.length,
    tagCatalogUsageFiltered.length,
    tagsUsageFilter,
  ])

  const listsTableEmptyLabel = useMemo(() => {
    if (listCatalog.length === 0) {
      return "No lists yet. Add a list or assign lists on a contact."
    }
    if (listCatalogUsageFiltered.length === 0) {
      if (listsUsageFilter === "in_use") {
        return "No lists are used on any contact yet."
      }
      if (listsUsageFilter === "unused") {
        return "No unused lists."
      }
    }
    return "No lists match your search or filter."
  }, [
    listCatalog.length,
    listCatalogUsageFiltered.length,
    listsUsageFilter,
  ])

  return (
    <section className="um_page contacts_page">
      <div className="um_members_header_block">
        <div className="um_header_row">
          <h2 className="um_title um_title_with_icon">
            <ContactRound
              className="um_title_icon"
              size={26}
              strokeWidth={1.75}
              aria-hidden
            />
            Contacts
          </h2>
        </div>
      </div>

      <div className="um_members_tabs_outer contacts_main_tabs_outer">
        <div
          className="um_members_tabs_row"
          role="tablist"
          aria-label="Contacts, tags, and lists"
        >
          <button
            type="button"
            id="contacts-main-tab-contacts"
            role="tab"
            aria-selected={mainTab === "contacts"}
            aria-controls="contacts-main-panel-contacts"
            className={`um_members_tab${
              mainTab === "contacts" ? " um_members_tab_active" : ""
            }`}
            onClick={() => {
              setMainTab("contacts")
              setToolbarNotice("")
            }}
          >
            <ContactRound size={18} strokeWidth={1.75} aria-hidden />
            <span>Contact</span>
          </button>
          <button
            type="button"
            id="contacts-main-tab-tags"
            role="tab"
            aria-selected={mainTab === "tags"}
            aria-controls="contacts-main-panel-tags"
            className={`um_members_tab${
              mainTab === "tags" ? " um_members_tab_active" : ""
            }`}
            onClick={() => {
              setMainTab("tags")
              setToolbarNotice("")
            }}
          >
            <Tag size={18} strokeWidth={1.75} aria-hidden />
            <span>Tags</span>
          </button>
          <button
            type="button"
            id="contacts-main-tab-lists"
            role="tab"
            aria-selected={mainTab === "lists"}
            aria-controls="contacts-main-panel-lists"
            className={`um_members_tab${
              mainTab === "lists" ? " um_members_tab_active" : ""
            }`}
            onClick={() => {
              setMainTab("lists")
              setToolbarNotice("")
            }}
          >
            <LayoutList size={18} strokeWidth={1.75} aria-hidden />
            <span>Lists</span>
          </button>
        </div>
      </div>

      {mainTab === "contacts" ? (
        <>
          <div className="um_members_header_block contacts_inner_header">
            <div className="contacts_toolbar_filters_row">
              <div
                className="contacts_filter_button_group"
                role="group"
                aria-label="Filter contacts by status"
              >
                <button
                  type="button"
                  id="contacts-filter-active"
                  aria-pressed={contactsListTab === "active"}
                  className={`contacts_filter_btn${
                    contactsListTab === "active"
                      ? " contacts_filter_btn_active"
                      : ""
                  }`}
                  onClick={() => {
                    setContactsListTab("active")
                    setToolbarNotice("")
                  }}
                >
                  <ContactRound size={16} strokeWidth={1.75} aria-hidden />
                  <span>Active</span>
                  <span className="contacts_filter_btn_count">
                    ({activeCount})
                  </span>
                </button>
                <button
                  type="button"
                  id="contacts-filter-archived"
                  aria-pressed={contactsListTab === "archived"}
                  className={`contacts_filter_btn${
                    contactsListTab === "archived"
                      ? " contacts_filter_btn_active"
                      : ""
                  }`}
                  onClick={() => {
                    setContactsListTab("archived")
                    setToolbarNotice("")
                  }}
                >
                  <Archive size={16} strokeWidth={1.75} aria-hidden />
                  <span>Archived</span>
                  <span className="contacts_filter_btn_count">
                    ({archivedCount})
                  </span>
                </button>
              </div>
              <button
                type="button"
                className="um_btn_primary contacts_toolbar_add_btn"
                onClick={openAddPanel}
              >
                <Plus size={18} strokeWidth={2} aria-hidden />
                Add Contact
              </button>
            </div>
          </div>

      <div
        id="contacts-main-panel-contacts"
        role="tabpanel"
        aria-labelledby="contacts-main-tab-contacts"
        className="contacts_main_tab_panel_wrap"
      >
      <div className="um_members_tab_content contacts_main_tab_content_flush">
        <div
          className="um_panel um_members_tab_panel contacts_table_panel"
          id="contacts-directory-panel"
          role="region"
          aria-label={
            contactsListTab === "archived"
              ? "Archived contacts"
              : "Active contacts"
          }
        >
          {archivedTabEmptyNoTable ? (
            loading ? (
              <p className="um_hint" role="status">
                Loading contacts…
              </p>
            ) : (
              <p className="um_hint" role="status">
                No archived contacts. Suspend a contact from Active to move it
                here.
              </p>
            )
          ) : (
            <>
              <div className="um_toolbar">
                <div className="um_search_wrap">
                  <Search className="um_search_icon" size={18} aria-hidden />
                  <input
                    type="search"
                    className="um_search_input"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setToolbarNotice("")
                    }}
                    aria-label={
                      contactsListTab === "archived"
                        ? "Search archived contacts"
                        : "Search active contacts"
                    }
                    disabled={loading}
                  />
                </div>
                <div className="um_toolbar_actions">
                  <button
                    type="button"
                    className="um_btn_toolbar"
                    onClick={handleSuspendAll}
                    disabled={
                      loading ||
                      contactsListTab === "archived" ||
                      tabRows.length === 0
                    }
                  >
                    <Ban size={18} strokeWidth={2} aria-hidden />
                    Suspend All
                  </button>
                  <button
                    type="button"
                    className="um_toolbar_export_btn"
                    onClick={() => setExportModalOpen(true)}
                    disabled={loading || tabRows.length === 0}
                  >
                    <Download size={18} strokeWidth={2} aria-hidden />
                    <span>
                      {contactsListTab === "archived"
                        ? "Export archived"
                        : "Export all contacts"}
                    </span>
                  </button>
                </div>
              </div>
              {toolbarNotice ? (
                <p className="um_toolbar_notice" role="status">
                  {toolbarNotice}
                </p>
              ) : null}
              <DataTable
                visualVariant="members"
                membersShell="plain"
                stickyFirstColumn={false}
                membersTableClassName="um_table_members contacts_um_table"
                columns={columns}
                rows={loading ? [] : filteredRows}
                getRowKey={(row) => row.id}
                getRowClassName={(row) =>
                  contactsListTab === "active" && contactRowIsSuspended(row)
                    ? "contacts_row_suspended"
                    : undefined
                }
                emptyLabel={
                  loading
                    ? "Loading contacts…"
                    : rows.length === 0
                      ? "No contacts yet. Add a contact to see it here."
                      : tabRows.length === 0
                        ? "No active contacts."
                        : "No contacts match your search."
                }
                emptyStateRole={loading ? "status" : undefined}
                pagination={
                  !loading && filteredRows.length > 0 ? pagination : undefined
                }
              />
            </>
          )}
        </div>
      </div>
      </div>
        </>
      ) : mainTab === "tags" ? (
        <>
          <div className="um_members_header_block contacts_inner_header">
            <div className="contacts_toolbar_filters_row">
              <div
                className="contacts_filter_button_group"
                role="group"
                aria-label="Filter tags by usage"
              >
                <button
                  type="button"
                  aria-pressed={tagsUsageFilter === "all"}
                  className={`contacts_filter_btn${
                    tagsUsageFilter === "all" ? " contacts_filter_btn_active" : ""
                  }`}
                  onClick={() => setTagsUsageFilter("all")}
                >
                  <span>All</span>
                  <span className="contacts_filter_btn_count">
                    ({tagCatalog.length})
                  </span>
                </button>
                <button
                  type="button"
                  aria-pressed={tagsUsageFilter === "in_use"}
                  className={`contacts_filter_btn${
                    tagsUsageFilter === "in_use"
                      ? " contacts_filter_btn_active"
                      : ""
                  }`}
                  onClick={() => setTagsUsageFilter("in_use")}
                >
                  <span>In use</span>
                  <span className="contacts_filter_btn_count">
                    ({tagCountInUse})
                  </span>
                </button>
                <button
                  type="button"
                  aria-pressed={tagsUsageFilter === "unused"}
                  className={`contacts_filter_btn${
                    tagsUsageFilter === "unused"
                      ? " contacts_filter_btn_active"
                      : ""
                  }`}
                  onClick={() => setTagsUsageFilter("unused")}
                >
                  <span>Unused</span>
                  <span className="contacts_filter_btn_count">
                    ({tagCountUnused})
                  </span>
                </button>
              </div>
              <button
                type="button"
                className="um_btn_primary contacts_toolbar_add_btn"
                onClick={() => openLabelAdd("tag")}
              >
                <Plus size={18} strokeWidth={2} aria-hidden />
                Add Tags
              </button>
            </div>
          </div>
          <div
            className="um_members_tab_content contacts_main_tab_content_flush"
            id="contacts-main-panel-tags"
            role="tabpanel"
            aria-labelledby="contacts-main-tab-tags"
          >
            <div className="um_panel um_members_tab_panel contacts_table_panel">
              <div className="um_toolbar contacts_labels_panel_toolbar">
                <div className="um_search_wrap">
                  <Search className="um_search_icon" size={18} aria-hidden />
                  <input
                    type="search"
                    className="um_search_input"
                    placeholder="Search tags"
                    value={tagsSearchQuery}
                    onChange={(e) => setTagsSearchQuery(e.target.value)}
                    aria-label="Search tags"
                  />
                </div>
              </div>
              <DataTable
                visualVariant="members"
                membersShell="plain"
                stickyFirstColumn={false}
                membersTableClassName="um_table_members contacts_um_table contacts_um_table_labels"
                columns={tagColumns}
                rows={filteredTagCatalogRows}
                getRowKey={(r) => r.id}
                emptyLabel={tagsTableEmptyLabel}
                pagination={
                  filteredTagCatalogRows.length > 0
                    ? tagsPagination
                    : undefined
                }
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="um_members_header_block contacts_inner_header">
            <div className="contacts_toolbar_filters_row">
              <div
                className="contacts_filter_button_group"
                role="group"
                aria-label="Filter lists by usage"
              >
                <button
                  type="button"
                  aria-pressed={listsUsageFilter === "all"}
                  className={`contacts_filter_btn${
                    listsUsageFilter === "all"
                      ? " contacts_filter_btn_active"
                      : ""
                  }`}
                  onClick={() => setListsUsageFilter("all")}
                >
                  <span>All</span>
                  <span className="contacts_filter_btn_count">
                    ({listCatalog.length})
                  </span>
                </button>
                <button
                  type="button"
                  aria-pressed={listsUsageFilter === "in_use"}
                  className={`contacts_filter_btn${
                    listsUsageFilter === "in_use"
                      ? " contacts_filter_btn_active"
                      : ""
                  }`}
                  onClick={() => setListsUsageFilter("in_use")}
                >
                  <span>In use</span>
                  <span className="contacts_filter_btn_count">
                    ({listCountInUse})
                  </span>
                </button>
                <button
                  type="button"
                  aria-pressed={listsUsageFilter === "unused"}
                  className={`contacts_filter_btn${
                    listsUsageFilter === "unused"
                      ? " contacts_filter_btn_active"
                      : ""
                  }`}
                  onClick={() => setListsUsageFilter("unused")}
                >
                  <span>Unused</span>
                  <span className="contacts_filter_btn_count">
                    ({listCountUnused})
                  </span>
                </button>
              </div>
              <button
                type="button"
                className="um_btn_primary contacts_toolbar_add_btn"
                onClick={() => openLabelAdd("list")}
              >
                <Plus size={18} strokeWidth={2} aria-hidden />
                Add Lists
              </button>
            </div>
          </div>
          <div
            className="um_members_tab_content contacts_main_tab_content_flush"
            id="contacts-main-panel-lists"
            role="tabpanel"
            aria-labelledby="contacts-main-tab-lists"
          >
            <div className="um_panel um_members_tab_panel contacts_table_panel">
              <div className="um_toolbar contacts_labels_panel_toolbar">
                <div className="um_search_wrap">
                  <Search className="um_search_icon" size={18} aria-hidden />
                  <input
                    type="search"
                    className="um_search_input"
                    placeholder="Search lists"
                    value={listsSearchQuery}
                    onChange={(e) => setListsSearchQuery(e.target.value)}
                    aria-label="Search lists"
                  />
                </div>
              </div>
              <DataTable
                visualVariant="members"
                membersShell="plain"
                stickyFirstColumn={false}
                membersTableClassName="um_table_members contacts_um_table contacts_um_table_labels"
                columns={listColumns}
                rows={filteredListCatalogRows}
                getRowKey={(r) => r.id}
                emptyLabel={listsTableEmptyLabel}
                pagination={
                  filteredListCatalogRows.length > 0
                    ? listsPagination
                    : undefined
                }
              />
            </div>
          </div>
        </>
      )}

      {labelModal ? (
        <div
          className="um_modal_overlay contacts_label_modal_overlay"
          role="presentation"
        >
          <div
            className="um_modal contacts_label_modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contacts-label-modal-title"
          >
            <div className="um_modal_head contacts_label_modal_head">
              <h3
                id="contacts-label-modal-title"
                className="um_modal_title um_title_with_icon contacts_label_modal_title"
              >
                {labelModal.kind === "tag" ? (
                  <Tag
                    className="um_title_icon contacts_label_modal_title_icon"
                    size={22}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                ) : (
                  <LayoutList
                    className="um_title_icon contacts_label_modal_title_icon"
                    size={22}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                )}
                <span>
                  {labelModal.mode === "add"
                    ? labelModal.kind === "tag"
                      ? "Add tag"
                      : "Add list"
                    : labelModal.kind === "tag"
                      ? "Edit tag"
                      : "Edit list"}
                </span>
              </h3>
              <button
                type="button"
                className="um_modal_close"
                aria-label="Close"
                disabled={labelModalBusy}
                onClick={() => closeLabelModal()}
              >
                <X size={20} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <form
              className="contacts_label_modal_form"
              onSubmit={(e) => void submitLabelModal(e)}
            >
              <div className="um_field contacts_label_modal_field">
                <label
                  className="um_field_label_row"
                  htmlFor="contacts-label-name"
                >
                  {labelModal.kind === "tag" ? (
                    <Tag
                      className="um_field_label_icon"
                      size={17}
                      strokeWidth={2}
                      aria-hidden
                    />
                  ) : (
                    <LayoutList
                      className="um_field_label_icon"
                      size={17}
                      strokeWidth={2}
                      aria-hidden
                    />
                  )}
                  <span>Name</span>
                </label>
                <input
                  id="contacts-label-name"
                  type="text"
                  value={labelModalName}
                  onChange={(e) => {
                    setLabelModalName(e.target.value)
                    setLabelModalErr("")
                  }}
                  disabled={labelModalBusy}
                  autoComplete="off"
                  placeholder={
                    labelModal.kind === "tag"
                      ? "e.g. Accredited, VIP"
                      : "e.g. Newsletter, Q1 outreach"
                  }
                  required
                />
              </div>
              <div className="um_field contacts_label_modal_field">
                <label
                  className="um_field_label_row"
                  htmlFor="contacts-label-desc"
                >
                  <AlignLeft
                    className="um_field_label_icon"
                    size={17}
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span>Description</span>
                </label>
                <textarea
                  id="contacts-label-desc"
                  className="um_field_textarea contacts_label_modal_textarea"
                  value={labelModalDesc}
                  onChange={(e) => {
                    setLabelModalDesc(e.target.value)
                    setLabelModalErr("")
                  }}
                  disabled={labelModalBusy}
                  rows={4}
                  placeholder="Optional notes for your team"
                />
              </div>
              {labelModalErr ? (
                <p className="um_msg_error um_modal_form_error" role="alert">
                  {labelModalErr}
                </p>
              ) : null}
              <div className="um_modal_actions contacts_label_modal_actions">
                <button
                  type="button"
                  className="um_btn_secondary"
                  disabled={labelModalBusy}
                  onClick={() => closeLabelModal()}
                >
                  <X size={16} strokeWidth={2} aria-hidden />
                  Cancel
                </button>
                <button
                  type="submit"
                  className="um_btn_primary"
                  disabled={labelModalBusy}
                >
                  <Check size={16} strokeWidth={2} aria-hidden />
                  {labelModalBusy ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <AddContactPanel
        open={addOpen}
        onClose={() => {
          setAddOpen(false)
          setContactToEdit(null)
        }}
        onSave={handleSave}
        contactToEdit={contactToEdit}
        onUpdate={handleUpdate}
        existingContacts={rows}
        catalogTagNames={catalogTagNames}
        catalogListNames={catalogListNames}
      />

      <ViewContactModal
        contact={viewContact}
        onClose={() => setViewContactId(null)}
        onEdit={
          contactsListTab === "archived" ? undefined : openEditFromView
        }
      />

      <ExportContactsModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        contacts={tabRows}
        listKind={contactsListTab}
      />

      {suspendRow ? (
        <div
          className="um_modal_overlay contacts_suspend_overlay"
          role="presentation"
        >
          <div
            className="um_modal contacts_suspend_modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contacts-suspend-title"
            aria-describedby="contacts-suspend-desc"
          >
            <div className="um_modal_head">
              <h3
                id="contacts-suspend-title"
                className="um_modal_title um_title_with_icon"
              >
                {contactRowIsSuspended(suspendRow) ? (
                  <CheckCircle2
                    className="um_title_icon contacts_suspend_title_icon contacts_suspend_title_icon_activate"
                    size={22}
                    strokeWidth={2}
                    aria-hidden
                  />
                ) : (
                  <Ban
                    className="um_title_icon contacts_suspend_title_icon contacts_suspend_title_icon_suspend"
                    size={22}
                    strokeWidth={2}
                    aria-hidden
                  />
                )}
                <span>
                  {contactRowIsSuspended(suspendRow)
                    ? "Activate contact"
                    : "Suspend contact"}
                </span>
              </h3>
              <button
                type="button"
                className="um_modal_close"
                aria-label="Close"
                disabled={suspendSaving}
                onClick={() => closeSuspendContact()}
              >
                <X size={20} strokeWidth={2} aria-hidden />
              </button>
            </div>

            <p
              id="contacts-suspend-desc"
              className={
                contactRowIsSuspended(suspendRow)
                  ? "contacts_suspend_modal_desc contacts_suspend_modal_desc_info"
                  : "contacts_suspend_modal_desc contacts_suspend_modal_desc_warn"
              }
            >
              {contactRowIsSuspended(suspendRow) ? (
                <Info
                  className="contacts_suspend_modal_desc_icon"
                  size={18}
                  strokeWidth={2}
                  aria-hidden
                />
              ) : (
                <AlertTriangle
                  className="contacts_suspend_modal_desc_icon"
                  size={18}
                  strokeWidth={2}
                  aria-hidden
                />
              )}
              <span>
                {contactRowIsSuspended(suspendRow)
                  ? "This contact will return to your active list and can be edited and exported as usual."
                  : "They will move to Archived and won’t appear in your active list until you activate them again."}
              </span>
            </p>

            <div className="contacts_suspend_modal_grid">
              <ViewReadonlyField
                Icon={User}
                label="Name"
                value={
                  [suspendRow.firstName, suspendRow.lastName]
                    .filter(Boolean)
                    .join(" ")
                    .trim() || "—"
                }
              />
              <ViewReadonlyField
                Icon={Mail}
                label="Email"
                value={suspendRow.email?.trim() || "—"}
              />
            </div>

            <form
              className="contacts_suspend_modal_form"
              onSubmit={(e) => void submitSuspendContact(e)}
            >
              {!contactRowIsSuspended(suspendRow) ? (
                <div className="um_field contacts_suspend_reason_field">
                  <label
                    className="um_field_label_row"
                    htmlFor="contacts-suspend-reason"
                  >
                    <ClipboardList
                      className="um_field_label_icon"
                      size={17}
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span>
                      Reason for suspension{" "}
                      <span className="contacts_required" aria-hidden>
                        *
                      </span>
                    </span>
                  </label>
                  <textarea
                    id="contacts-suspend-reason"
                    className="um_field_textarea contacts_suspend_reason_textarea"
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder="e.g. No longer a prospect, requested removal…"
                    rows={3}
                    disabled={suspendSaving}
                    aria-required
                  />
                </div>
              ) : null}
              {suspendErr ? (
                <p
                  className="um_msg_error um_modal_form_error contacts_suspend_modal_error"
                  role="alert"
                >
                  {suspendErr}
                </p>
              ) : null}
              <div className="um_modal_actions contacts_suspend_modal_actions">
                <button
                  type="button"
                  className="um_btn_secondary"
                  disabled={suspendSaving}
                  onClick={() => closeSuspendContact()}
                >
                  <X size={16} strokeWidth={2} aria-hidden />
                  Cancel
                </button>
                <button
                  type="submit"
                  className="um_btn_primary"
                  disabled={
                    suspendSaving ||
                    (!contactRowIsSuspended(suspendRow) &&
                      !suspendReason.trim())
                  }
                >
                  {contactRowIsSuspended(suspendRow) ? (
                    <CheckCircle2 size={16} strokeWidth={2} aria-hidden />
                  ) : (
                    <Ban size={16} strokeWidth={2} aria-hidden />
                  )}
                  {suspendSaving
                    ? contactRowIsSuspended(suspendRow)
                      ? "Activating…"
                      : "Suspending…"
                    : contactRowIsSuspended(suspendRow)
                      ? "Activate contact"
                      : "Suspend contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default ContactsPage
