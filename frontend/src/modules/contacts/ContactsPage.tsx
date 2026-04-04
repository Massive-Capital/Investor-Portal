import {
  AlertTriangle,
  Archive,
  Ban,
  CheckCircle2,
  ClipboardList,
  ContactRound,
  Download,
  Info,
  Mail,
  Plus,
  Search,
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
      {
        id: "note",
        header: "Note",
        sortValue: (row) => row.note ?? "",
        cell: (row) => (
          <span title={row.note || undefined}>
            {row.note ? row.note : "—"}
          </span>
        ),
      },
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
        align: "right",
        thClassName: "um_th_actions",
        tdClassName: "um_td_actions",
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
            All Contacts
          </h2>
          <button
            type="button"
            className="um_btn_primary"
            onClick={openAddPanel}
          >
            <Plus size={18} strokeWidth={2} aria-hidden />
            Add contact
          </button>
        </div>
      </div>

      <div className="um_members_tabs_outer">
        <div
          className="um_members_tabs_row"
          role="tablist"
          aria-label="Contact lists"
        >
          <button
            type="button"
            id="contacts-tab-active"
            role="tab"
            aria-selected={contactsListTab === "active"}
            aria-controls="contacts-panel-active"
            aria-label={`Active contacts, ${activeCount}`}
            className={`um_members_tab${
              contactsListTab === "active" ? " um_members_tab_active" : ""
            }`}
            onClick={() => {
              setContactsListTab("active")
              setToolbarNotice("")
            }}
          >
            <ContactRound size={18} strokeWidth={1.75} aria-hidden />
            <span>
              Active
              <span className="contacts_tab_count" aria-hidden>
                {" "}
                ({activeCount})
              </span>
            </span>
          </button>
          <button
            type="button"
            id="contacts-tab-archived"
            role="tab"
            aria-selected={contactsListTab === "archived"}
            aria-controls="contacts-panel-archived"
            aria-label={`Archived contacts, ${archivedCount}`}
            className={`um_members_tab${
              contactsListTab === "archived" ? " um_members_tab_active" : ""
            }`}
            onClick={() => {
              setContactsListTab("archived")
              setToolbarNotice("")
            }}
          >
            <Archive size={18} strokeWidth={1.75} aria-hidden />
            <span>
              Archived
              <span className="contacts_tab_count" aria-hidden>
                {" "}
                ({archivedCount})
              </span>
            </span>
          </button>
        </div>
      </div>

      <div className="um_members_tab_content">
        <div
          className="um_panel um_members_tab_panel contacts_table_panel"
          id={
            contactsListTab === "archived"
              ? "contacts-panel-archived"
              : "contacts-panel-active"
          }
          role="tabpanel"
          aria-labelledby={
            contactsListTab === "archived"
              ? "contacts-tab-archived"
              : "contacts-tab-active"
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
          onClick={(e) => {
            if (e.target === e.currentTarget && !suspendSaving)
              closeSuspendContact()
          }}
        >
          <div
            className="um_modal contacts_suspend_modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contacts-suspend-title"
            aria-describedby="contacts-suspend-desc"
            onClick={(e) => e.stopPropagation()}
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
