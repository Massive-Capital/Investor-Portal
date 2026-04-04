import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { fetchWorkspaceTabSettings } from "./companyWorkspaceSettingsApi";
import { useDebouncedWorkspaceTabPersist } from "./useWorkspaceTabPersistence";
import type { LucideIcon } from "lucide-react";
import {
  Ban,
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  CheckCircle2,
  ClipboardList,
  Copy,
  Image as ImageIcon,
  Images,
  MailCheck,
  MailX,
  Pencil,
  Settings,
  Trash2,
  Upload,
  Users,
  UserX,
  X,
} from "lucide-react";
import { CardRadioGroup } from "../../common/components/CardRadioGroup/CardRadioGroup";
import { toast } from "../../common/components/Toast";

function SettingsSectionHeading({
  id,
  Icon,
  children,
}: {
  id: string;
  Icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <h3 id={id} className="cp_settings_h3 cp_settings_h3_with_icon">
      <Icon className="cp_settings_h3_icon" size={20} strokeWidth={1.75} aria-hidden />
      <span>{children}</span>
    </h3>
  );
}

/** Field row label text only (icons only on section headings). */
function SettingsFieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="cp_settings_field_label um_view_field_head cp_settings_field_head">
      <span className="um_view_field_label">{children}</span>
    </div>
  );
}

function SettingsFieldEditActions({
  readOnly,
  editing,
  saveLabel = "Save",
  editAriaLabel = "Edit",
  onEdit,
  onSave,
  onCancel,
}: {
  readOnly?: boolean;
  editing: boolean;
  saveLabel?: string;
  editAriaLabel?: string;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (readOnly) return null;
  if (editing) {
    return (
      <>
        <button type="button" className="um_btn_primary" onClick={onSave}>
          <Check size={16} strokeWidth={2} aria-hidden />
          {saveLabel}
        </button>
        <button type="button" className="um_btn_secondary" onClick={onCancel}>
          <X size={16} strokeWidth={2} aria-hidden />
          Cancel
        </button>
      </>
    );
  }
  return (
    <button
      type="button"
      className="um_btn_secondary cp_settings_edit_btn"
      aria-label={editAriaLabel}
      onClick={onEdit}
    >
      <Pencil size={16} strokeWidth={2} aria-hidden />
      Edit
    </button>
  );
}

const DEFAULT_DISTRIBUTION_TYPES = [
  "Individual",
  "LLC, corp, partnership, trust, solo 401(k), or checkbook IRA",
  "Joint tenancy",
  "Custodian IRA or custodian based 401(k)",
] as const;

function portalHostFromCompanyName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 48);
  return slug ? `invest.${slug}.capital` : "invest.yourcompany.com";
}

type Props = {
  initialCompanyName: string;
  /** When true, mutating controls are disabled (company member / view-only). */
  readOnly?: boolean;
  /** When set, registration / deal settings are loaded and saved per organization. */
  workspaceCompanyId?: string;
  /** After a successful name save: update session / directory so headers and other tabs match. */
  onCompanyDisplayNamePersisted?: (name: string) => void;
};

export function CompanySettingsTabPanel({
  initialCompanyName,
  readOnly = false,
  workspaceCompanyId,
  onCompanyDisplayNamePersisted,
}: Props) {
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(initialCompanyName);
  const prevInitialNameRef = useRef(initialCompanyName);

  const [qualificationEnabled, setQualificationEnabled] = useState(false);
  const [offeringsMode, setOfferingsMode] = useState("506c");
  const [emailVerifyBeforeInvest, setEmailVerifyBeforeInvest] = useState(true);
  const [primaryMemberInFunnel, setPrimaryMemberInFunnel] = useState(true);
  const [distributionTypes, setDistributionTypes] = useState<string[]>([
    ...DEFAULT_DISTRIBUTION_TYPES,
  ]);
  const [distributionDropdownOpen, setDistributionDropdownOpen] = useState(false);
  const distributionDropdownRef = useRef<HTMLDivElement>(null);

  const [editQualification, setEditQualification] = useState(false);
  const [qualDraft, setQualDraft] = useState(false);
  const [editOfferings, setEditOfferings] = useState(false);
  const [offeringsDraft, setOfferingsDraft] = useState("506c");
  const [editEmailVerify, setEditEmailVerify] = useState(false);
  const [emailVerifyDraft, setEmailVerifyDraft] = useState(true);
  const [editPrimaryMember, setEditPrimaryMember] = useState(false);
  const [primaryMemberDraft, setPrimaryMemberDraft] = useState(true);
  const [editDistribution, setEditDistribution] = useState(false);
  const [distributionDraft, setDistributionDraft] = useState<string[]>([]);
  const [editLogo, setEditLogo] = useState(false);
  const [editBg, setEditBg] = useState(false);
  const [editLogoIcon, setEditLogoIcon] = useState(false);

  const [settingsHydrated, setSettingsHydrated] = useState(!workspaceCompanyId);

  useEffect(() => {
    if (!workspaceCompanyId) {
      setSettingsHydrated(true);
      return;
    }
    let cancelled = false;
    setSettingsHydrated(false);
    void (async () => {
      const { ok, payload: p } = await fetchWorkspaceTabSettings(
        workspaceCompanyId,
        "settings",
      );
      if (cancelled) return;
      if (ok) {
        if (typeof p.qualificationEnabled === "boolean") {
          setQualificationEnabled(p.qualificationEnabled);
        }
        if (
          typeof p.offeringsMode === "string" &&
          ["506c", "all", "506b"].includes(p.offeringsMode)
        ) {
          setOfferingsMode(p.offeringsMode);
        }
        if (typeof p.emailVerifyBeforeInvest === "boolean") {
          setEmailVerifyBeforeInvest(p.emailVerifyBeforeInvest);
        }
        if (typeof p.primaryMemberInFunnel === "boolean") {
          setPrimaryMemberInFunnel(p.primaryMemberInFunnel);
        }
        if (Array.isArray(p.distributionTypes)) {
          const next = p.distributionTypes.filter(
            (x): x is string => typeof x === "string",
          );
          if (next.length > 0) {
            setDistributionTypes(next);
          }
        }
      }
      setSettingsHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceCompanyId]);

  const settingsPayload = useMemo(
    () => ({
      qualificationEnabled,
      offeringsMode,
      emailVerifyBeforeInvest,
      primaryMemberInFunnel,
      distributionTypes,
    }),
    [
      qualificationEnabled,
      offeringsMode,
      emailVerifyBeforeInvest,
      primaryMemberInFunnel,
      distributionTypes,
    ],
  );

  useDebouncedWorkspaceTabPersist(
    workspaceCompanyId,
    "settings",
    readOnly,
    settingsHydrated,
    settingsPayload,
  );

  /* Sync from parent only when `initialCompanyName` actually changes — not when `editingName`
   * toggles (Save used to reset the field back to the stale prop). */
  useEffect(() => {
    if (prevInitialNameRef.current === initialCompanyName) return;
    prevInitialNameRef.current = initialCompanyName;
    setCompanyName(initialCompanyName);
    if (!editingName) {
      setNameDraft(initialCompanyName);
    }
  }, [initialCompanyName, editingName]);

  useEffect(() => {
    if (!readOnly) return;
    setEditingName(false);
    setNameDraft(companyName);
    setEditQualification(false);
    setEditOfferings(false);
    setEditEmailVerify(false);
    setEditPrimaryMember(false);
    setEditDistribution(false);
    setEditLogo(false);
    setEditBg(false);
    setEditLogoIcon(false);
    setDistributionDropdownOpen(false);
  }, [readOnly, companyName]);

  const portalHost = useMemo(
    () => portalHostFromCompanyName(companyName),
    [companyName],
  );

  const distributionTypesForUi = editDistribution
    ? distributionDraft
    : distributionTypes;

  const distributionAllSelected = useMemo(
    () =>
      distributionTypesForUi.length === DEFAULT_DISTRIBUTION_TYPES.length &&
      DEFAULT_DISTRIBUTION_TYPES.every((t) => distributionTypesForUi.includes(t)),
    [distributionTypesForUi],
  );

  const distributionSummary = useMemo(() => {
    if (distributionTypesForUi.length === 0) {
      return "Select profile types…";
    }
    if (distributionAllSelected) {
      return "All profile types";
    }
    if (distributionTypesForUi.length === 1) {
      return distributionTypesForUi[0] ?? "";
    }
    return `${distributionTypesForUi.length} profile types selected`;
  }, [distributionAllSelected, distributionTypesForUi]);

  useEffect(() => {
    if (!distributionDropdownOpen) return;
    function onPointerDown(e: PointerEvent) {
      const root = distributionDropdownRef.current;
      if (!root || !(e.target instanceof Node) || root.contains(e.target)) {
        return;
      }
      setDistributionDropdownOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDistributionDropdownOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [distributionDropdownOpen]);

  useEffect(() => {
    if (!editDistribution) setDistributionDropdownOpen(false);
  }, [editDistribution]);

  async function copyPortalLink() {
    try {
      await navigator.clipboard.writeText(portalHost);
      toast.success("Copied", "Portal link copied to clipboard.");
    } catch {
      toast.error("Copy failed", "Could not copy to clipboard.");
    }
  }

  return (
    <div className="cp_settings_root">
      <section className="cp_settings_section" aria-labelledby="cp-gen-settings">
        <SettingsSectionHeading id="cp-gen-settings" Icon={Settings}>
          General settings
        </SettingsSectionHeading>
        <div className="cp_settings_row cp_settings_row_general">
          <div className="cp_settings_label_col cp_settings_label_col_general">
            <SettingsFieldLabel>Company name</SettingsFieldLabel>
          </div>
          <div className="cp_settings_control cp_settings_control_general">
            <div className="cp_settings_value_row cp_settings_name_edit_row">
              <input
                type="text"
                className="cp_settings_pill_input_field"
                value={editingName ? nameDraft : companyName}
                disabled={readOnly || !editingName}
                onChange={(e) => setNameDraft(e.target.value)}
                aria-label="Company name"
              />
              <SettingsFieldEditActions
                readOnly={readOnly}
                editing={editingName}
                editAriaLabel="Edit company name"
                onEdit={() => {
                  setNameDraft(companyName);
                  setEditingName(true);
                }}
                onSave={() => {
                  const next = nameDraft.trim() || companyName;
                  setCompanyName(next);
                  setNameDraft(next);
                  setEditingName(false);
                  onCompanyDisplayNamePersisted?.(next);
                  toast.success("Saved", "Company name updated.");
                }}
                onCancel={() => {
                  setNameDraft(companyName);
                  setEditingName(false);
                }}
              />
            </div>
          </div>
        </div>
        <div className="cp_settings_row cp_settings_row_spaced cp_settings_row_general">
          <div className="cp_settings_label_col cp_settings_label_col_general">
            <SettingsFieldLabel>Company portal link</SettingsFieldLabel>
          </div>
          <div className="cp_settings_control cp_settings_control_general">
            <div className="cp_settings_value_row">
              <div className="um_view_field_box cp_settings_readonly_pill cp_settings_portal_mono">
                {portalHost}
              </div>
              <button
                type="button"
                className="um_btn_secondary"
                onClick={() => void copyPortalLink()}
              >
                <Copy size={16} strokeWidth={2} aria-hidden />
                Copy to clipboard
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="cp_settings_section" aria-labelledby="cp-reg-settings">
        <SettingsSectionHeading id="cp-reg-settings" Icon={ClipboardList}>
          Registration settings
        </SettingsSectionHeading>
        <div className="cp_settings_row">
          <div className="cp_settings_label_col">
            <SettingsFieldLabel>Investor qualification form</SettingsFieldLabel>
          </div>
          <div className="cp_settings_control">
            <div className="cp_settings_value_row">
              <div className="cp_settings_edit_field_block">
                <CardRadioGroup
                  name="cp-qual"
                  value={
                    (editQualification ? qualDraft : qualificationEnabled)
                      ? "enabled"
                      : "disabled"
                  }
                  onChange={(v) => setQualDraft(v === "enabled")}
                  ariaLabel="Investor qualification form"
                  disabled={readOnly || !editQualification}
                  options={[
                    { value: "enabled", label: "Enabled", icon: CheckCircle2 },
                    { value: "disabled", label: "Disabled", icon: Ban },
                  ]}
                />
                <button
                  type="button"
                  className="cp_btn_customize"
                  disabled={readOnly || !editQualification}
                >
                  <Pencil size={16} strokeWidth={2} aria-hidden />
                  Customize qualification form
                </button>
              </div>
              <SettingsFieldEditActions
                readOnly={readOnly}
                editing={editQualification}
                editAriaLabel="Edit investor qualification form"
                onEdit={() => {
                  setQualDraft(qualificationEnabled);
                  setEditQualification(true);
                }}
                onSave={() => {
                  setQualificationEnabled(qualDraft);
                  setEditQualification(false);
                  toast.success("Saved", "Investor qualification form setting updated.");
                }}
                onCancel={() => setEditQualification(false)}
              />
            </div>
          </div>
        </div>
        <div className="cp_settings_row cp_settings_row_spaced">
          <div className="cp_settings_label_col">
            <SettingsFieldLabel>Automatically show offerings</SettingsFieldLabel>
          </div>
          <div className="cp_settings_control">
            <div className="cp_settings_value_row">
              <select
                className="um_field_select cp_settings_select cp_settings_input_pill"
                value={editOfferings ? offeringsDraft : offeringsMode}
                disabled={readOnly || !editOfferings}
                onChange={(e) => setOfferingsDraft(e.target.value)}
                aria-label="Automatically show offerings"
              >
                <option value="506c">Show only 506c offerings</option>
                <option value="all">Show all offerings</option>
                <option value="506b">Show only 506(b) offerings</option>
              </select>
              <SettingsFieldEditActions
                readOnly={readOnly}
                editing={editOfferings}
                editAriaLabel="Edit automatically show offerings"
                onEdit={() => {
                  setOfferingsDraft(offeringsMode);
                  setEditOfferings(true);
                }}
                onSave={() => {
                  setOfferingsMode(offeringsDraft);
                  setEditOfferings(false);
                  toast.success("Saved", "Offering visibility updated.");
                }}
                onCancel={() => setEditOfferings(false)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="cp_settings_section" aria-labelledby="cp-deal-settings">
        <SettingsSectionHeading id="cp-deal-settings" Icon={Briefcase}>
          Global deal settings
        </SettingsSectionHeading>
        <div className="cp_settings_row">
          <div className="cp_settings_label_col">
            <SettingsFieldLabel>Require email verification before investing</SettingsFieldLabel>
          </div>
          <div className="cp_settings_control">
            <div className="cp_settings_value_row">
              <div className="cp_settings_edit_field_block">
                <CardRadioGroup
                  name="cp-email-verify"
                  value={
                    (editEmailVerify ? emailVerifyDraft : emailVerifyBeforeInvest)
                      ? "yes"
                      : "no"
                  }
                  onChange={(v) => setEmailVerifyDraft(v === "yes")}
                  ariaLabel="Require email verification before investing"
                  disabled={readOnly || !editEmailVerify}
                  options={[
                    { value: "yes", label: "Yes (most common)", icon: MailCheck },
                    { value: "no", label: "No", icon: MailX },
                  ]}
                />
              </div>
              <SettingsFieldEditActions
                readOnly={readOnly}
                editing={editEmailVerify}
                editAriaLabel="Edit email verification requirement"
                onEdit={() => {
                  setEmailVerifyDraft(emailVerifyBeforeInvest);
                  setEditEmailVerify(true);
                }}
                onSave={() => {
                  setEmailVerifyBeforeInvest(emailVerifyDraft);
                  setEditEmailVerify(false);
                  toast.success("Saved", "Email verification setting updated.");
                }}
                onCancel={() => setEditEmailVerify(false)}
              />
            </div>
          </div>
        </div>
        <div className="cp_settings_row cp_settings_row_spaced">
          <div className="cp_settings_label_col">
            <SettingsFieldLabel>
              Allow investors to select primary company member in investment funnel
            </SettingsFieldLabel>
          </div>
          <div className="cp_settings_control">
            <div className="cp_settings_value_row">
              <div className="cp_settings_edit_field_block">
                <CardRadioGroup
                  name="cp-primary-member"
                  value={
                    (editPrimaryMember ? primaryMemberDraft : primaryMemberInFunnel)
                      ? "yes"
                      : "no"
                  }
                  onChange={(v) => setPrimaryMemberDraft(v === "yes")}
                  ariaLabel="Allow investors to select primary company member in investment funnel"
                  disabled={readOnly || !editPrimaryMember}
                  options={[
                    { value: "yes", label: "Yes", icon: Users },
                    { value: "no", label: "No", icon: UserX },
                  ]}
                />
              </div>
              <SettingsFieldEditActions
                readOnly={readOnly}
                editing={editPrimaryMember}
                editAriaLabel="Edit primary company member in funnel"
                onEdit={() => {
                  setPrimaryMemberDraft(primaryMemberInFunnel);
                  setEditPrimaryMember(true);
                }}
                onSave={() => {
                  setPrimaryMemberInFunnel(primaryMemberDraft);
                  setEditPrimaryMember(false);
                  toast.success("Saved", "Primary member setting updated.");
                }}
                onCancel={() => setEditPrimaryMember(false)}
              />
            </div>
          </div>
        </div>
        <div className="cp_settings_row cp_settings_row_spaced">
          <div className="cp_settings_label_col">
            <SettingsFieldLabel>
              Allow these profile types to request distributions by checks
            </SettingsFieldLabel>
          </div>
          <div className="cp_settings_control">
            <div className="cp_settings_value_row">
              <div
                className="cp_distribution_select_root"
                ref={distributionDropdownRef}
              >
                <button
                  type="button"
                  id="cp-distribution-trigger"
                  className="cp_distribution_select_trigger"
                  aria-expanded={distributionDropdownOpen}
                  aria-haspopup="listbox"
                  aria-controls="cp-distribution-listbox"
                  disabled={readOnly || !editDistribution}
                  onClick={() =>
                    setDistributionDropdownOpen((open) => !open)
                  }
                >
                  <span className="cp_distribution_select_value">
                    {distributionSummary}
                  </span>
                  <ChevronDown
                    size={18}
                    strokeWidth={2}
                    className={
                      distributionDropdownOpen
                        ? "cp_distribution_select_chevron cp_distribution_select_chevron_open"
                        : "cp_distribution_select_chevron"
                    }
                    aria-hidden
                  />
                </button>
                {distributionDropdownOpen ? (
                  <div
                    id="cp-distribution-listbox"
                    className="cp_distribution_select_panel"
                    role="listbox"
                    aria-label="Profile types"
                    aria-multiselectable="true"
                  >
                    <label
                      className="cp_distribution_select_row cp_distribution_select_row_all"
                      role="option"
                      aria-selected={distributionAllSelected}
                    >
                      <input
                        type="checkbox"
                        className="cp_distribution_select_checkbox"
                        checked={distributionAllSelected}
                        disabled={readOnly || !editDistribution}
                        onChange={() => {
                          if (distributionAllSelected) {
                            setDistributionDraft([]);
                          } else {
                            setDistributionDraft([...DEFAULT_DISTRIBUTION_TYPES]);
                          }
                        }}
                      />
                      <span className="cp_distribution_select_row_label">
                        All profile types
                      </span>
                    </label>
                    <div className="cp_distribution_select_divider" aria-hidden />
                    {DEFAULT_DISTRIBUTION_TYPES.map((t) => {
                      const checked = distributionTypesForUi.includes(t);
                      return (
                        <label
                          key={t}
                          className="cp_distribution_select_row"
                          role="option"
                          aria-selected={checked}
                        >
                          <input
                            type="checkbox"
                            className="cp_distribution_select_checkbox"
                            checked={checked}
                            disabled={readOnly || !editDistribution}
                            onChange={() => {
                              setDistributionDraft((prev) =>
                                checked
                                  ? prev.filter((x) => x !== t)
                                  : [...prev, t],
                              );
                            }}
                          />
                          <span className="cp_distribution_select_row_label">
                            {t}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <SettingsFieldEditActions
                readOnly={readOnly}
                editing={editDistribution}
                editAriaLabel="Edit distribution profile types"
                onEdit={() => {
                  setDistributionDraft([...distributionTypes]);
                  setEditDistribution(true);
                }}
                onSave={() => {
                  setDistributionTypes([...distributionDraft]);
                  setEditDistribution(false);
                  setDistributionDropdownOpen(false);
                  toast.success("Saved", "Distribution profile types updated.");
                }}
                onCancel={() => {
                  setEditDistribution(false);
                  setDistributionDropdownOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="cp_settings_section" aria-labelledby="cp-logo">
        <SettingsSectionHeading id="cp-logo" Icon={ImageIcon}>
          Logo
        </SettingsSectionHeading>
        <div className="cp_settings_row cp_settings_row_media_column">
          <div className="cp_settings_label_col">
            <p className="cp_settings_help_in_row cp_settings_help_after_heading">
              Upload your logo to be displayed on your deals, offerings, and on your company
              portal.
            </p>
          </div>
          <div className="cp_settings_control">
            <div className="cp_settings_value_row cp_settings_media_edit_row">
              <div className="cp_media_card">
                <div className="cp_media_preview cp_media_preview_logo" aria-hidden>
                  <Building2 size={40} strokeWidth={1.5} />
                  <span className="cp_media_preview_label">{companyName}</span>
                </div>
                <div className="cp_media_actions">
                  <button
                    type="button"
                    className="um_btn_secondary"
                    disabled={readOnly || !editLogo}
                  >
                    <Upload size={16} strokeWidth={2} aria-hidden />
                    Upload new
                  </button>
                  <button
                    type="button"
                    className="um_btn_secondary"
                    disabled={readOnly || !editLogo}
                  >
                    <Trash2 size={16} strokeWidth={2} aria-hidden />
                    Delete
                  </button>
                </div>
              </div>
              <SettingsFieldEditActions
                readOnly={readOnly}
                editing={editLogo}
                editAriaLabel="Edit company logo"
                onEdit={() => setEditLogo(true)}
                onSave={() => setEditLogo(false)}
                onCancel={() => setEditLogo(false)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="cp_settings_section" aria-labelledby="cp-bg">
        <SettingsSectionHeading id="cp-bg" Icon={Images}>
          Background image
        </SettingsSectionHeading>
        <div className="cp_settings_row cp_settings_row_media_column">
          <div className="cp_settings_label_col">
            <p className="cp_settings_help_in_row cp_settings_help_after_heading">
              Optionally, upload a high resolution background image to be displayed on your
              company portal login.
            </p>
          </div>
          <div className="cp_settings_control">
            <div className="cp_settings_value_row cp_settings_media_edit_row">
              <div className="cp_media_card">
                <div
                  className="cp_media_preview cp_media_preview_bg"
                  role="img"
                  aria-label="Background preview placeholder"
                />
                <div className="cp_media_actions">
                  <button
                    type="button"
                    className="um_btn_secondary"
                    disabled={readOnly || !editBg}
                  >
                    <Upload size={16} strokeWidth={2} aria-hidden />
                    Upload new
                  </button>
                  <button
                    type="button"
                    className="um_btn_secondary"
                    disabled={readOnly || !editBg}
                  >
                    <Trash2 size={16} strokeWidth={2} aria-hidden />
                    Delete
                  </button>
                </div>
              </div>
              <SettingsFieldEditActions
                readOnly={readOnly}
                editing={editBg}
                editAriaLabel="Edit background image"
                onEdit={() => setEditBg(true)}
                onSave={() => setEditBg(false)}
                onCancel={() => setEditBg(false)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="cp_settings_section" aria-labelledby="cp-logo-icon">
        <SettingsSectionHeading id="cp-logo-icon" Icon={ImageIcon}>
          Logo icon
        </SettingsSectionHeading>
        <div className="cp_settings_row cp_settings_row_media_column">
          <div className="cp_settings_label_col">
            <p className="cp_settings_help_in_row cp_settings_help_after_heading">
              Upload a smaller version of your logo that will show in the browser tab and the
              collapsed version of the sidebar.
            </p>
          </div>
          <div className="cp_settings_control">
            <div className="cp_settings_value_row">
              <button
                type="button"
                className="um_btn_secondary"
                disabled={readOnly || !editLogoIcon}
              >
                <Upload size={16} strokeWidth={2} aria-hidden />
                Upload new
              </button>
              <SettingsFieldEditActions
                readOnly={readOnly}
                editing={editLogoIcon}
                editAriaLabel="Edit logo icon"
                onEdit={() => setEditLogoIcon(true)}
                onSave={() => setEditLogoIcon(false)}
                onCancel={() => setEditLogoIcon(false)}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
