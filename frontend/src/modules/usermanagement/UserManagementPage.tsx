import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  Building2,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  Info,
  LayoutGrid,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Upload,
  User,
  UserCircle,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  SESSION_BEARER_KEY,
  SESSION_USER_DETAILS_KEY,
} from "../../common/auth/sessionKeys";
import { getApiV1Base } from "../../common/utils/apiBaseUrl";
import { isCompanyAdmin, isPlatformAdmin } from "../../common/auth/roleUtils";
import { DataTablePagination } from "../../common/components/DataTablePagination/DataTablePagination";
import { ViewReadonlyField } from "../../common/components/ViewReadonlyField";
import { toast } from "../../common/components/Toast";
import {
  COMPANY_EDIT_ROLE_OPTIONS,
  MEMBER_AUDIT_ACTION_EDIT,
  MEMBER_AUDIT_ACTION_SUSPEND,
  MEMBER_STATUS_EDIT_OPTIONS,
  PLATFORM_INVITE_ROLE_OPTIONS,
  formatMemberUsername,
  formatValue,
  normalizeMemberStatusForEdit,
  rowDisplayName,
  syncSessionUserDetailsById,
} from "./memberAdminShared";
import "./user_management.css";

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function initialsFromRow(row: Record<string, unknown>): string {
  const first = String(row.firstName ?? "").trim();
  const last = String(row.lastName ?? "").trim();
  if (first && last) {
    return (first[0] + last[0]).toUpperCase();
  }
  if (first.length >= 2) return first.slice(0, 2).toUpperCase();
  const u = String(row.username ?? "").trim();
  if (u.length >= 2) return u.slice(0, 2).toUpperCase();
  const e = String(row.email ?? "").trim();
  if (e.length >= 2) return e.slice(0, 2).toUpperCase();
  return "?";
}

function accountStatusLabel(row: Record<string, unknown>): string {
  const raw = row.userSignupCompleted ?? row.user_signup_completed;
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (v === "true") return "Complete";
  if (v === "false") return "Incomplete";
  return formatValue(raw);
}

function memberRowIsInactive(row: Record<string, unknown>): boolean {
  const s = String(row.userStatus ?? "").trim().toLowerCase();
  return s === "suspended" || s === "inactive";
}

function memberInvitePending(row: Record<string, unknown>): boolean {
  const v = String(
    row.userSignupCompleted ?? row.user_signup_completed ?? "",
  )
    .trim()
    .toLowerCase();
  return v === "false";
}

/** User row status (active = green dot; otherwise coral + label). */
function userStatusForUi(row: Record<string, unknown>): {
  positive: boolean;
  label: string;
} {
  const raw = String(row.userStatus ?? "").trim();
  if (!raw) return { positive: false, label: "—" };
  const low = raw.toLowerCase();
  if (low === "active") return { positive: true, label: "Active" };
  if (low === "inactive" || low === "suspended") {
    return { positive: false, label: "Inactive" };
  }
  const label = raw
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return { positive: false, label };
}

/** Account signup status (complete = green; invited = blue; expired = coral). */
function accountStatusForUi(row: Record<string, unknown>): {
  positive: boolean;
  label: string;
  dotTone?: "invited";
} {
  const raw = row.userSignupCompleted ?? row.user_signup_completed;
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (v === "true") return { positive: true, label: "Complete" };
  if (v === "false") {
    const expRaw = row.inviteExpiresAt ?? row.invite_expires_at;
    if (expRaw) {
      const t = new Date(String(expRaw)).getTime();
      if (!Number.isNaN(t) && Date.now() > t) {
        return { positive: false, label: "Invite expired" };
      }
    }
    return { positive: false, label: "Invited", dotTone: "invited" };
  }
  const l = accountStatusLabel(row);
  if (l === "—") return { positive: false, label: "—" };
  if (l === "Complete") return { positive: true, label: "Complete" };
  if (l === "Incomplete") return { positive: false, label: "Incomplete" };
  return { positive: false, label: l };
}

function StatusWithDot({
  positive,
  label,
  dotTone,
}: {
  positive: boolean;
  label: string;
  dotTone?: "invited";
}) {
  if (label === "—") {
    return <span className="um_status_muted">—</span>;
  }
  const dotClass =
    dotTone === "invited"
      ? "um_status_dot um_status_dot_invited"
      : positive
        ? "um_status_dot um_status_dot_active"
        : "um_status_dot um_status_dot_inactive";
  return (
    <span className="um_status_cell">
      <span className={dotClass} aria-hidden />
      <span className="um_status_label">{label}</span>
    </span>
  );
}

/** Label used in badge, sort, export, and search. */
function roleBadgeLabel(row: Record<string, unknown>): string {
  const r = String(row.role ?? "").trim().toLowerCase();
  if (!r) return "—";
  if (r === "platform_admin") return "Platform Admin";
  if (r === "company_admin") return "Company admin";
  if (r === "company_user") return "Company user";
  if (r === "platform_user" || r === "user") return "Member";
  const raw = String(row.role ?? "").trim();
  return (
    raw
      .split(/[\s_-]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ") || "—"
  );
}

function UserRoleBadge({ row }: { row: Record<string, unknown> }) {
  const r = String(row.role ?? "").trim().toLowerCase();
  if (!r) {
    return <span className="um_status_muted">—</span>;
  }
  if (r === "platform_admin") {
    return (
      <span className="um_role_badge">
        <ClipboardList
          className="um_role_badge_icon"
          size={16}
          strokeWidth={2}
          aria-hidden
        />
        <span className="um_role_badge_label">Platform Admin</span>
      </span>
    );
  }
  if (r === "company_admin") {
    return (
      <span className="um_role_badge">
        <ClipboardList
          className="um_role_badge_icon"
          size={16}
          strokeWidth={2}
          aria-hidden
        />
        <span className="um_role_badge_label">Company admin</span>
      </span>
    );
  }
  if (r === "platform_user" || r === "user") {
    return (
      <span className="um_role_badge">
        <UserCircle
          className="um_role_badge_icon"
          size={16}
          strokeWidth={2}
          aria-hidden
        />
        <span className="um_role_badge_label">Member</span>
      </span>
    );
  }
  if (r === "company_user") {
    return (
      <span className="um_role_badge">
        <UserCircle
          className="um_role_badge_icon"
          size={16}
          strokeWidth={2}
          aria-hidden
        />
        <span className="um_role_badge_label">Company user</span>
      </span>
    );
  }
  const raw = String(row.role ?? "").trim();
  const label =
    raw
      .split(/[\s_-]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ") || "—";
  return (
    <span className="um_role_badge">
      <ClipboardList
        className="um_role_badge_icon"
        size={16}
        strokeWidth={2}
        aria-hidden
      />
      <span className="um_role_badge_label">{label}</span>
    </span>
  );
}

function companyCellValue(row: Record<string, unknown>): string {
  const raw = row.companyName ?? row.company_name;
  const s = String(raw ?? "").trim();
  return s || "—";
}

function rowOrganizationId(row: Record<string, unknown>): string | undefined {
  const v = row.organizationId ?? row.organization_id;
  if (typeof v === "string" && v.trim()) return v.trim();
  return undefined;
}

function rowStableId(row: Record<string, unknown>, index: number): string {
  const id = row.id;
  if (typeof id === "string" && id) return id;
  if (typeof id === "number") return String(id);
  return `idx-${index}`;
}

function rowMatchesSearch(
  row: Record<string, unknown>,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    rowDisplayName(row),
    formatValue(row.email),
    formatMemberUsername(row.username),
    formatValue(row.companyName),
    formatValue(row.phone),
    formatValue(row.role),
    roleBadgeLabel(row),
    formatValue(row.userStatus),
    accountStatusLabel(row),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

type MemberSortKey = "user" | "company" | "role" | "status" | "accountStatus";

function memberSortValue(
  row: Record<string, unknown>,
  key: MemberSortKey,
): string {
  switch (key) {
    case "user":
      return `${rowDisplayName(row)} ${formatMemberUsername(row.username)}`.toLowerCase();
    case "company":
      return companyCellValue(row);
    case "role":
      return roleBadgeLabel(row);
    case "status":
      return userStatusForUi(row).label;
    case "accountStatus":
      return accountStatusForUi(row).label;
    default:
      return "";
  }
}

function buildSortColumns(showCompany: boolean): {
  key: MemberSortKey;
  label: string;
}[] {
  const base: { key: MemberSortKey; label: string }[] = [
    { key: "user", label: "User" },
  ];
  if (showCompany) {
    base.push({ key: "company", label: "Company" });
  }
  base.push(
    { key: "role", label: "User role" },
    { key: "status", label: "User Status" },
    { key: "accountStatus", label: "Account status" },
  );
  return base;
}

function readSessionMemberRows(): Record<string, unknown>[] {
  try {
    const raw = sessionStorage.getItem(SESSION_USER_DETAILS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (x): x is Record<string, unknown> =>
            x !== null && typeof x === "object" && !Array.isArray(x),
        );
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

type RoleMatrixCardIcon = "shield-check" | "layout-grid";

type RoleMatrixCardDef = {
  id: string;
  title: string;
  description: string;
  cardIcon: RoleMatrixCardIcon;
};

type RoleMatrixGroupDef = {
  id: string;
  sectionTitle: string;
  sectionDescription: string;
  headerIcon: LucideIcon;
  cards: RoleMatrixCardDef[];
};

const ROLE_MATRIX_GROUPS: RoleMatrixGroupDef[] = [
  {
    id: "platform",
    sectionTitle: "Platform Users",
    sectionDescription: "Platform-level roles for system administration.",
    headerIcon: Shield,
    cards: [
      {
        id: "platform-administrator",
        title: "Platform Admin",
        description:
          "Full access across the platform. Register organizations, view all members and the company column, and send invites tied to any company.",
        cardIcon: "shield-check",
      },
      {
        id: "platform-user",
        title: "Platform user",
        description:
          "Standard access without org-admin tools. Use assigned modules (for example Deals), view the company directory, and sign in at the platform layer.",
        cardIcon: "layout-grid",
      },
    ],
  },
  {
    id: "company",
    sectionTitle: "Company Users",
    sectionDescription:
      "Organization-level roles for people tied to a company and its membership.",
    headerIcon: Building2,
    cards: [
      {
        id: "company-administrator",
        title: "Company administrator",
        description:
          "Manage members and invitations for your organization. First signup that creates a new company name is promoted to this role automatically.",
        cardIcon: "shield-check",
      },
      {
        id: "company-user",
        title: "Company user",
        description:
          "Day-to-day portal use for your team, including invites to an existing organization and typical employees without admin privileges (for example when assigned via a platform-admin invite).",
        cardIcon: "layout-grid",
      },
    ],
  },
];

const CARD_ICON_MAP: Record<RoleMatrixCardIcon, LucideIcon> = {
  "shield-check": ShieldCheck,
  "layout-grid": LayoutGrid,
};

function MembersRoleIconBox({
  Icon,
  size = "sm",
}: {
  Icon: LucideIcon;
  size?: "sm" | "lg";
}) {
  return (
    <span
      className={
        size === "lg" ? "um_role_icon_shell um_role_icon_shell_lg" : "um_role_icon_shell"
      }
      aria-hidden
    >
      <Icon className="um_role_icon_svg" size={size === "lg" ? 28 : 20} strokeWidth={1.65} />
    </span>
  );
}

function MembersRoleInfoPanel() {
  // Company admins: Company Users only. Platform admins (and other non–company-admin viewers here): Platform + Company.
  const roleMatrixGroups = isCompanyAdmin()
    ? ROLE_MATRIX_GROUPS.filter((g) => g.id === "company")
    : ROLE_MATRIX_GROUPS;

  return (
    <div className="um_role_definitions">
      <header className="um_role_definitions_page_head">
        <h2 className="um_role_definitions_title">Role Definitions</h2>
        <p className="um_role_definitions_subtitle">
          Permissions matrix for available roles by user type.
        </p>
      </header>

      {roleMatrixGroups.map((group) => {
        const HeaderIcon = group.headerIcon;
        return (
          <section key={group.id} className="um_role_matrix_section">
            <div className="um_role_matrix_section_head">
              <MembersRoleIconBox Icon={HeaderIcon} size="lg" />
              <div className="um_role_matrix_section_head_text">
                <h3 className="um_role_matrix_section_title">{group.sectionTitle}</h3>
                <p className="um_role_matrix_section_desc">{group.sectionDescription}</p>
              </div>
            </div>
            <div className="um_role_matrix_cards">
              {group.cards.map((card) => {
                const CardIcon = CARD_ICON_MAP[card.cardIcon];
                return (
                  <article key={`${group.id}-${card.id}`} className="um_role_matrix_card">
                    <div className="um_role_matrix_card_top">
                      <MembersRoleIconBox Icon={CardIcon} />
                      <div className="um_role_matrix_card_titles">
                        <h4 className="um_role_matrix_card_title">{card.title}</h4>
                      </div>
                    </div>
                    <p className="um_role_matrix_card_desc">{card.description}</p>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function UserManagementPage() {
  const token = sessionStorage.getItem(SESSION_BEARER_KEY);
  const apiV1 = getApiV1Base();

  const [memberRows, setMemberRows] =
    useState<Record<string, unknown>[]>(readSessionMemberRows);
  const [membersLoadError, setMembersLoadError] = useState("");
  const [membersLoading, setMembersLoading] = useState(true);

  useEffect(() => {
    if (!token || !apiV1) {
      setMembersLoading(false);
      return;
    }
    let cancelled = false;
    setMembersLoading(true);
    setMembersLoadError("");
    void (async () => {
      const res = await fetch(`${apiV1}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => ({}))) as {
        users?: unknown;
        message?: string;
      };
      if (cancelled) return;
      if (!res.ok) {
        setMembersLoadError(data.message || "Could not load members.");
        setMembersLoading(false);
        return;
      }
      const list = Array.isArray(data.users) ? data.users : [];
      const normalized = list.filter(
        (x): x is Record<string, unknown> =>
          x !== null && typeof x === "object" && !Array.isArray(x),
      );
      setMemberRows(normalized);
      setActionMenuRowId(null);
      setActionMenuRow(null);
      setMenuPos(null);
      setMembersLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, apiV1]);

  const refreshMembersAfterInvite = useCallback(async () => {
    if (!token || !apiV1) return;
    try {
      const res = await fetch(`${apiV1}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => ({}))) as {
        users?: unknown;
      };
      if (!res.ok) return;
      const list = Array.isArray(data.users) ? data.users : [];
      const normalized = list.filter(
        (x): x is Record<string, unknown> =>
          x !== null && typeof x === "object" && !Array.isArray(x),
      );
      setMemberRows(normalized);
    } catch {
      /* ignore */
    }
  }, [token, apiV1]);

  useEffect(() => {
    if (!token || !apiV1) return;
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshMembersAfterInvite();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [token, apiV1, refreshMembersAfterInvite]);

  const showCompanyColumn = isPlatformAdmin();
  const sortColumns = useMemo(
    () => buildSortColumns(showCompanyColumn),
    [showCompanyColumn],
  );

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCompanyId, setInviteCompanyId] = useState("");
  const [inviteInvitedRole, setInviteInvitedRole] = useState("platform_user");
  const [inviteCompanies, setInviteCompanies] = useState<
    { id: string; name: string }[]
  >([]);
  const [inviteCompaniesError, setInviteCompaniesError] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [membersTab, setMembersTab] = useState<"users" | "general">("users");
  const [searchQuery, setSearchQuery] = useState("");
  const [membersPage, setMembersPage] = useState(1);
  const [membersPageSize, setMembersPageSize] = useState(10);
  const [toolbarNotice, setToolbarNotice] = useState("");
  const [sortKey, setSortKey] = useState<MemberSortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [actionMenuRowId, setActionMenuRowId] = useState<string | null>(null);
  const [actionMenuRow, setActionMenuRow] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [viewRow, setViewRow] = useState<Record<string, unknown> | null>(null);
  const [reinviteBusyId, setReinviteBusyId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editUserStatus, setEditUserStatus] = useState("active");
  const [editReason, setEditReason] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [suspendRow, setSuspendRow] = useState<Record<string, unknown> | null>(
    null,
  );
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendSaving, setSuspendSaving] = useState(false);
  const [suspendErr, setSuspendErr] = useState("");
  const kebabPortalRef = useRef<HTMLUListElement | null>(null);
  const kebabTriggerRef = useRef<HTMLButtonElement | null>(null);

  const closeActionMenu = useCallback(() => {
    setActionMenuRowId(null);
    setActionMenuRow(null);
    setMenuPos(null);
  }, []);

  const filteredRows = useMemo(
    () => memberRows.filter((row) => rowMatchesSearch(row, searchQuery)),
    [memberRows, searchQuery],
  );

  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows;
    if (!sortColumns.some((c) => c.key === sortKey)) {
      return filteredRows;
    }
    const mult = sortDir === "asc" ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      const va = memberSortValue(a, sortKey).toLowerCase();
      const vb = memberSortValue(b, sortKey).toLowerCase();
      return va.localeCompare(vb, undefined, { sensitivity: "base" }) * mult;
    });
  }, [filteredRows, sortKey, sortDir, sortColumns]);

  useEffect(() => {
    setMembersPage(1);
  }, [searchQuery, sortKey, sortDir]);

  const membersTableTotalPages = Math.max(
    1,
    Math.ceil(sortedRows.length / membersPageSize),
  );

  useEffect(() => {
    if (membersPage > membersTableTotalPages) {
      setMembersPage(membersTableTotalPages);
    }
  }, [membersPage, membersTableTotalPages]);

  const membersPageSafe = Math.min(membersPage, membersTableTotalPages);

  const membersPaginatedRows = useMemo(() => {
    const start = (membersPageSafe - 1) * membersPageSize;
    return sortedRows.slice(start, start + membersPageSize);
  }, [sortedRows, membersPageSafe, membersPageSize]);

  const openMenuContext =
    actionMenuRowId && actionMenuRow
      ? { row: actionMenuRow, rowId: actionMenuRowId }
      : null;

  const updateKebabMenuPosition = useCallback(() => {
    if (!actionMenuRowId) {
      setMenuPos(null);
      return;
    }
    const el = kebabTriggerRef.current;
    if (!(el instanceof HTMLElement)) {
      setMenuPos(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const menuMinW = 168;
    const margin = 8;
    let left = r.right - menuMinW;
    left = Math.max(
      margin,
      Math.min(left, window.innerWidth - menuMinW - margin),
    );
    setMenuPos({ top: r.bottom + 4, left });
  }, [actionMenuRowId]);

  useLayoutEffect(() => {
    if (!actionMenuRowId) {
      setMenuPos(null);
      return;
    }
    updateKebabMenuPosition();
    window.addEventListener("scroll", updateKebabMenuPosition, true);
    window.addEventListener("resize", updateKebabMenuPosition);
    return () => {
      window.removeEventListener("scroll", updateKebabMenuPosition, true);
      window.removeEventListener("resize", updateKebabMenuPosition);
    };
  }, [actionMenuRowId, updateKebabMenuPosition]);

  useEffect(() => {
    if (actionMenuRowId == null) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (kebabTriggerRef.current?.contains(t)) return;
      if (kebabPortalRef.current?.contains(t)) return;
      closeActionMenu();
    };
    const id = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [actionMenuRowId, closeActionMenu]);

  useEffect(() => {
    if (actionMenuRowId == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeActionMenu();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [actionMenuRowId, closeActionMenu]);

  const toggleSort = useCallback((key: MemberSortKey) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prevKey;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const sendInviteForEmail = useCallback(
    async (
      email: string,
      companyId?: string,
      invitedRole?: string,
    ): Promise<{
      ok: boolean;
      message: string;
      signupUrl?: string;
      emailSent?: boolean;
    }> => {
      if (!token || !apiV1) {
        return { ok: false, message: "Not signed in." };
      }
      const body: {
        email: string;
        companyId?: string;
        invitedRole?: string;
      } = {
        email: email.trim().toLowerCase(),
      };
      if (companyId) body.companyId = companyId;
      if (invitedRole) body.invitedRole = invitedRole;
      const response = await fetch(`${apiV1}/auth/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        signupUrl?: string;
        emailSent?: boolean;
      };
      if (!response.ok) {
        return { ok: false, message: data.message || "Could not send invite." };
      }
      return {
        ok: true,
        message: data.message || "Invitation sent.",
        signupUrl: data.signupUrl,
        emailSent: data.emailSent,
      };
    },
    [token, apiV1],
  );

  function exportMembersCsv() {
    const headers = [
      "Name",
      "Username",
      "Email",
      ...(showCompanyColumn ? ["Company"] : []),
      "User role",
      "User Status",
      "Account status",
    ];
    const lines = [headers.map(escapeCsvCell).join(",")];
    for (const row of sortedRows) {
      const line = [
        rowDisplayName(row),
        formatMemberUsername(row.username),
        formatValue(row.email),
        ...(showCompanyColumn ? [companyCellValue(row)] : []),
        roleBadgeLabel(row),
        userStatusForUi(row).label,
        accountStatusForUi(row).label,
      ];
      lines.push(line.map((c) => escapeCsvCell(c)).join(","));
    }
    const blob = new Blob([lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "members.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportRowCsv(row: Record<string, unknown>) {
    const headers = [
      "Name",
      "Username",
      "Email",
      ...(showCompanyColumn ? ["Company"] : []),
      "User role",
      "User Status",
      "Account status",
    ];
    const vals = [
      rowDisplayName(row),
      formatMemberUsername(row.username),
      formatValue(row.email),
      ...(showCompanyColumn ? [companyCellValue(row)] : []),
      roleBadgeLabel(row),
      userStatusForUi(row).label,
      accountStatusForUi(row).label,
    ];
    const line = [
      headers.map(escapeCsvCell).join(","),
      vals.map(escapeCsvCell).join(","),
    ];
    const blob = new Blob([line.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safe = String(row.username ?? row.email ?? "member").replace(
      /[^\w.-]+/g,
      "_",
    );
    a.download = `member-${safe}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    closeActionMenu();
    setToolbarNotice("");
    toast.success("Member exported", `Saved as ${a.download}`);
  }

  async function reinviteRow(row: Record<string, unknown>, rowId: string) {
    const email = String(row.email ?? "").trim();
    if (!email) {
      toast.error("Cannot reinvite", "No email on file for this user.");
      closeActionMenu();
      return;
    }
    setReinviteBusyId(rowId);
    setToolbarNotice("");
    try {
      const orgId = showCompanyColumn ? rowOrganizationId(row) : undefined;
      const invitedRole = showCompanyColumn
        ? String(row.role ?? "").trim() || undefined
        : undefined;
      const result = await sendInviteForEmail(email, orgId, invitedRole);
      if (result.ok) {
        toast.success("User invited successfully");
        void refreshMembersAfterInvite();
      } else {
        toast.error("Reinvite failed", result.message);
      }
    } catch {
      toast.error("Reinvite failed", "Unable to connect. Try again later.");
    } finally {
      setReinviteBusyId(null);
      closeActionMenu();
    }
  }

  function handleSuspendAll() {
    setToolbarNotice("Bulk suspend is not available yet.");
  }

  function openInviteModal() {
    setInviteOpen(true);
    setInviteEmail("");
    setInviteCompanyId("");
    setInviteInvitedRole("platform_user");
    setInviteCompaniesError("");
    setInviteError("");
  }

  function closeInviteModal() {
    setInviteOpen(false);
    setInviteLoading(false);
    setInviteError("");
  }

  function openEditMember(row: Record<string, unknown>) {
    setEditRow(row);
    const rawRole = String(row.role ?? "").trim();
    const roleForEdit =
      rawRole === "user" || rawRole === "" ? "platform_user" : rawRole;
    setEditRole(roleForEdit);
    setEditUserStatus(normalizeMemberStatusForEdit(row));
    setEditReason("");
    setEditErr("");
  }

  function closeEditMember() {
    setEditRow(null);
    setEditReason("");
    setEditErr("");
  }

  function openSuspendMember(row: Record<string, unknown>) {
    setSuspendRow(row);
    setSuspendReason("");
    setSuspendErr("");
  }

  function closeSuspendMember() {
    setSuspendRow(null);
    setSuspendReason("");
    setSuspendErr("");
  }

  async function submitEditMember(e: React.FormEvent) {
    e.preventDefault();
    if (!editRow || !token || !apiV1) return;
    const id = String(editRow.id ?? "").trim();
    if (!id) {
      setEditErr("Missing member id.");
      return;
    }
    const reason = editReason.trim();
    if (!reason) {
      setEditErr("Please enter a reason for this change.");
      return;
    }
    setEditSaving(true);
    setEditErr("");
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
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        user?: Record<string, unknown>;
      };
      if (!res.ok) {
        const msg = data.message || "Could not save changes.";
        setEditErr(msg);
        toast.error("Could not update member", msg);
        return;
      }
      const u = data.user;
      if (u && typeof u === "object") {
        setMemberRows((prev) =>
          prev.map((r) => (String(r.id) === id ? { ...r, ...u } : r)),
        );
        syncSessionUserDetailsById(id, u);
      }
      const okMsg = data.message || "Member updated.";
      toast.success("Member updated", okMsg);
      closeEditMember();
    } catch {
      setEditErr("Unable to connect.");
      toast.error("Could not update member", "Unable to connect.");
    } finally {
      setEditSaving(false);
    }
  }

  async function submitSuspendMember(e: React.FormEvent) {
    e.preventDefault();
    if (!suspendRow || !token || !apiV1) return;
    const id = String(suspendRow.id ?? "").trim();
    if (!id) {
      setSuspendErr("Missing member id.");
      return;
    }
    const activating = memberRowIsInactive(suspendRow);
    const reason = suspendReason.trim();
    if (!reason) {
      setSuspendErr(
        activating
          ? "Please enter a reason for activating this member."
          : "Please enter a reason for suspending this member.",
      );
      return;
    }
    setSuspendSaving(true);
    setSuspendErr("");
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
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        user?: Record<string, unknown>;
      };
      if (!res.ok) {
        const msg =
          data.message ||
          (activating
            ? "Could not activate member."
            : "Could not suspend member.");
        setSuspendErr(msg);
        toast.error(
          activating ? "Could not activate member" : "Could not suspend member",
          msg,
        );
        return;
      }
      const u = data.user;
      if (u && typeof u === "object") {
        setMemberRows((prev) =>
          prev.map((r) => (String(r.id) === id ? { ...r, ...u } : r)),
        );
        syncSessionUserDetailsById(id, u);
      }
      const okMsg =
        data.message ||
        (activating ? "Member marked active." : "Member marked inactive.");
      toast.success(
        activating ? "Member activated" : "Member suspended",
        okMsg,
      );
      closeSuspendMember();
    } catch {
      setSuspendErr("Unable to connect.");
      toast.error(
        activating ? "Could not activate member" : "Could not suspend member",
        "Unable to connect.",
      );
    } finally {
      setSuspendSaving(false);
    }
  }

  const editRoleSelectOptions = useMemo(
    () =>
      showCompanyColumn
        ? PLATFORM_INVITE_ROLE_OPTIONS
        : COMPANY_EDIT_ROLE_OPTIONS,
    [showCompanyColumn],
  );

  useEffect(() => {
    if (!inviteOpen || !showCompanyColumn || !token || !apiV1) return;
    let cancelled = false;
    setInviteCompaniesError("");
    void (async () => {
      const r = await fetch(`${apiV1}/companies`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await r.json().catch(() => ({}))) as {
        companies?: unknown;
        message?: string;
      };
      if (cancelled) return;
      if (!r.ok) {
        setInviteCompanies([]);
        const msg = data.message || "Could not load companies.";
        setInviteCompaniesError(msg);
        toast.error("Could not load companies", msg);
        return;
      }
      const list = Array.isArray(data.companies) ? data.companies : [];
      const normalized = list
        .filter(
          (x): x is Record<string, unknown> =>
            x !== null && typeof x === "object" && !Array.isArray(x),
        )
        .map((c) => ({
          id: String(c.id ?? ""),
          name: String(c.name ?? ""),
        }))
        .filter((c) => c.id);
      setInviteCompanies(normalized);
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteOpen, showCompanyColumn, token, apiV1]);

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !apiV1) return;
    setInviteLoading(true);
    setInviteError("");
    try {
      const result = await sendInviteForEmail(
        inviteEmail,
        showCompanyColumn ? inviteCompanyId : undefined,
        showCompanyColumn ? inviteInvitedRole : undefined,
      );
      if (!result.ok) {
        setInviteError(result.message);
        toast.error("Invite failed", result.message);
        return;
      }
      toast.success("User invited successfully");
      void refreshMembersAfterInvite();
      closeInviteModal();
    } catch {
      const msg = "Unable to connect. Try again later.";
      setInviteError(msg);
      toast.error("Invite failed", msg);
    } finally {
      setInviteLoading(false);
    }
  }

  if (!token) {
    return (
      <section className="um_page">
        <h2 className="um_title um_title_with_icon">
          <Users className="um_title_icon" size={26} strokeWidth={1.75} aria-hidden />
          Members
        </h2>
        <div className="um_panel">
          <p className="um_hint">
            Sign in to view user details.{" "}
            <Link
              to="/signin"
              style={{ color: "var(--main-auth-button-color, #2563eb)" }}
            >
              Go to sign in
            </Link>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="um_page">
      <div className="um_members_header_block">
        <div className="um_header_row">
          <h2 className="um_title um_title_with_icon">
            <Users className="um_title_icon" size={26} strokeWidth={1.75} aria-hidden />
            Members
          </h2>
          <button
            type="button"
            className="um_btn_primary"
            onClick={openInviteModal}
          >
            <UserPlus size={18} aria-hidden />
            Invite Member
          </button>
        </div>
      </div>

      <div className="um_members_tabs_outer">
        <div
          className="um_members_tabs_row"
          role="tablist"
          aria-label="Members sections"
        >
          <button
            type="button"
            id="um-members-tab-users"
            role="tab"
            aria-selected={membersTab === "users"}
            aria-controls="um-members-panel-users"
            className={`um_members_tab${
              membersTab === "users" ? " um_members_tab_active" : ""
            }`}
            onClick={() => setMembersTab("users")}
          >
            <Users size={18} strokeWidth={1.75} aria-hidden />
            <span>Users &amp; Roles</span>
          </button>
          <button
            type="button"
            id="um-members-tab-general"
            role="tab"
            aria-selected={membersTab === "general"}
            aria-controls="um-members-panel-general"
            className={`um_members_tab${
              membersTab === "general" ? " um_members_tab_active" : ""
            }`}
            onClick={() => setMembersTab("general")}
          >
            <Info size={18} strokeWidth={1.75} aria-hidden />
            <span>General Info</span>
          </button>
        </div>
      </div>

      <div className="um_members_tab_content">
      <div
        className="um_panel um_members_tab_panel"
        id="um-members-panel-users"
        role="tabpanel"
        aria-labelledby="um-members-tab-users"
        hidden={membersTab !== "users"}
      >
        <div className="um_toolbar">
          <div className="um_search_wrap">
            <Search className="um_search_icon" size={18} aria-hidden />
            <input
              type="search"
              className="um_search_input"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setToolbarNotice("");
              }}
              aria-label="Search members"
            />
          </div>
          <div className="um_toolbar_actions">
            <button
              type="button"
              className="um_btn_toolbar"
              onClick={handleSuspendAll}
            >
              <Ban size={18} strokeWidth={2} aria-hidden />
              Suspend All
            </button>
            <button
              type="button"
              className="um_toolbar_export_btn"
              onClick={exportMembersCsv}
            >
              <Download size={18} strokeWidth={2} aria-hidden />
              <span>Export all members</span>
            </button>
          </div>
        </div>
        {toolbarNotice ? (
          <p className="um_toolbar_notice" role="status">
            {toolbarNotice}
          </p>
        ) : null}
        {membersLoading ? (
          <p className="um_hint">Loading members…</p>
        ) : membersLoadError ? (
          <p className="um_msg_error" role="alert">
            {membersLoadError}
          </p>
        ) : memberRows.length === 0 ? (
          <p className="um_hint">No members found.</p>
        ) : filteredRows.length === 0 ? (
          <p className="um_hint">No members match your search.</p>
        ) : (
          <div className="um_table_wrap">
            <table className="um_table um_table_sortable um_table_members">
              <thead>
                <tr>
                  {sortColumns.map(({ key, label }) => {
                    const active = sortKey === key;
                    const ariaSort = active
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none";
                    return (
                      <th key={key} scope="col" aria-sort={ariaSort}>
                        <button
                          type="button"
                          className="um_sort_header_ctl"
                          onClick={() => toggleSort(key)}
                          aria-label={
                            active
                              ? `${label}, sorted ${sortDir === "asc" ? "ascending" : "descending"}. Click to reverse.`
                              : `Sort by ${label}`
                          }
                        >
                          <span className="um_sort_header_label">{label}</span>
                          {active ? (
                            sortDir === "asc" ? (
                              <ArrowUp
                                size={14}
                                className="um_sort_header_icon"
                                aria-hidden
                              />
                            ) : (
                              <ArrowDown
                                size={14}
                                className="um_sort_header_icon"
                                aria-hidden
                              />
                            )
                          ) : (
                            <ArrowUpDown
                              size={14}
                              className="um_sort_header_icon um_sort_header_icon_idle"
                              aria-hidden
                            />
                          )}
                        </button>
                      </th>
                    );
                  })}
                  <th scope="col" className="um_th_actions">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {membersPaginatedRows.map((row, i) => {
                  const globalIndex =
                    (membersPageSafe - 1) * membersPageSize + i;
                  const rowId = rowStableId(row, globalIndex);
                  const initials = initialsFromRow(row);
                  const usernameLabel = formatMemberUsername(row.username);
                  const rawEmail = String(row.email ?? "").trim();
                  const email = formatValue(row.email);
                  const menuOpen = actionMenuRowId === rowId;
                  const rowUserStatus = userStatusForUi(row);
                  const rowAccountStatus = accountStatusForUi(row);
                  return (
                    <tr key={rowId}>
                      <td className="um_td_user">
                        <div className="um_user_cell">
                          <div className="um_user_avatar_ring" aria-hidden>
                            <span className="um_user_initials">
                              {initials}
                            </span>
                          </div>
                          <div className="um_user_meta">
                            <span
                              className={`um_user_meta_username${
                                usernameLabel === "—"
                                  ? " um_user_meta_username--placeholder"
                                  : ""
                              }`}
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
                              <span className="um_user_meta_email">{email}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      {showCompanyColumn ? (
                        <td>{companyCellValue(row)}</td>
                      ) : null}
                      <td>
                        <UserRoleBadge row={row} />
                      </td>
                      <td>
                        <StatusWithDot {...rowUserStatus} />
                      </td>
                      <td>
                        <StatusWithDot {...rowAccountStatus} />
                      </td>
                      <td className="um_td_actions">
                        <div className="um_kebab_root">
                          <button
                            type="button"
                            className="um_kebab_trigger"
                            aria-expanded={menuOpen}
                            aria-haspopup="menu"
                            aria-label={`Actions for ${usernameLabel !== "—" ? usernameLabel : rawEmail || email}`}
                            ref={
                              menuOpen
                                ? (el) => {
                                    kebabTriggerRef.current = el;
                                  }
                                : undefined
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setActionMenuRowId((current) => {
                                if (current === rowId) {
                                  setActionMenuRow(null);
                                  setMenuPos(null);
                                  return null;
                                }
                                setActionMenuRow(row);
                                return rowId;
                              });
                            }}
                          >
                            <MoreHorizontal size={18} aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <DataTablePagination
              page={membersPageSafe}
              pageSize={membersPageSize}
              totalItems={sortedRows.length}
              onPageChange={setMembersPage}
              onPageSizeChange={setMembersPageSize}
              ariaLabel="Members table pagination"
            />
          </div>
        )}
      </div>

      <div
        className="um_panel um_members_tab_panel"
        id="um-members-panel-general"
        role="tabpanel"
        aria-labelledby="um-members-tab-general"
        hidden={membersTab !== "general"}
      >
        <MembersRoleInfoPanel />
      </div>
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
                    setViewRow(openMenuContext.row);
                    closeActionMenu();
                  }}
                >
                  <Eye className="um_kebab_menuitem_icon" size={16} strokeWidth={2} aria-hidden />
                  View
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="um_kebab_menuitem"
                  disabled={memberInvitePending(openMenuContext.row)}
                  onClick={() => {
                    closeActionMenu();
                    openEditMember(openMenuContext.row);
                  }}
                >
                  <Pencil className="um_kebab_menuitem_icon" size={16} strokeWidth={2} aria-hidden />
                  Edit
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="um_kebab_menuitem"
                  disabled={memberInvitePending(openMenuContext.row)}
                  onClick={() => {
                    closeActionMenu();
                    openSuspendMember(openMenuContext.row);
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
                  disabled={reinviteBusyId === openMenuContext.rowId}
                  onClick={() =>
                    void reinviteRow(
                      openMenuContext.row,
                      openMenuContext.rowId,
                    )
                  }
                >
                  <Mail className="um_kebab_menuitem_icon" size={16} strokeWidth={2} aria-hidden />
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
                  <Upload className="um_kebab_menuitem_icon" size={16} strokeWidth={2} aria-hidden />
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
            if (e.target === e.currentTarget) setViewRow(null);
          }}
        >
          <div
            className="um_modal um_modal_view"
            role="dialog"
            aria-modal="true"
            aria-labelledby="um-view-title"
          >
            <div className="um_modal_head">
              <h3 id="um-view-title" className="um_modal_title">
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
                value={
                  showCompanyColumn
                    ? companyCellValue(viewRow)
                    : formatValue(viewRow.companyName)
                }
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
            if (e.target === e.currentTarget && !editSaving) closeEditMember();
          }}
        >
          <div
            className="um_modal um_modal_view"
            role="dialog"
            aria-modal="true"
            aria-labelledby="um-edit-member-title"
          >
            <div className="um_modal_head">
              <h3 id="um-edit-member-title" className="um_modal_title">
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
                    htmlFor="um-edit-member-role"
                    className="um_field_label_row"
                  >
                    <UserCog className="um_field_label_icon" size={17} aria-hidden />
                    <span>Role</span>
                  </label>
                  <select
                    id="um-edit-member-role"
                    className="um_field_select"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    required
                    disabled={editSaving}
                  >
                    {editRoleSelectOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="um_field">
                  <label
                    htmlFor="um-edit-member-status"
                    className="um_field_label_row"
                  >
                    <Activity className="um_field_label_icon" size={17} aria-hidden />
                    <span>User Status</span>
                  </label>
                  <select
                    id="um-edit-member-status"
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
                  htmlFor="um-edit-member-reason"
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
                  id="um-edit-member-reason"
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
              closeSuspendMember();
          }}
        >
          <div
            className="um_modal um_modal_view"
            role="dialog"
            aria-modal="true"
            aria-labelledby="um-suspend-member-title"
          >
            <div className="um_modal_head">
              <h3 id="um-suspend-member-title" className="um_modal_title">
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
                  htmlFor="um-suspend-member-reason"
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
                  id="um-suspend-member-reason"
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

      {inviteOpen ? (
        <div
          className="um_modal_overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeInviteModal();
          }}
        >
          <div
            className="um_modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="um-invite-title"
          >
            <div className="um_modal_head">
              <h3 id="um-invite-title" className="um_modal_title">
                Invite member
              </h3>
              <button
                type="button"
                className="um_modal_close"
                aria-label="Close"
                onClick={closeInviteModal}
              >
                <X size={20} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <form onSubmit={submitInvite}>
              <div className="um_field">
                <label htmlFor="um-invite-email" className="um_field_label_row">
                  <Mail className="um_field_label_icon" size={17} aria-hidden />
                  <span>Email</span>
                </label>
                <input
                  id="um-invite-email"
                  type="email"
                  autoComplete="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  disabled={inviteLoading}
                />
              </div>
              {showCompanyColumn ? (
                <div className="um_field">
                  <label htmlFor="um-invite-company" className="um_field_label_row">
                    <Building2 className="um_field_label_icon" size={17} aria-hidden />
                    <span>Company</span>
                  </label>
                  <select
                    id="um-invite-company"
                    className="um_field_select"
                    value={inviteCompanyId}
                    onChange={(e) => setInviteCompanyId(e.target.value)}
                    required
                    disabled={inviteLoading || !!inviteCompaniesError}
                    aria-invalid={!!inviteCompaniesError}
                  >
                    <option value="">Select a company</option>
                    {inviteCompanies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {showCompanyColumn ? (
                <div className="um_field">
                  <label htmlFor="um-invite-role" className="um_field_label_row">
                    <UserCog className="um_field_label_icon" size={17} aria-hidden />
                    <span>Role</span>
                  </label>
                  <select
                    id="um-invite-role"
                    className="um_field_select"
                    value={inviteInvitedRole}
                    onChange={(e) => setInviteInvitedRole(e.target.value)}
                    required
                    disabled={inviteLoading}
                  >
                    {PLATFORM_INVITE_ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {inviteError ? (
                <p className="um_msg_error um_modal_form_error" role="alert">
                  {inviteError}
                </p>
              ) : null}
              {inviteCompaniesError ? (
                <p className="um_msg_error um_modal_form_error" role="alert">
                  {inviteCompaniesError}
                </p>
              ) : null}
              <div className="um_modal_actions">
                <button
                  type="button"
                  className="um_btn_secondary"
                  onClick={closeInviteModal}
                >
                  <X size={16} strokeWidth={2} aria-hidden />
                  Cancel
                </button>
                <button
                  type="submit"
                  className="um_btn_primary"
                  disabled={
                    inviteLoading ||
                    !inviteEmail.trim() ||
                    (showCompanyColumn &&
                      (!inviteCompanyId.trim() || !!inviteCompaniesError))
                  }
                >
                  <Send size={16} aria-hidden />
                  {inviteLoading ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
