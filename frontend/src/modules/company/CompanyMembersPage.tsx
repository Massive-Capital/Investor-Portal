import {
  Activity,
  Ban,
  Building2,
  CheckCircle2,
  ClipboardList,
  Eye,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  RefreshCw,
  Upload,
  User,
  UserCircle,
  UserCog,
  X,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { useNavigate, useOutletContext, useParams } from "react-router-dom"
import {
  DataTable,
  type DataTableColumn,
} from "../../common/components/data-table/DataTable"
import { ViewReadonlyField } from "../../common/components/ViewReadonlyField"
import { toast } from "../../common/components/Toast"
import { decodeJwtPayload } from "../auth/utils/decode-jwt-payload"
import { SESSION_BEARER_KEY } from "../../common/auth/sessionKeys"
import { getApiV1Base } from "../../common/utils/apiBaseUrl"
import {
  MEMBER_AUDIT_ACTION_EDIT,
  MEMBER_AUDIT_ACTION_SUSPEND,
  MEMBER_STATUS_EDIT_OPTIONS,
  PLATFORM_INVITE_ROLE_OPTIONS,
  accountInviteIsExpired,
  accountStatusForUi,
  assignedDealCountFromRow,
  formatMemberUsername,
  formatValue,
  memberInvitePending,
  memberRoleDisplayName,
  memberRowIsCurrentUser,
  memberRowIsInactive,
  normalizeMemberStatusForEdit,
  rowDisplayName,
  syncSessionUserDetailsById,
  userStatusForUi,
} from "../usermanagement/memberAdminShared"
import { escapeCsvCell, exportAuditLinesForMembers } from "../usermanagement/memberCsv"
import { notifyMembersExportAudit } from "../usermanagement/membersExportNotifyApi"
import type { CustomerCompanyOutletContext } from "./CustomerCompanyLayout"
import "../usermanagement/user_management.css"
import "./company_page.css"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function initialsFromRow(row: Record<string, unknown>): string {
  const first = String(row.firstName ?? "").trim()
  const last = String(row.lastName ?? "").trim()
  if (first && last) {
    return (first[0] + last[0]).toUpperCase()
  }
  if (first.length >= 2) return first.slice(0, 2).toUpperCase()
  const u = String(row.username ?? "").trim()
  if (u.length >= 2) return u.slice(0, 2).toUpperCase()
  const e = String(row.email ?? "").trim()
  if (e.length >= 2) return e.slice(0, 2).toUpperCase()
  return "?"
}

function rowStableId(row: Record<string, unknown>, index: number): string {
  const id = row.id ?? row.user_id
  if (id != null && String(id).trim()) return String(id).trim()
  return `member-${index}`
}

function roleBadgeLabel(row: Record<string, unknown>): string {
  return memberRoleDisplayName(row.role)
}

function MemberRoleBadge({ row }: { row: Record<string, unknown> }) {
  const r = String(row.role ?? "").trim().toLowerCase()
  const label = memberRoleDisplayName(row.role)
  if (!r || label === "—") {
    return <span className="um_status_muted">—</span>
  }
  const useAdminStyleIcon =
    r === "platform_admin" || r === "company_admin"
  const Icon = useAdminStyleIcon ? ClipboardList : UserCircle
  return (
    <span className="um_role_badge">
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

function StatusWithDot({
  positive,
  label,
  dotTone,
}: {
  positive: boolean
  label: string
  dotTone?: "invited"
}) {
  if (label === "—") {
    return <span className="um_status_muted">—</span>
  }
  const dotClass =
    dotTone === "invited"
      ? "um_status_dot um_status_dot_invited"
      : positive
        ? "um_status_dot um_status_dot_active"
        : "um_status_dot um_status_dot_inactive"
  return (
    <span className="um_status_cell">
      <span className={dotClass} aria-hidden />
      <span className="um_status_label">{label}</span>
    </span>
  )
}

export default function CompanyMembersPage() {
  const { companyId = "" } = useParams<{ companyId: string }>()
  const navigate = useNavigate()
  const { companyDisplayName } = useOutletContext<CustomerCompanyOutletContext>()
  const apiV1 = getApiV1Base()
  const token = sessionStorage.getItem(SESSION_BEARER_KEY)

  const currentUserId = useMemo(() => {
    if (!token) return ""
    const p = decodeJwtPayload<{ id?: unknown }>(token)
    const id = p?.id
    if (id == null || id === "") return ""
    return String(id).trim().toLowerCase()
  }, [token])

  const [members, setMembers] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [actionMenuRowId, setActionMenuRowId] = useState<string | null>(null)
  const [actionMenuRow, setActionMenuRow] = useState<Record<
    string,
    unknown
  > | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  )
  const [viewRow, setViewRow] = useState<Record<string, unknown> | null>(null)
  const [reinviteBusyId, setReinviteBusyId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null)
  const [editRole, setEditRole] = useState("")
  const [editUserStatus, setEditUserStatus] = useState("active")
  const [editReason, setEditReason] = useState("")
  const [editSaving, setEditSaving] = useState(false)
  const [editErr, setEditErr] = useState("")
  const [suspendRow, setSuspendRow] = useState<Record<string, unknown> | null>(
    null,
  )
  const [suspendReason, setSuspendReason] = useState("")
  const [suspendSaving, setSuspendSaving] = useState(false)
  const [suspendErr, setSuspendErr] = useState("")

  const kebabPortalRef = useRef<HTMLUListElement | null>(null)
  const kebabTriggerRef = useRef<HTMLButtonElement | null>(null)

  const closeActionMenu = useCallback(() => {
    setActionMenuRowId(null)
    setActionMenuRow(null)
    setMenuPos(null)
  }, [])

  const openMenuContext =
    actionMenuRowId && actionMenuRow
      ? { row: actionMenuRow, rowId: actionMenuRowId }
      : null

  const updateKebabMenuPosition = useCallback(() => {
    if (!actionMenuRowId) {
      setMenuPos(null)
      return
    }
    const el = kebabTriggerRef.current
    if (!(el instanceof HTMLElement)) {
      setMenuPos(null)
      return
    }
    const r = el.getBoundingClientRect()
    const menuMinW = 168
    const margin = 8
    let left = r.right - menuMinW
    left = Math.max(
      margin,
      Math.min(left, window.innerWidth - menuMinW - margin),
    )
    setMenuPos({ top: r.bottom + 4, left })
  }, [actionMenuRowId])

  useLayoutEffect(() => {
    if (!actionMenuRowId) {
      setMenuPos(null)
      return
    }
    updateKebabMenuPosition()
    window.addEventListener("scroll", updateKebabMenuPosition, true)
    window.addEventListener("resize", updateKebabMenuPosition)
    return () => {
      window.removeEventListener("scroll", updateKebabMenuPosition, true)
      window.removeEventListener("resize", updateKebabMenuPosition)
    }
  }, [actionMenuRowId, updateKebabMenuPosition])

  useEffect(() => {
    if (actionMenuRowId == null) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (kebabTriggerRef.current?.contains(t)) return
      if (kebabPortalRef.current?.contains(t)) return
      closeActionMenu()
    }
    const id = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc)
    }, 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener("mousedown", onDoc)
    }
  }, [actionMenuRowId, closeActionMenu])

  useEffect(() => {
    if (actionMenuRowId == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeActionMenu()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [actionMenuRowId, closeActionMenu])

  const load = useCallback(async () => {
    const id = companyId.trim()
    if (!token || !apiV1) {
      setError("Not signed in.")
      setLoading(false)
      return
    }
    setLoading(true)
    setError("")
    setMembers([])
    closeActionMenu()
    try {
      const userRes = await fetch(
        `${apiV1}/users?organizationId=${encodeURIComponent(id)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        },
      )

      const userData = (await userRes.json().catch(() => ({}))) as {
        users?: unknown
        message?: string
      }
      if (!userRes.ok) {
        setError(userData.message || "Could not load members")
        return
      }
      const list = Array.isArray(userData.users) ? userData.users : []
      setMembers(
        list.filter(
          (x): x is Record<string, unknown> =>
            x !== null && typeof x === "object" && !Array.isArray(x),
        ),
      )
    } catch {
      setError("Unable to connect.")
    } finally {
      setLoading(false)
    }
  }, [companyId, token, apiV1, closeActionMenu])

  useEffect(() => {
    if (!UUID_RE.test(companyId.trim())) {
      navigate("/customers", { replace: true })
      return
    }
    void load()
  }, [companyId, navigate, load])

  const titleCompany = companyDisplayName?.trim() || "Company"

  const sendInviteForEmail = useCallback(
    async (
      email: string,
      orgId?: string,
      invitedRole?: string,
    ): Promise<{ ok: boolean; message: string }> => {
      if (!token || !apiV1) {
        return { ok: false, message: "Not signed in." }
      }
      const body: {
        email: string
        companyId?: string
        invitedRole?: string
      } = {
        email: email.trim().toLowerCase(),
      }
      if (orgId) body.companyId = orgId
      if (invitedRole) body.invitedRole = invitedRole
      const response = await fetch(`${apiV1}/auth/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      const data = (await response.json().catch(() => ({}))) as {
        message?: string
      }
      if (!response.ok) {
        return { ok: false, message: data.message || "Could not send invite." }
      }
      return {
        ok: true,
        message: data.message || "Invitation sent.",
      }
    },
    [token, apiV1],
  )

  function exportRowCsv(row: Record<string, unknown>) {
    const headers = [
      "Name",
      "Username",
      "Email",
      "Company",
      "User role",
      "User Status",
      "Account status",
      "Assigned deals",
    ]
    const vals = [
      rowDisplayName(row),
      formatMemberUsername(row.username),
      formatValue(row.email),
      titleCompany,
      roleBadgeLabel(row),
      userStatusForUi(row).label,
      accountStatusForUi(row).label,
      String(assignedDealCountFromRow(row)),
    ]
    const line = [
      headers.map(escapeCsvCell).join(","),
      vals.map(escapeCsvCell).join(","),
    ]
    const blob = new Blob([line.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const safe = String(row.username ?? row.email ?? "member").replace(
      /[^\w.-]+/g,
      "_",
    )
    a.download = `member-${safe}.csv`
    a.click()
    URL.revokeObjectURL(url)
    void notifyMembersExportAudit({
      rowCount: 1,
      exportedMemberLines: exportAuditLinesForMembers([row]),
    })
    closeActionMenu()
    toast.success("Member exported", `Saved as ${a.download}`)
  }

  async function reinviteRow(row: Record<string, unknown>, rowId: string) {
    const email = String(row.email ?? "").trim()
    if (!email) {
      toast.error("Cannot reinvite", "No email on file for this user.")
      closeActionMenu()
      return
    }
    setReinviteBusyId(rowId)
    try {
      const invitedRole = String(row.role ?? "").trim() || undefined
      const result = await sendInviteForEmail(
        email,
        companyId.trim(),
        invitedRole,
      )
      if (result.ok) {
        toast.success("User invited successfully")
        void load()
      } else {
        toast.error("Reinvite failed", result.message)
      }
    } catch {
      toast.error("Reinvite failed", "Unable to connect. Try again later.")
    } finally {
      setReinviteBusyId(null)
      closeActionMenu()
    }
  }

  function openEditMember(row: Record<string, unknown>) {
    if (memberRowIsCurrentUser(row, currentUserId)) {
      toast.error("Cannot edit", "You cannot edit your own account here.")
      return
    }
    setEditRow(row)
    const rawRole = String(row.role ?? "").trim()
    const roleForEdit =
      rawRole === "user" || rawRole === "" ? "platform_user" : rawRole
    setEditRole(roleForEdit)
    setEditUserStatus(normalizeMemberStatusForEdit(row))
    setEditReason("")
    setEditErr("")
  }

  function closeEditMember() {
    setEditRow(null)
    setEditReason("")
    setEditErr("")
  }

  function openSuspendMember(row: Record<string, unknown>) {
    if (memberRowIsCurrentUser(row, currentUserId)) {
      toast.error(
        "Cannot change status",
        "You cannot suspend or activate your own account here.",
      )
      return
    }
    setSuspendRow(row)
    setSuspendReason("")
    setSuspendErr("")
  }

  function closeSuspendMember() {
    setSuspendRow(null)
    setSuspendReason("")
    setSuspendErr("")
  }

  async function submitEditMember(e: React.FormEvent) {
    e.preventDefault()
    if (!editRow || !token || !apiV1) return
    if (memberRowIsCurrentUser(editRow, currentUserId)) {
      setEditErr("You cannot edit your own account.")
      return
    }
    const id = String(editRow.id ?? "").trim()
    if (!id) {
      setEditErr("Missing member id.")
      return
    }
    const reason = editReason.trim()
    if (!reason) {
      setEditErr("Please enter a reason for this change.")
      return
    }
    setEditSaving(true)
    setEditErr("")
    try {
      const res = await fetch(`${apiV1}/users/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: editRole,
          userStatus: editUserStatus,
          reason,
          action: MEMBER_AUDIT_ACTION_EDIT,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        message?: string
        user?: Record<string, unknown>
      }
      if (!res.ok) {
        const msg = data.message || "Could not save changes."
        setEditErr(msg)
        toast.error("Could not update member", msg)
        return
      }
      const u = data.user
      if (u && typeof u === "object") {
        setMembers((prev) =>
          prev.map((r) => (String(r.id) === id ? { ...r, ...u } : r)),
        )
        syncSessionUserDetailsById(id, u)
      }
      const okMsg = data.message || "Member updated."
      toast.success("Member updated", okMsg)
      closeEditMember()
    } catch {
      setEditErr("Unable to connect.")
      toast.error("Could not update member", "Unable to connect.")
    } finally {
      setEditSaving(false)
    }
  }

  async function submitSuspendMember(e: React.FormEvent) {
    e.preventDefault()
    if (!suspendRow || !token || !apiV1) return
    if (memberRowIsCurrentUser(suspendRow, currentUserId)) {
      setSuspendErr("You cannot suspend or activate your own account.")
      return
    }
    const id = String(suspendRow.id ?? "").trim()
    if (!id) {
      setSuspendErr("Missing member id.")
      return
    }
    const activating = memberRowIsInactive(suspendRow)
    const reason = suspendReason.trim()
    if (!reason) {
      setSuspendErr(
        activating
          ? "Please enter a reason for activating this member."
          : "Please enter a reason for suspending this member.",
      )
      return
    }
    setSuspendSaving(true)
    setSuspendErr("")
    try {
      const res = await fetch(`${apiV1}/users/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          activating
            ? {
                userStatus: "active",
                reason,
                action: MEMBER_AUDIT_ACTION_EDIT,
              }
            : {
                userStatus: "inactive",
                reason,
                action: MEMBER_AUDIT_ACTION_SUSPEND,
              },
        ),
      })
      const data = (await res.json().catch(() => ({}))) as {
        message?: string
        user?: Record<string, unknown>
      }
      if (!res.ok) {
        const msg =
          data.message ||
          (activating
            ? "Could not activate member."
            : "Could not suspend member.")
        setSuspendErr(msg)
        toast.error(
          activating ? "Could not activate member" : "Could not suspend member",
          msg,
        )
        return
      }
      const u = data.user
      if (u && typeof u === "object") {
        setMembers((prev) =>
          prev.map((r) => (String(r.id) === id ? { ...r, ...u } : r)),
        )
        syncSessionUserDetailsById(id, u)
      }
      const okMsg =
        data.message ||
        (activating ? "Member marked active." : "Member marked inactive.")
      toast.success(
        activating ? "Member activated" : "Member suspended",
        okMsg,
      )
      closeSuspendMember()
    } catch {
      setSuspendErr("Unable to connect.")
      toast.error(
        activating ? "Could not activate member" : "Could not suspend member",
        "Unable to connect.",
      )
    } finally {
      setSuspendSaving(false)
    }
  }

  const pagination = useMemo(
    () => ({
      page,
      pageSize,
      totalItems: members.length,
      onPageChange: setPage,
      onPageSizeChange: setPageSize,
      ariaLabel: `Members for ${titleCompany} table pagination`,
    }),
    [page, pageSize, members.length, titleCompany],
  )

  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      {
        id: "user",
        header: "User",
        sortValue: (row) => {
          const u = formatMemberUsername(row.username)
          const e = formatValue(row.email)
          return `${u} ${e}`.toLowerCase()
        },
        tdClassName: "um_td_user",
        cell: (row) => {
          const rawEmail = String(row.email ?? "").trim()
          const emailShown = formatValue(row.email)
          const usernameLabel = formatMemberUsername(row.username)
          const usernamePlaceholder =
            usernameLabel === "—"
              ? " um_user_meta_username--placeholder"
              : ""
          return (
            <div className="um_user_cell">
              <div className="um_user_avatar_ring" aria-hidden>
                <span className="um_user_initials">
                  {initialsFromRow(row)}
                </span>
              </div>
              <div className="um_user_meta">
                <span
                  className={`um_user_meta_username${usernamePlaceholder}`}
                >
                  {usernameLabel}
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
              </div>
            </div>
          )
        },
      },
      {
        id: "role",
        header: "User role",
        sortValue: (row) =>
          memberRoleDisplayName(row.role).toLowerCase(),
        cell: (row) => <MemberRoleBadge row={row} />,
      },
      {
        id: "status",
        header: "User Status",
        sortValue: (row) =>
          userStatusForUi(row).label.toLowerCase(),
        cell: (row) => {
          const uSt = userStatusForUi(row)
          return <StatusWithDot {...uSt} />
        },
      },
      {
        id: "account",
        header: "Account status",
        sortValue: (row) =>
          accountStatusForUi(row).label.toLowerCase(),
        cell: (row) => {
          const acct = accountStatusForUi(row)
          return (
            <StatusWithDot
              positive={acct.positive}
              label={acct.label}
              dotTone={acct.dotTone}
            />
          )
        },
      },
      {
        id: "actions",
        header: "Actions",
        thClassName: "um_th_actions",
        tdClassName: "um_td_actions",
        cell: (row, rowIndex = 0) => {
          const rowKey = rowStableId(row, rowIndex)
          const usernameLabel = formatMemberUsername(row.username)
          const rawEmail = String(row.email ?? "").trim()
          const menuOpen = actionMenuRowId === rowKey
          return (
            <div className="um_kebab_root">
              <button
                type="button"
                className="um_kebab_trigger"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label={`Actions for ${usernameLabel !== "—" ? usernameLabel : rawEmail || "member"}`}
                ref={
                  menuOpen
                    ? (el) => {
                        kebabTriggerRef.current = el
                      }
                    : undefined
                }
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  setActionMenuRowId((current) => {
                    if (current === rowKey) {
                      setActionMenuRow(null)
                      setMenuPos(null)
                      return null
                    }
                    setActionMenuRow(row)
                    return rowKey
                  })
                }}
              >
                <MoreHorizontal size={18} aria-hidden />
              </button>
            </div>
          )
        },
      },
    ],
    [actionMenuRowId],
  )

  useEffect(() => {
    setPage(1)
  }, [members.length, companyId])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(members.length / pageSize))
    if (page > totalPages) setPage(totalPages)
  }, [members.length, page, pageSize])

  return (
    <div
      className="um_panel um_members_tab_panel"
      id="cp-company-panel-members"
      role="tabpanel"
      aria-labelledby="cp-company-tab-members"
    >
      <div className="cp_company_tab_panel_inner">
        <div className="um_toolbar cp_company_tab_toolbar">
          <p className="cp_company_tab_toolbar_hint">
            Portal members assigned to{" "}
            <strong className="cp_company_tab_toolbar_strong">
              {titleCompany}
            </strong>
            .
          </p>
          <button
            type="button"
            className="um_btn_toolbar"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw size={18} strokeWidth={2} aria-hidden />
            Refresh
          </button>
        </div>

        {error ? (
          <p className="um_msg_error" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="um_hint">Loading members…</p>
        ) : members.length === 0 ? (
          <p className="um_hint">No members in this company.</p>
        ) : (
          <div className="cp_company_tab_table_wrap">
            <DataTable
              visualVariant="members"
              membersShell="plain"
              membersTableClassName="um_table_members"
              columns={columns}
              rows={members}
              getRowKey={(row, i) => rowStableId(row, i)}
              emptyLabel="No rows."
              pagination={pagination}
            />
          </div>
        )}
      </div>

      {actionMenuRowId &&
      menuPos &&
      openMenuContext &&
      typeof document !== "undefined"
        ? createPortal(
            <ul
              ref={kebabPortalRef}
              className="um_kebab_menu um_kebab_menu--portal"
              role="menu"
              aria-label="Row actions"
              style={{
                position: "fixed",
                top: menuPos.top,
                left: menuPos.left,
              }}
            >
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="um_kebab_menuitem"
                  onClick={() => {
                    setViewRow(openMenuContext.row)
                    closeActionMenu()
                  }}
                >
                  <Eye
                    className="um_kebab_menuitem_icon"
                    size={16}
                    strokeWidth={2}
                    aria-hidden
                  />
                  View
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="um_kebab_menuitem"
                  disabled={
                    memberInvitePending(openMenuContext.row) ||
                    memberRowIsCurrentUser(openMenuContext.row, currentUserId)
                  }
                  title={
                    memberRowIsCurrentUser(openMenuContext.row, currentUserId)
                      ? "You cannot edit your own account here."
                      : undefined
                  }
                  onClick={() => {
                    closeActionMenu()
                    openEditMember(openMenuContext.row)
                  }}
                >
                  <Pencil
                    className="um_kebab_menuitem_icon"
                    size={16}
                    strokeWidth={2}
                    aria-hidden
                  />
                  Edit
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="um_kebab_menuitem"
                  disabled={
                    memberInvitePending(openMenuContext.row) ||
                    memberRowIsCurrentUser(openMenuContext.row, currentUserId)
                  }
                  title={
                    memberRowIsCurrentUser(openMenuContext.row, currentUserId)
                      ? "You cannot suspend or activate your own account here."
                      : undefined
                  }
                  onClick={() => {
                    closeActionMenu()
                    openSuspendMember(openMenuContext.row)
                  }}
                >
                  {memberRowIsInactive(openMenuContext.row) ? (
                    <CheckCircle2
                      className="um_kebab_menuitem_icon"
                      size={16}
                      strokeWidth={2}
                      aria-hidden
                    />
                  ) : (
                    <Ban
                      className="um_kebab_menuitem_icon"
                      size={16}
                      strokeWidth={2}
                      aria-hidden
                    />
                  )}
                  {memberRowIsInactive(openMenuContext.row)
                    ? "Activate"
                    : "Suspend"}
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="um_kebab_menuitem"
                  disabled={
                    !accountInviteIsExpired(openMenuContext.row) ||
                    reinviteBusyId === openMenuContext.rowId
                  }
                  onClick={() =>
                    void reinviteRow(
                      openMenuContext.row,
                      openMenuContext.rowId,
                    )
                  }
                >
                  <Mail
                    className="um_kebab_menuitem_icon"
                    size={16}
                    strokeWidth={2}
                    aria-hidden
                  />
                  {reinviteBusyId === openMenuContext.rowId
                    ? "Reinviting…"
                    : "Reinvite"}
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="um_kebab_menuitem"
                  onClick={() => exportRowCsv(openMenuContext.row)}
                >
                  <Upload
                    className="um_kebab_menuitem_icon"
                    size={16}
                    strokeWidth={2}
                    aria-hidden
                  />
                  Export
                </button>
              </li>
            </ul>,
            document.body,
          )
        : null}

      {viewRow ? (
        <div
          className="um_modal_overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewRow(null)
          }}
        >
          <div
            className="um_modal um_modal_view"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cp-members-view-title"
          >
            <div className="um_modal_head">
              <h3 id="cp-members-view-title" className="um_modal_title">
                Member details
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
            <div className="um_view_grid">
              <ViewReadonlyField
                Icon={User}
                label="User name"
                value={formatMemberUsername(viewRow.username)}
              />
              <ViewReadonlyField
                Icon={Mail}
                label="Email"
                value={formatValue(viewRow.email)}
              />
              <ViewReadonlyField
                Icon={User}
                label="First name"
                value={formatValue(viewRow.firstName)}
              />
              <ViewReadonlyField
                Icon={User}
                label="Last name"
                value={formatValue(viewRow.lastName)}
              />
              <ViewReadonlyField
                Icon={Building2}
                label="Organization"
                value={titleCompany}
              />
              <ViewReadonlyField
                Icon={UserCog}
                label="Role"
                value={roleBadgeLabel(viewRow)}
              />
              <ViewReadonlyField
                Icon={Phone}
                label="Phone"
                value={formatValue(viewRow.phone)}
              />
              <ViewReadonlyField
                Icon={Activity}
                label="User Status"
                value={<StatusWithDot {...userStatusForUi(viewRow)} />}
              />
              <ViewReadonlyField
                Icon={ClipboardList}
                label="Account status"
                value={<StatusWithDot {...accountStatusForUi(viewRow)} />}
              />
            </div>
            <div className="um_modal_actions um_modal_actions_view">
              <button
                type="button"
                className="um_btn_secondary"
                onClick={() => setViewRow(null)}
              >
                <X size={16} strokeWidth={2} aria-hidden />
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editRow ? (
        <div
          className="um_modal_overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !editSaving) closeEditMember()
          }}
        >
          <div
            className="um_modal um_modal_view"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cp-members-edit-title"
          >
            <div className="um_modal_head">
              <h3 id="cp-members-edit-title" className="um_modal_title">
                Edit member
              </h3>
              <button
                type="button"
                className="um_modal_close"
                aria-label="Close"
                disabled={editSaving}
                onClick={() => closeEditMember()}
              >
                <X size={20} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <div className="um_view_grid um_view_grid_member_action">
              <ViewReadonlyField
                Icon={User}
                label="User name"
                value={formatMemberUsername(editRow.username)}
              />
              <ViewReadonlyField
                Icon={Mail}
                label="Email"
                value={formatValue(editRow.email)}
              />
            </div>
            <form onSubmit={submitEditMember}>
              <div className="um_edit_role_status_row">
                <div className="um_field">
                  <label
                    htmlFor="cp-members-edit-role"
                    className="um_field_label_row"
                  >
                    <UserCog className="um_field_label_icon" size={17} aria-hidden />
                    <span>Role</span>
                  </label>
                  <select
                    id="cp-members-edit-role"
                    className="um_field_select"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    required
                    disabled={editSaving}
                  >
                    {PLATFORM_INVITE_ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="um_field">
                  <label
                    htmlFor="cp-members-edit-status"
                    className="um_field_label_row"
                  >
                    <Activity className="um_field_label_icon" size={17} aria-hidden />
                    <span>User Status</span>
                  </label>
                  <select
                    id="cp-members-edit-status"
                    className="um_field_select"
                    value={editUserStatus}
                    onChange={(e) => setEditUserStatus(e.target.value)}
                    required
                    disabled={editSaving}
                  >
                    {MEMBER_STATUS_EDIT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="um_field">
                <label
                  htmlFor="cp-members-edit-reason"
                  className="um_field_label_row"
                >
                  <ClipboardList
                    className="um_field_label_icon"
                    size={17}
                    aria-hidden
                  />
                  <span>Reason</span>
                </label>
                <textarea
                  id="cp-members-edit-reason"
                  className="um_field_textarea"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  rows={3}
                  required
                  disabled={editSaving}
                  aria-required
                />
              </div>
              {editErr ? (
                <p className="um_msg_error um_modal_form_error" role="alert">
                  {editErr}
                </p>
              ) : null}
              <div className="um_modal_actions">
                <button
                  type="button"
                  className="um_btn_secondary"
                  disabled={editSaving}
                  onClick={() => closeEditMember()}
                >
                  <X size={16} strokeWidth={2} aria-hidden />
                  Cancel
                </button>
                <button
                  type="submit"
                  className="um_btn_primary"
                  disabled={editSaving || !editReason.trim()}
                >
                  <RefreshCw size={16} strokeWidth={2} aria-hidden />
                  {editSaving ? "Updating…" : "Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {suspendRow ? (
        <div
          className="um_modal_overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !suspendSaving)
              closeSuspendMember()
          }}
        >
          <div
            className="um_modal um_modal_view"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cp-members-suspend-title"
          >
            <div className="um_modal_head">
              <h3 id="cp-members-suspend-title" className="um_modal_title">
                {memberRowIsInactive(suspendRow)
                  ? "Activate member"
                  : "Suspend member"}
              </h3>
              <button
                type="button"
                className="um_modal_close"
                aria-label="Close"
                disabled={suspendSaving}
                onClick={() => closeSuspendMember()}
              >
                <X size={20} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <div className="um_view_grid um_view_grid_member_action">
              <ViewReadonlyField
                Icon={User}
                label="User name"
                value={formatMemberUsername(suspendRow.username)}
              />
              <ViewReadonlyField
                Icon={Mail}
                label="Email"
                value={formatValue(suspendRow.email)}
              />
            </div>
            <form onSubmit={submitSuspendMember}>
              <div className="um_field">
                <label
                  htmlFor="cp-members-suspend-reason"
                  className="um_field_label_row"
                >
                  {memberRowIsInactive(suspendRow) ? (
                    <CheckCircle2
                      className="um_field_label_icon"
                      size={17}
                      aria-hidden
                    />
                  ) : (
                    <Ban className="um_field_label_icon" size={17} aria-hidden />
                  )}
                  <span>Reason</span>
                </label>
                <textarea
                  id="cp-members-suspend-reason"
                  className="um_field_textarea"
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  rows={3}
                  required
                  disabled={suspendSaving}
                  aria-required
                />
              </div>
              {suspendErr ? (
                <p className="um_msg_error um_modal_form_error" role="alert">
                  {suspendErr}
                </p>
              ) : null}
              <div className="um_modal_actions">
                <button
                  type="button"
                  className="um_btn_secondary"
                  disabled={suspendSaving}
                  onClick={() => closeSuspendMember()}
                >
                  <X size={16} strokeWidth={2} aria-hidden />
                  Cancel
                </button>
                <button
                  type="submit"
                  className="um_btn_primary"
                  disabled={suspendSaving || !suspendReason.trim()}
                >
                  {memberRowIsInactive(suspendRow) ? (
                    <CheckCircle2 size={16} aria-hidden />
                  ) : (
                    <Ban size={16} aria-hidden />
                  )}
                  {suspendSaving
                    ? memberRowIsInactive(suspendRow)
                      ? "Activating…"
                      : "Suspending…"
                    : memberRowIsInactive(suspendRow)
                      ? "Activate"
                      : "Suspend"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
