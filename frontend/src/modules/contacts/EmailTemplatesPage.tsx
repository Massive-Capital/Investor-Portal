import {
  Archive,
  ContactRound,
  FilePenLine,
  LayoutTemplate,
  Mail,
  Paperclip,
  Plus,
  Search,
  Send,
  X,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import DOMPurify from "dompurify"
import {
  DataTable,
  type DataTableColumn,
} from "../../common/components/data-table/DataTable"
import { TabsScrollStrip } from "../../common/components/tabs-scroll-strip/TabsScrollStrip"
import { toast } from "../../common/components/Toast"
import { formatDateDdMmmYyyy } from "../../common/utils/formatDateDisplay"
import "../../common/components/work_in_progress_page.css"
import "../../modules/usermanagement/user_management.css"
import "../Syndication/InvestorPortal/Deals/deals-list.css"
import "../Syndication/InvestorPortal/Deals/deal-investors-tab.css"
import "./contacts.css"
import { EmailTemplateRowActions } from "./components/EmailTemplateRowActions"
import {
  attachmentToObjectUrl,
  loadEmailTemplates,
  saveEmailTemplates,
  type EmailTemplateRow,
} from "./emailTemplatesStorage"

/** Match search against HTML body without treating markup as searchable words. */
function emailTemplateBodyPlainSearch(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

export type { EmailTemplateRow }

type EmailTemplatesTab = "templates" | "sent" | "draft"

type TemplatesListTab = "active" | "archived"

function parseEmailTemplatesTab(raw: string | null): EmailTemplatesTab {
  if (raw === "sent" || raw === "draft") return raw
  return "templates"
}

function EmailTemplatesTemplatesTabContent() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<EmailTemplateRow[]>(() =>
    loadEmailTemplates(),
  )
  const [templatesListTab, setTemplatesListTab] =
    useState<TemplatesListTab>("active")
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [viewRow, setViewRow] = useState<EmailTemplateRow | null>(null)

  const goNewTemplate = useCallback(() => {
    navigate("/contacts/email-templates/new")
  }, [navigate])

  const goEditTemplate = useCallback(
    (id: string) => {
      navigate(
        `/contacts/email-templates/edit/${encodeURIComponent(id)}`,
      )
    },
    [navigate],
  )

  const activeCount = useMemo(
    () => rows.filter((r) => !r.archived).length,
    [rows],
  )
  const archivedCount = useMemo(
    () => rows.filter((r) => r.archived).length,
    [rows],
  )

  const rowsForStatusTab = useMemo(
    () =>
      rows.filter((r) =>
        templatesListTab === "active" ? !r.archived : r.archived,
      ),
    [rows, templatesListTab],
  )

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return rowsForStatusTab
    return rowsForStatusTab.filter((r) => {
      const name = (r.name ?? "").toLowerCase()
      const by = (r.createdBy ?? "").toLowerCase()
      const subject = (r.subject ?? "").toLowerCase()
      const bodyPlain = emailTemplateBodyPlainSearch(r.body ?? "")
      return (
        name.includes(q) ||
        by.includes(q) ||
        subject.includes(q) ||
        bodyPlain.includes(q)
      )
    })
  }, [rowsForStatusTab, searchQuery])

  const templatesEmptyLabel = useMemo(() => {
    if (rows.length === 0)
      return "No templates yet. Click New Template to create one."
    if (filteredRows.length === 0) {
      if (rowsForStatusTab.length === 0) {
        return templatesListTab === "archived"
          ? "No archived templates."
          : "No active templates."
      }
      return "No templates match your search."
    }
    return "No templates match your search."
  }, [
    filteredRows.length,
    rows.length,
    rowsForStatusTab.length,
    templatesListTab,
  ])

  useEffect(() => {
    setPage(1)
  }, [searchQuery, templatesListTab])

  useEffect(() => {
    saveEmailTemplates(rows)
  }, [rows])

  const toggleTemplateArchive = useCallback((row: EmailTemplateRow) => {
    const nextArchived = !row.archived
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id ? { ...r, archived: nextArchived } : r,
      ),
    )
    toast.success(
      nextArchived ? "Template archived" : "Template restored",
      row.name,
    )
  }, [])

  const columns = useMemo((): DataTableColumn<EmailTemplateRow>[] => {
    return [
      {
        id: "name",
        header: "Template name",
        sortValue: (row) => row.name.toLowerCase(),
        tdClassName: "deal_inv_td_ellipsis",
        cell: (row) => (
          <span className="email_templates_name_cell" title={row.name}>
            {row.name}
          </span>
        ),
      },
      {
        id: "createdBy",
        header: "Added by",
        sortValue: (row) => row.createdBy.toLowerCase(),
        tdClassName: "deal_inv_td_ellipsis",
        cell: (row) => {
          const s = row.createdBy?.trim() || "—"
          return (
            <span className="email_templates_meta_cell" title={s}>
              {s}
            </span>
          )
        },
      },
      {
        id: "createdAt",
        header: "Created at",
        sortValue: (row) => {
          const t = Date.parse(row.createdAt)
          return Number.isFinite(t) ? t : 0
        },
        tdClassName: "deal_inv_td_ellipsis",
        cell: (row) => {
          const label = formatDateDdMmmYyyy(row.createdAt)
          const title =
            row.createdAt && label !== "—"
              ? String(row.createdAt)
              : undefined
          return (
            <span className="email_templates_meta_cell" title={title}>
              {label}
            </span>
          )
        },
      },
      {
        id: "actions",
        header: "Actions",
        align: "right",
        thClassName: "um_th_actions",
        tdClassName: "um_td_actions",
        cell: (row) => (
          <EmailTemplateRowActions
            templateName={row.name}
            archived={Boolean(row.archived)}
            onView={() => setViewRow(row)}
            onEdit={() => goEditTemplate(row.id)}
            onArchiveToggle={() => toggleTemplateArchive(row)}
          />
        ),
      },
    ]
  }, [goEditTemplate, toggleTemplateArchive])

  return (
    <>
      <div className="um_members_header_block contacts_inner_header">
        <div className="contacts_toolbar_filters_row">
          <div
            className="contacts_filter_button_group"
            role="group"
            aria-label="Filter templates by status"
          >
            <button
              type="button"
              id="email-templates-filter-active"
              aria-pressed={templatesListTab === "active"}
              className={`contacts_filter_btn${
                templatesListTab === "active"
                  ? " contacts_filter_btn_active"
                  : ""
              }`}
              onClick={() => setTemplatesListTab("active")}
            >
              <ContactRound size={16} strokeWidth={1.75} aria-hidden />
              <span>Active</span>
              <span className="contacts_filter_btn_count">
                ({activeCount})
              </span>
            </button>
            <button
              type="button"
              id="email-templates-filter-archived"
              aria-pressed={templatesListTab === "archived"}
              className={`contacts_filter_btn${
                templatesListTab === "archived"
                  ? " contacts_filter_btn_active"
                  : ""
              }`}
              onClick={() => setTemplatesListTab("archived")}
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
            onClick={goNewTemplate}
          >
            <Plus size={18} strokeWidth={2} aria-hidden />
            New Template
          </button>
        </div>
      </div>

      <div className="contacts_main_tab_panel_wrap">
        <div className="um_members_tab_content contacts_main_tab_content_flush">
          <div
            className="um_panel um_members_tab_panel deal_inv_table_panel contacts_table_panel"
            role="region"
            aria-label={
              templatesListTab === "archived"
                ? "Archived email templates"
                : "Active email templates"
            }
          >
            <div className="um_toolbar deal_inv_table_um_toolbar">
              <div className="um_search_wrap">
                <Search className="um_search_icon" size={18} aria-hidden />
                <input
                  type="search"
                  className="um_search_input"
                  placeholder="Search…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search templates"
                />
              </div>
            </div>
            <DataTable<EmailTemplateRow>
              columns={columns}
              rows={filteredRows}
              getRowKey={(r) => r.id}
              emptyLabel={templatesEmptyLabel}
              visualVariant="members"
              stickyFirstColumn
              initialSort={{ columnId: "name", direction: "asc" }}
              pagination={
                filteredRows.length > 0
                  ? {
                      page,
                      pageSize,
                      totalItems: filteredRows.length,
                      onPageChange: setPage,
                      onPageSizeChange: setPageSize,
                      ariaLabel: "Email templates pagination",
                    }
                  : undefined
              }
            />
          </div>
        </div>
      </div>

      {viewRow ? (
        <div
          className="um_modal_overlay contacts_view_modal_overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setViewRow(null)
          }}
        >
          <div
            className="um_modal contacts_view_modal um_modal_view email_templates_email_preview_modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="email-template-view-title"
          >
            <div className="um_modal_head">
              <h3
                id="email-template-view-title"
                className="um_modal_title um_title_with_icon"
              >
                <Mail
                  className="um_title_icon"
                  size={22}
                  strokeWidth={1.75}
                  aria-hidden
                />
                Email preview
              </h3>
              <button
                type="button"
                className="um_modal_close"
                aria-label="Close"
                onClick={() => setViewRow(null)}
              >
                <X size={20} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <div className="email_templates_view_modal_body email_preview_modal_body">
              <p className="email_preview_internal_note">
                <LayoutTemplate
                  size={14}
                  strokeWidth={2}
                  className="email_preview_internal_icon"
                  aria-hidden
                />
                <span>
                  Template: <strong>{viewRow.name}</strong>
                </span>
              </p>
              <div className="email_preview_sheet" role="document">
                <h2 className="email_preview_subject_line">
                  {viewRow.subject?.trim() || "(No subject)"}
                </h2>
                <dl className="email_preview_header_lines">
                  <div className="email_preview_dl_row">
                    <dt>From</dt>
                    <dd>{viewRow.createdBy?.trim() || "—"}</dd>
                  </div>
                  <div className="email_preview_dl_row">
                    <dt>Date</dt>
                    <dd>{formatDateDdMmmYyyy(viewRow.createdAt)}</dd>
                  </div>
                </dl>
                <div className="email_preview_message_card">
                  {viewRow.body?.trim() ? (
                    <div
                      className="email_preview_message_body"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(viewRow.body),
                      }}
                    />
                  ) : (
                    <p className="email_preview_empty_body">(No message body)</p>
                  )}
                </div>
                {viewRow.attachment ? (
                  <div className="email_preview_attachments">
                    <div className="email_preview_attachments_label">Attachment</div>
                    <button
                      type="button"
                      className="email_preview_attachment_chip"
                      onClick={() => {
                        const att = viewRow.attachment
                        if (!att) return
                        const url = attachmentToObjectUrl(att)
                        if (!url) return
                        const a = document.createElement("a")
                        a.href = url
                        a.download = att.fileName
                        document.body.appendChild(a)
                        a.click()
                        a.remove()
                        URL.revokeObjectURL(url)
                      }}
                    >
                      <Paperclip
                        className="email_preview_attachment_icon"
                        size={18}
                        strokeWidth={2}
                        aria-hidden
                      />
                      <span className="email_preview_attachment_name">
                        {viewRow.attachment.fileName}
                      </span>
                      <span className="email_preview_attachment_action">Download</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="um_modal_actions contacts_view_modal_footer">
              <button
                type="button"
                className="um_btn_primary contacts_view_modal_close_btn"
                onClick={() => setViewRow(null)}
              >
                <X size={18} strokeWidth={2} aria-hidden />
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default function EmailTemplatesPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const tab = useMemo(
    () => parseEmailTemplatesTab(searchParams.get("tab")),
    [searchParams],
  )

  const setTab = useCallback(
    (next: EmailTemplatesTab) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (next === "templates") p.delete("tab")
          else p.set("tab", next)
          return p
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const panelHint =
    tab === "templates"
      ? "Create and manage reusable email templates for your contacts."
      : tab === "sent"
        ? "Sent messages will appear here."
        : "Drafts you save will appear here."

  return (
    <section className="um_page contacts_page email_templates_page">
      <div className="um_members_header_block">
        <div className="um_header_row">
          <h2 className="um_title um_title_with_icon">
            <ContactRound
              className="um_title_icon"
              size={26}
              strokeWidth={1.75}
              aria-hidden
            />
            Email Templates
          </h2>
        </div>
      </div>

      <div className="um_members_tabs_outer deals_tabs_outer contacts_main_tabs_outer um_segmented_tabs_outer">
        <TabsScrollStrip scrollClassName="deals_tabs_scroll um_segmented_tabs_scroll">
          <div
            className="um_members_tabs_row deals_tabs_row um_segmented_tabs_row"
            role="tablist"
            aria-label="Templates, sent messages, and drafts"
          >
            <button
              type="button"
              id="email-templates-tab-templates"
              role="tab"
              aria-selected={tab === "templates"}
              aria-controls="email-templates-panel"
              className={`um_members_tab deals_tabs_tab um_segmented_tab${
                tab === "templates" ? " um_members_tab_active" : ""
              }`}
              onClick={() => setTab("templates")}
            >
              <LayoutTemplate
                className="deals_tabs_icon um_segmented_tab_icon"
                size={16}
                strokeWidth={2}
                aria-hidden
              />
              <span className="deals_tabs_label um_segmented_tab_label">
                Templates
              </span>
            </button>
            <button
              type="button"
              id="email-templates-tab-sent"
              role="tab"
              aria-selected={tab === "sent"}
              aria-controls="email-templates-panel"
              className={`um_members_tab deals_tabs_tab um_segmented_tab${
                tab === "sent" ? " um_members_tab_active" : ""
              }`}
              onClick={() => setTab("sent")}
            >
              <Send
                className="deals_tabs_icon um_segmented_tab_icon"
                size={16}
                strokeWidth={2}
                aria-hidden
              />
              <span className="deals_tabs_label um_segmented_tab_label">
                Sent
              </span>
            </button>
            <button
              type="button"
              id="email-templates-tab-draft"
              role="tab"
              aria-selected={tab === "draft"}
              aria-controls="email-templates-panel"
              className={`um_members_tab deals_tabs_tab um_segmented_tab${
                tab === "draft" ? " um_members_tab_active" : ""
              }`}
              onClick={() => setTab("draft")}
            >
              <FilePenLine
                className="deals_tabs_icon um_segmented_tab_icon"
                size={16}
                strokeWidth={2}
                aria-hidden
              />
              <span className="deals_tabs_label um_segmented_tab_label">
                Draft
              </span>
            </button>
          </div>
        </TabsScrollStrip>
      </div>

      <div
        id="email-templates-panel"
        role="tabpanel"
        aria-labelledby={`email-templates-tab-${tab}`}
        className={`email_templates_tab_panel${
          tab === "templates"
            ? " email_templates_tab_panel_templates"
            : ""
        }`}
      >
        <p className="email_templates_panel_hint">{panelHint}</p>
        {tab === "templates" ? (
          <EmailTemplatesTemplatesTabContent />
        ) : (
          <p className="wip_message" role="status">
            Work in progress
          </p>
        )}
      </div>
    </section>
  )
}
