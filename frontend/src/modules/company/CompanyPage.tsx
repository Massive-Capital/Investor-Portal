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
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  Building2,
  ClipboardList,
  Download,
  Eye,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Upload,
  Users,
  X,
} from "lucide-react";
import { DataTablePagination } from "../../common/components/DataTablePagination/DataTablePagination";
import { ViewReadonlyField } from "../../common/components/ViewReadonlyField";
import { toast } from "../../common/components/Toast";
import { getApiV1Base } from "../../common/utils/apiBaseUrl";
import {
  SESSION_BEARER_KEY,
  SESSION_USER_DETAILS_KEY,
} from "../../common/auth/sessionKeys";
import {
  canEditCompanyWorkspace,
  isPlatformAdmin,
} from "../../common/auth/roleUtils";
import { CompanyContactAttributesTab } from "./CompanyContactAttributesTab";
import { CompanyEmailSettingsTab } from "./CompanyEmailSettingsTab";
import { CompanyOfferingsPageTab } from "./CompanyOfferingsPageTab";
import { CompanySettingsTabPanel } from "./CompanySettingsTabPanel";
import "../usermanagement/user_management.css";
import "./company_page.css";

type CompanyPageTab =
  | "settings"
  | "email"
  | "contact"
  | "offerings"
  | "companies";

function readSessionCompanyName(): string {
  try {
    const raw = sessionStorage.getItem(SESSION_USER_DETAILS_KEY);
    if (!raw) return "";
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr) && arr[0] && typeof arr[0] === "object") {
      const o = arr[0] as Record<string, unknown>;
      return String(o.companyName ?? o.company_name ?? "").trim();
    }
  } catch {
    /* ignore */
  }
  return "";
}

type CompanyRow = {
  id: string;
  name: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  userCount?: number;
  dealCount?: number;
};

const COMPANY_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const COMPANY_AUDIT_ACTION_EDIT = "company_edit";
const COMPANY_AUDIT_ACTION_SUSPEND = "company_suspend";

function companyStatusValueForEdit(row: CompanyRow): string {
  const s = String(row.status ?? "active").trim().toLowerCase();
  if (s === "inactive" || s === "suspended") return "inactive";
  return "active";
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function companyStatusForUi(row: CompanyRow): { positive: boolean; label: string } {
  const raw = String(row.status ?? "active").trim().toLowerCase();
  if (raw === "active") return { positive: true, label: "Active" };
  if (raw === "inactive" || raw === "suspended") {
    return { positive: false, label: "Inactive" };
  }
  const label = raw
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return { positive: false, label: label || "—" };
}

function StatusWithDot({
  positive,
  label,
}: {
  positive: boolean;
  label: string;
}) {
  if (label === "—") {
    return <span className="um_status_muted">—</span>;
  }
  return (
    <span className="um_status_cell">
      <span
        className={
          positive
            ? "um_status_dot um_status_dot_active"
            : "um_status_dot um_status_dot_inactive"
        }
        aria-hidden
      />
      <span className="um_status_label">{label}</span>
    </span>
  );
}

type SortKey = "company" | "deals" | "users" | "status";

function sortValue(row: CompanyRow, key: SortKey): string | number {
  switch (key) {
    case "company":
      return row.name.toLowerCase();
    case "deals":
      return Number(row.dealCount ?? 0);
    case "users":
      return Number(row.userCount ?? 0);
    case "status":
      return companyStatusForUi(row).label.toLowerCase();
    default:
      return "";
  }
}

export type CompanyPageVariant = "default" | "customers";

type CompanyPageProps = {
  variant?: CompanyPageVariant;
};

export default function CompanyPage({ variant = "default" }: CompanyPageProps = {}) {
  const customersStandalone = variant === "customers";
  const apiV1 = getApiV1Base();
  const token = sessionStorage.getItem(SESSION_BEARER_KEY);
  const platformAdmin = isPlatformAdmin();
  const canEditWorkspace = canEditCompanyWorkspace();

  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("company");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [toolbarNotice, setToolbarNotice] = useState("");
  const [companyPageTab, setCompanyPageTab] = useState<CompanyPageTab>(() =>
    variant === "customers" && isPlatformAdmin() ? "companies" : "settings",
  );
  const [companiesPage, setCompaniesPage] = useState(1);
  const [companiesPageSize, setCompaniesPageSize] = useState(10);

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addErr, setAddErr] = useState("");
  const [addOk, setAddOk] = useState("");

  const [viewRow, setViewRow] = useState<CompanyRow | null>(null);
  const [editRow, setEditRow] = useState<CompanyRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [editReason, setEditReason] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editErr, setEditErr] = useState("");

  const [suspendRow, setSuspendRow] = useState<CompanyRow | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendSubmitting, setSuspendSubmitting] = useState(false);
  const [suspendErr, setSuspendErr] = useState("");

  const [actionMenuCompanyId, setActionMenuCompanyId] = useState<string | null>(
    null,
  );
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const kebabPortalRef = useRef<HTMLUListElement | null>(null);

  const loadCompanies = useCallback(async () => {
    if (!token || !apiV1) return;
    setLoadError("");
    try {
      const res = await fetch(`${apiV1}/companies`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => ({}))) as {
        companies?: CompanyRow[];
        message?: string;
      };
      if (!res.ok) {
        setLoadError(data.message || "Could not load companies");
        return;
      }
      const list = Array.isArray(data.companies) ? data.companies : [];
      setCompanies(
        list.map((c) => ({
          ...c,
          userCount:
            typeof c.userCount === "number" ? c.userCount : Number(c.userCount) || 0,
          dealCount:
            typeof c.dealCount === "number" ? c.dealCount : Number(c.dealCount) || 0,
          status: c.status ?? "active",
        })),
      );
    } catch {
      setLoadError("Unable to connect.");
    }
  }, [token, apiV1]);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  const sessionCompanyName = useMemo(
    () => (token ? readSessionCompanyName() : ""),
    [token],
  );

  const effectiveCompanyName = useMemo(() => {
    if (sessionCompanyName) return sessionCompanyName;
    if (companies.length > 0) return companies[0].name;
    return "Your company";
  }, [sessionCompanyName, companies]);

  const companyPageTabDefs = useMemo(() => {
    const tabs: { id: CompanyPageTab; label: string }[] = [
      { id: "settings", label: "Settings" },
      { id: "email", label: "Email settings" },
      { id: "contact", label: "Contact attributes" },
      { id: "offerings", label: "Offerings page" },
    ];
    return tabs;
  }, []);

  const activeCompanyPageTab = useMemo(() => {
    const allowed = new Set(companyPageTabDefs.map((t) => t.id));
    if (allowed.has(companyPageTab)) return companyPageTab;
    return "settings";
  }, [companyPageTabDefs, companyPageTab]);

  useEffect(() => {
    if (customersStandalone) return;
    const allowed = new Set(companyPageTabDefs.map((t) => t.id));
    if (!allowed.has(companyPageTab)) setCompanyPageTab("settings");
  }, [companyPageTabDefs, companyPageTab, customersStandalone]);

  useEffect(() => {
    if (customersStandalone && platformAdmin) setCompanyPageTab("companies");
  }, [customersStandalone, platformAdmin]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => {
      const st = companyStatusForUi(c).label.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        String(c.userCount ?? "").includes(q) ||
        String(c.dealCount ?? "").includes(q) ||
        st.includes(q)
      );
    });
  }, [companies, searchQuery]);

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), undefined, { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filteredRows, sortKey, sortDir]);

  useEffect(() => {
    setCompaniesPage(1);
  }, [searchQuery, sortKey, sortDir]);

  const companiesTableTotalPages = Math.max(
    1,
    Math.ceil(sortedRows.length / companiesPageSize),
  );

  useEffect(() => {
    if (companiesPage > companiesTableTotalPages) {
      setCompaniesPage(companiesTableTotalPages);
    }
  }, [companiesPage, companiesTableTotalPages]);

  const companiesPageSafe = Math.min(companiesPage, companiesTableTotalPages);

  const companiesPaginatedRows = useMemo(() => {
    const start = (companiesPageSafe - 1) * companiesPageSize;
    return sortedRows.slice(start, start + companiesPageSize);
  }, [sortedRows, companiesPageSafe, companiesPageSize]);

  const openMenuContext = useMemo(() => {
    if (!actionMenuCompanyId) return null;
    return sortedRows.find((c) => c.id === actionMenuCompanyId) ?? null;
  }, [actionMenuCompanyId, sortedRows]);

  const updateKebabMenuPosition = useCallback(() => {
    if (!actionMenuCompanyId) {
      setMenuPos(null);
      return;
    }
    const el = document.querySelector(
      `[data-cp-kebab-trigger="${CSS.escape(actionMenuCompanyId)}"]`,
    );
    if (!el || !(el instanceof HTMLElement)) {
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
  }, [actionMenuCompanyId]);

  useLayoutEffect(() => {
    if (!actionMenuCompanyId) {
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
  }, [actionMenuCompanyId, updateKebabMenuPosition]);

  useEffect(() => {
    if (actionMenuCompanyId == null) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      const root = document.querySelector(
        `[data-cp-kebab-root="${CSS.escape(actionMenuCompanyId)}"]`,
      );
      if (root?.contains(t)) return;
      if (kebabPortalRef.current?.contains(t)) return;
      setActionMenuCompanyId(null);
    };
    const tid = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
    }, 0);
    return () => {
      window.clearTimeout(tid);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [actionMenuCompanyId]);

  useEffect(() => {
    if (actionMenuCompanyId == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActionMenuCompanyId(null);
        setMenuPos(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [actionMenuCompanyId]);

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prevKey;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const sortColumns: { key: SortKey; label: string }[] = [
    { key: "company", label: "Company" },
    { key: "deals", label: "Deals" },
    { key: "users", label: "Users" },
    { key: "status", label: "Status" },
  ];

  function exportCompaniesCsv() {
    const headers = ["Company", "Deals", "Users", "Status", "Created"];
    const lines = [headers.map(escapeCsvCell).join(",")];
    for (const row of sortedRows) {
      lines.push(
        [
          row.name,
          String(row.dealCount ?? 0),
          String(row.userCount ?? 0),
          companyStatusForUi(row).label,
          row.createdAt
            ? new Date(row.createdAt).toISOString()
            : "—",
        ]
          .map(escapeCsvCell)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "companies.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Companies exported", "Saved as companies.csv");
  }

  function exportRowCsv(row: CompanyRow) {
    const headers = ["Company", "Deals", "Users", "Status", "Company ID"];
    const vals = [
      row.name,
      String(row.dealCount ?? 0),
      String(row.userCount ?? 0),
      companyStatusForUi(row).label,
      row.id,
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
    const safe = row.name.replace(/[^\w.-]+/g, "_").slice(0, 40);
    const filename = `company-${safe || row.id}.csv`;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setActionMenuCompanyId(null);
    setToolbarNotice("");
    toast.success("Company exported", `Saved as ${filename}`);
  }

  async function patchCompany(
    id: string,
    body: {
      name?: string;
      status?: string;
      reason: string;
      action: typeof COMPANY_AUDIT_ACTION_EDIT | typeof COMPANY_AUDIT_ACTION_SUSPEND;
    },
  ): Promise<{ ok: boolean; message: string }> {
    if (!token || !apiV1) {
      return { ok: false, message: "Not signed in." };
    }
    const res = await fetch(`${apiV1}/companies/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      return { ok: false, message: data.message || "Update failed." };
    }
    return { ok: true, message: data.message || "Updated." };
  }

  function openAddModal() {
    setAddOpen(true);
    setAddName("");
    setAddErr("");
    setAddOk("");
  }

  function closeAddModal() {
    setAddOpen(false);
    setAddSubmitting(false);
    setAddErr("");
    setAddOk("");
  }

  async function submitAddCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !apiV1 || !platformAdmin) return;
    setAddSubmitting(true);
    setAddErr("");
    setAddOk("");
    try {
      const res = await fetch(`${apiV1}/companies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: addName.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!res.ok) {
        const msg = data.message || "Could not create company";
        setAddErr(msg);
        toast.error("Could not create company", msg);
        return;
      }
      const okMsg = data.message || "Company created";
      setAddOk(okMsg);
      toast.success("Company created", okMsg);
      setAddName("");
      void loadCompanies();
      setTimeout(() => closeAddModal(), 800);
    } catch {
      const msg = "Unable to connect.";
      setAddErr(msg);
      toast.error("Could not create company", msg);
    } finally {
      setAddSubmitting(false);
    }
  }

  function closeEditModal() {
    setEditRow(null);
    setEditReason("");
    setEditErr("");
  }

  function openEdit(row: CompanyRow) {
    setEditRow(row);
    setEditName(row.name);
    setEditStatus(companyStatusValueForEdit(row));
    setEditReason("");
    setEditErr("");
  }

  function openSuspendModal(row: CompanyRow) {
    setSuspendRow(row);
    setSuspendReason("");
    setSuspendErr("");
  }

  function closeSuspendModal() {
    setSuspendRow(null);
    setSuspendReason("");
    setSuspendErr("");
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editRow || !token || !apiV1) return;
    const reason = editReason.trim();
    if (!reason) {
      setEditErr("Please enter a reason for this change.");
      return;
    }
    setEditSubmitting(true);
    setEditErr("");
    try {
      const result = await patchCompany(editRow.id, {
        name: editName.trim(),
        status: editStatus,
        reason,
        action: COMPANY_AUDIT_ACTION_EDIT,
      });
      if (!result.ok) {
        setEditErr(result.message);
        return;
      }
      closeEditModal();
      void loadCompanies();
      setToolbarNotice(result.message);
    } catch {
      setEditErr("Unable to connect.");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function submitSuspendCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!suspendRow || !token || !apiV1 || !platformAdmin) return;
    const reason = suspendReason.trim();
    if (!reason) {
      setSuspendErr("Please enter a reason for suspending this company.");
      return;
    }
    setSuspendSubmitting(true);
    setSuspendErr("");
    setToolbarNotice("");
    try {
      const result = await patchCompany(suspendRow.id, {
        status: "inactive",
        reason,
        action: COMPANY_AUDIT_ACTION_SUSPEND,
      });
      if (!result.ok) {
        setSuspendErr(result.message);
        toast.error("Could not suspend company", result.message);
        return;
      }
      closeSuspendModal();
      void loadCompanies();
      toast.success("Company suspended", result.message);
    } catch {
      const msg = "Unable to connect.";
      setSuspendErr(msg);
      toast.error("Could not suspend company", msg);
    } finally {
      setSuspendSubmitting(false);
    }
  }

  if (!token) {
    return (
      <section className="um_page company_page">
        <h2 className="um_title um_title_with_icon">
          <Building2 className="um_title_icon" size={26} strokeWidth={1.75} aria-hidden />
          {customersStandalone ? "Customers" : "Company"}
        </h2>
        <div className="um_panel">
          <p className="um_hint">
            <Link
              to="/signin"
              style={{ color: "var(--main-auth-button-color, #2563eb)" }}
            >
              Sign in
            </Link>{" "}
            {customersStandalone ? "to view customers." : "to view companies."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="um_page company_page">
      <div className="um_members_header_block">
        <div className="um_header_row">
          <h2 className="um_title um_title_with_icon">
            <Building2 className="um_title_icon" size={26} strokeWidth={1.75} aria-hidden />
            {customersStandalone ? "Customers" : "Company"}
          </h2>
          {platformAdmin && customersStandalone ? (
            <button
              type="button"
              className="um_btn_primary"
              onClick={openAddModal}
            >
              <Plus size={18} aria-hidden />
              Add company
            </button>
          ) : null}
        </div>
      </div>

      {!customersStandalone ? (
        <div className="um_members_tabs_outer">
          <div
            className="um_members_tabs_row"
            role="tablist"
            aria-label="Company page sections"
          >
            {companyPageTabDefs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`cp-page-tab-${tab.id}`}
                aria-selected={activeCompanyPageTab === tab.id}
                aria-controls={`cp-page-panel-${tab.id}`}
                className={`um_members_tab${
                  activeCompanyPageTab === tab.id ? " um_members_tab_active" : ""
                }`}
                onClick={() => setCompanyPageTab(tab.id)}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="um_members_tab_content">
        {!customersStandalone ? (
          <>
            <div
              className="um_panel um_members_tab_panel"
              id="cp-page-panel-settings"
              role="tabpanel"
              aria-labelledby="cp-page-tab-settings"
              hidden={activeCompanyPageTab !== "settings"}
            >
              <CompanySettingsTabPanel
                initialCompanyName={effectiveCompanyName}
                readOnly={!canEditWorkspace}
              />
            </div>

            <div
              className="um_panel um_members_tab_panel"
              id="cp-page-panel-email"
              role="tabpanel"
              aria-labelledby="cp-page-tab-email"
              hidden={activeCompanyPageTab !== "email"}
            >
              <CompanyEmailSettingsTab
                companyName={effectiveCompanyName}
                readOnly={!canEditWorkspace}
              />
            </div>

            <div
              className="um_panel um_members_tab_panel"
              id="cp-page-panel-contact"
              role="tabpanel"
              aria-labelledby="cp-page-tab-contact"
              hidden={activeCompanyPageTab !== "contact"}
            >
              <CompanyContactAttributesTab
                companyName={effectiveCompanyName}
                readOnly={!canEditWorkspace}
              />
            </div>

            <div
              className="um_panel um_members_tab_panel"
              id="cp-page-panel-offerings"
              role="tabpanel"
              aria-labelledby="cp-page-tab-offerings"
              hidden={activeCompanyPageTab !== "offerings"}
            >
              <CompanyOfferingsPageTab
                companyName={effectiveCompanyName}
                readOnly={!canEditWorkspace}
              />
            </div>
          </>
        ) : null}

        {customersStandalone && !platformAdmin ? (
          <div className="um_panel um_members_tab_panel">
            <p className="um_hint">
              The customer company directory is available to platform administrators. Use{" "}
              <Link to="/settings" style={{ color: "var(--main-auth-button-color, #2563eb)" }}>
                Settings
              </Link>{" "}
              for your organization profile.
            </p>
          </div>
        ) : null}

        {platformAdmin && customersStandalone ? (
          <div
            className="um_panel um_members_tab_panel cp_companies_tab_panel"
            id="cp-page-panel-companies"
            role="tabpanel"
            aria-label="Customer companies"
            hidden={false}
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
                  aria-label="Search companies"
                />
              </div>
              <div className="um_toolbar_actions">
                <button
                  type="button"
                  className="um_btn_toolbar"
                  onClick={() =>
                    setToolbarNotice("Bulk suspend for companies is not available yet.")
                  }
                >
                  <Ban size={18} strokeWidth={2} aria-hidden />
                  Suspend all
                </button>
                <button
                  type="button"
                  className="um_toolbar_export_btn"
                  onClick={exportCompaniesCsv}
                >
                  <Download size={18} strokeWidth={2} aria-hidden />
                  <span>Export all companies</span>
                </button>
              </div>
            </div>
            {toolbarNotice ? (
              <p className="um_toolbar_notice" role="status">
                {toolbarNotice}
              </p>
            ) : null}
            {loadError ? (
              <p className="um_msg_error">{loadError}</p>
            ) : companies.length === 0 ? (
              <p className="um_hint">No companies yet.</p>
            ) : filteredRows.length === 0 ? (
              <p className="um_hint">No companies match your search.</p>
            ) : (
              <>
                <div className="um_table_wrap">
                  <table className="um_table um_table_sortable">
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
                      {companiesPaginatedRows.map((row) => {
                        const menuOpen = actionMenuCompanyId === row.id;
                        const st = companyStatusForUi(row);
                        return (
                          <tr key={row.id}>
                            <td className="um_td_user">
                              <div className="um_user_cell">
                                <div
                                  className="um_user_avatar_ring cp_company_avatar"
                                  aria-hidden
                                >
                                  <Building2 size={18} strokeWidth={2} />
                                </div>
                                <div className="um_user_meta">
                                  <span className="um_user_meta_username">{row.name}</span>
                                </div>
                              </div>
                            </td>
                            <td>{row.dealCount ?? 0}</td>
                            <td>{row.userCount ?? 0}</td>
                            <td>
                              <StatusWithDot {...st} />
                            </td>
                            <td className="um_td_actions">
                              <div
                                className="um_kebab_root"
                                data-cp-kebab-root={row.id}
                              >
                                <button
                                  type="button"
                                  className="um_kebab_trigger"
                                  data-cp-kebab-trigger={row.id}
                                  aria-expanded={menuOpen}
                                  aria-haspopup="menu"
                                  aria-label={`Actions for ${row.name}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActionMenuCompanyId((id) =>
                                      id === row.id ? null : row.id,
                                    );
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
                </div>
                <DataTablePagination
                  page={companiesPageSafe}
                  pageSize={companiesPageSize}
                  totalItems={sortedRows.length}
                  onPageChange={setCompaniesPage}
                  onPageSizeChange={setCompaniesPageSize}
                  ariaLabel="Companies table pagination"
                />
              </>
            )}
          </div>
        ) : null}
      </div>

      {actionMenuCompanyId &&
      menuPos &&
      openMenuContext &&
      typeof document !== "undefined"
        ? createPortal(
            <ul
              ref={kebabPortalRef}
              className="um_kebab_menu um_kebab_menu--portal"
              role="menu"
              aria-label="Company actions"
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
                    setViewRow(openMenuContext);
                    setActionMenuCompanyId(null);
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
                  disabled={!platformAdmin}
                  onClick={() => {
                    setActionMenuCompanyId(null);
                    if (!platformAdmin) {
                      setToolbarNotice(
                        "Only platform administrators can edit a company.",
                      );
                      return;
                    }
                    openEdit(openMenuContext);
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
                  disabled={
                    !platformAdmin ||
                    suspendSubmitting ||
                    companyStatusForUi(openMenuContext).label !== "Active"
                  }
                  onClick={() => {
                    setActionMenuCompanyId(null);
                    if (!platformAdmin) {
                      setToolbarNotice(
                        "Only platform administrators can suspend a company.",
                      );
                      return;
                    }
                    openSuspendModal(openMenuContext);
                  }}
                >
                  <Ban className="um_kebab_menuitem_icon" size={16} strokeWidth={2} aria-hidden />
                  Suspend
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="um_kebab_menuitem"
                  onClick={() => exportRowCsv(openMenuContext)}
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
            className="um_modal um_modal_view cp_company_view_modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cp-view-title"
          >
            <div className="um_modal_head">
              <h3 id="cp-view-title" className="um_modal_title">
                Company details
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
            <div className="cp_view_shell cp_view_shell_single">
              <div className="cp_view_panel">
                <div className="um_view_grid">
                  <ViewReadonlyField
                    Icon={Building2}
                    label="Company name"
                    value={viewRow.name}
                  />
                  <ViewReadonlyField
                    Icon={Activity}
                    label="Status"
                    value={<StatusWithDot {...companyStatusForUi(viewRow)} />}
                  />
                  <ViewReadonlyField
                    Icon={Users}
                    label="Users"
                    value={String(viewRow.userCount ?? 0)}
                  />
                  <ViewReadonlyField
                    Icon={LayoutGrid}
                    label="Deals"
                    value={String(viewRow.dealCount ?? 0)}
                  />
                </div>
              </div>
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
            if (e.target === e.currentTarget && !editSubmitting) closeEditModal();
          }}
        >
          <div
            className="um_modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cp-edit-title"
          >
            <div className="um_modal_head">
              <h3 id="cp-edit-title" className="um_modal_title">
                Edit company
              </h3>
              <button
                type="button"
                className="um_modal_close"
                aria-label="Close"
                onClick={() => closeEditModal()}
                disabled={editSubmitting}
              >
                <X size={20} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <form onSubmit={submitEdit}>
              <div className="um_field">
                <label htmlFor="cp-edit-name" className="um_field_label_row">
                  <Building2 className="um_field_label_icon" size={17} aria-hidden />
                  <span>Company name</span>
                </label>
                <input
                  id="cp-edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  disabled={editSubmitting}
                />
              </div>
              <div className="um_field">
                <label htmlFor="cp-edit-status" className="um_field_label_row">
                  <Activity className="um_field_label_icon" size={17} aria-hidden />
                  <span>Status</span>
                </label>
                <select
                  id="cp-edit-status"
                  className="um_field_select"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  disabled={editSubmitting}
                >
                  {COMPANY_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="um_field">
                <label htmlFor="cp-edit-reason" className="um_field_label_row">
                  <ClipboardList
                    className="um_field_label_icon"
                    size={17}
                    aria-hidden
                  />
                  <span>Reason</span>
                </label>
                <textarea
                  id="cp-edit-reason"
                  className="um_field_textarea"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  rows={3}
                  required
                  disabled={editSubmitting}
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
                  onClick={() => closeEditModal()}
                  disabled={editSubmitting}
                >
                  <X size={16} strokeWidth={2} aria-hidden />
                  Cancel
                </button>
                <button
                  type="submit"
                  className="um_btn_primary"
                  disabled={
                    editSubmitting ||
                    !editName.trim() ||
                    !editReason.trim()
                  }
                >
                  <RefreshCw size={16} strokeWidth={2} aria-hidden />
                  {editSubmitting ? "Updating…" : "Update"}
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
            if (e.target === e.currentTarget && !suspendSubmitting)
              closeSuspendModal();
          }}
        >
          <div
            className="um_modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cp-suspend-title"
          >
            <div className="um_modal_head">
              <h3 id="cp-suspend-title" className="um_modal_title">
                Suspend company
              </h3>
              <button
                type="button"
                className="um_modal_close"
                aria-label="Close"
                disabled={suspendSubmitting}
                onClick={() => closeSuspendModal()}
              >
                <X size={20} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <p className="um_modal_desc">
              Are you sure you want to suspend{" "}
              <strong>{suspendRow.name}</strong>? The company will be marked inactive
              and affected users may lose access until it is reactivated.
            </p>
            <form onSubmit={submitSuspendCompany}>
              <div className="um_field">
                <label
                  htmlFor="cp-suspend-reason"
                  className="um_field_label_row"
                >
                  <Ban className="um_field_label_icon" size={17} aria-hidden />
                  <span>Reason</span>
                </label>
                <textarea
                  id="cp-suspend-reason"
                  className="um_field_textarea"
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  rows={3}
                  required
                  disabled={suspendSubmitting}
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
                  disabled={suspendSubmitting}
                  onClick={() => closeSuspendModal()}
                >
                  <X size={16} strokeWidth={2} aria-hidden />
                  Cancel
                </button>
                <button
                  type="submit"
                  className="um_btn_primary"
                  disabled={suspendSubmitting || !suspendReason.trim()}
                >
                  <Ban size={16} aria-hidden />
                  {suspendSubmitting ? "Suspending…" : "Suspend"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {addOpen ? (
        <div
          className="um_modal_overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeAddModal();
          }}
        >
          <div
            className="um_modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cp-add-title"
          >
            <div className="um_modal_head">
              <h3 id="cp-add-title" className="um_modal_title">
                Add company
              </h3>
              <button
                type="button"
                className="um_modal_close"
                aria-label="Close"
                onClick={closeAddModal}
                disabled={addSubmitting}
              >
                <X size={20} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <p className="um_modal_desc">
              Register an organization that can use the portal.
            </p>
            <form onSubmit={submitAddCompany}>
              {addOk ? (
                <p className="um_msg_ok" role="status">
                  {addOk}
                </p>
              ) : null}
              <div className="um_field">
                <label htmlFor="cp-add-name" className="um_field_label_row">
                  <Building2 className="um_field_label_icon" size={17} aria-hidden />
                  <span>Company name</span>
                </label>
                <input
                  id="cp-add-name"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Acme Capital LLC"
                  required
                  disabled={addSubmitting}
                />
              </div>
              {addErr ? (
                <p className="um_msg_error um_modal_form_error" role="alert">
                  {addErr}
                </p>
              ) : null}
              <div className="um_modal_actions">
                <button
                  type="button"
                  className="um_btn_secondary"
                  onClick={closeAddModal}
                  disabled={addSubmitting}
                >
                  <X size={16} strokeWidth={2} aria-hidden />
                  Cancel
                </button>
                <button
                  type="submit"
                  className="um_btn_primary"
                  disabled={addSubmitting || !addName.trim()}
                >
                  <Plus size={16} strokeWidth={2} aria-hidden />
                  {addSubmitting ? "Saving…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
