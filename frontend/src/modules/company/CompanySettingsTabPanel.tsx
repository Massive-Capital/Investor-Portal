import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
};

export function CompanySettingsTabPanel({
  initialCompanyName,
  readOnly = false,
}: Props) {
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(initialCompanyName);

  const [qualificationEnabled, setQualificationEnabled] = useState(false);
  const [offeringsMode, setOfferingsMode] = useState("506c");
  const [emailVerifyBeforeInvest, setEmailVerifyBeforeInvest] = useState(true);
  const [primaryMemberInFunnel, setPrimaryMemberInFunnel] = useState(true);
  const [distributionTypes, setDistributionTypes] = useState<string[]>([
    ...DEFAULT_DISTRIBUTION_TYPES,
  ]);
  const [distributionDropdownOpen, setDistributionDropdownOpen] = useState(false);
  const distributionDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCompanyName(initialCompanyName);
    if (!editingName) setNameDraft(initialCompanyName);
  }, [initialCompanyName, editingName]);

  useEffect(() => {
    if (readOnly && editingName) {
      setEditingName(false);
      setNameDraft(companyName);
    }
  }, [readOnly, editingName, companyName]);

  useEffect(() => {
    if (readOnly) setDistributionDropdownOpen(false);
  }, [readOnly]);

  const portalHost = useMemo(
    () => portalHostFromCompanyName(companyName),
    [companyName],
  );

  const distributionAllSelected = useMemo(
    () =>
      distributionTypes.length === DEFAULT_DISTRIBUTION_TYPES.length &&
      DEFAULT_DISTRIBUTION_TYPES.every((t) => distributionTypes.includes(t)),
    [distributionTypes],
  );

  const distributionSummary = useMemo(() => {
    if (distributionTypes.length === 0) {
      return "Select profile types…";
    }
    if (distributionAllSelected) {
      return "All profile types";
    }
    if (distributionTypes.length === 1) {
      return distributionTypes[0] ?? "";
    }
    return `${distributionTypes.length} profile types selected`;
  }, [distributionAllSelected, distributionTypes]);

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
            {editingName ? (
              <div className="cp_settings_value_row cp_settings_name_edit_row">
                <div className="cp_settings_pill_input_wrap">
                  <input
                    type="text"
                    className="cp_settings_pill_input_field"
                    value={nameDraft}
                    disabled={readOnly}
                    onChange={(e) => setNameDraft(e.target.value)}
                    aria-label="Company name"
                  />
                </div>
                <button
                  type="button"
                  className="um_btn_primary"
                  disabled={readOnly}
                  onClick={() => {
                    const next = nameDraft.trim() || companyName;
                    setCompanyName(next);
                    setNameDraft(next);
                    setEditingName(false);
                    toast.success("Saved", "Company name updated locally.");
                  }}
                >
                  <Check size={16} strokeWidth={2} aria-hidden />
                  Save
                </button>
                <button
                  type="button"
                  className="um_btn_secondary"
                  disabled={readOnly}
                  onClick={() => {
                    setNameDraft(companyName);
                    setEditingName(false);
                  }}
                >
                  <X size={16} strokeWidth={2} aria-hidden />
                  Cancel
                </button>
              </div>
            ) : (
              <div className="cp_settings_value_row">
                <div className="cp_settings_value_pill cp_settings_readonly_pill">{companyName}</div>
                <button
                  type="button"
                  className="um_btn_secondary cp_settings_edit_btn"
                  disabled={readOnly}
                  onClick={() => {
                    setNameDraft(companyName);
                    setEditingName(true);
                  }}
                >
                  Edit
                </button>
              </div>
            )}
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
            <CardRadioGroup
              name="cp-qual"
              value={qualificationEnabled ? "enabled" : "disabled"}
              onChange={(v) => setQualificationEnabled(v === "enabled")}
              ariaLabel="Investor qualification form"
              disabled={readOnly}
              options={[
                { value: "enabled", label: "Enabled", icon: CheckCircle2 },
                { value: "disabled", label: "Disabled", icon: Ban },
              ]}
            />
            <button type="button" className="cp_btn_customize" disabled={readOnly}>
              <Pencil size={16} strokeWidth={2} aria-hidden />
              Customize qualification form
            </button>
          </div>
        </div>
        <div className="cp_settings_row cp_settings_row_spaced">
          <div className="cp_settings_label_col">
            <SettingsFieldLabel>Automatically show offerings</SettingsFieldLabel>
          </div>
          <div className="cp_settings_control">
            <select
              className="um_field_select cp_settings_select cp_settings_input_pill"
              value={offeringsMode}
              disabled={readOnly}
              onChange={(e) => setOfferingsMode(e.target.value)}
              aria-label="Automatically show offerings"
            >
              <option value="506c">Show only 506c offerings</option>
              <option value="all">Show all offerings</option>
              <option value="506b">Show only 506(b) offerings</option>
            </select>
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
            <CardRadioGroup
              name="cp-email-verify"
              value={emailVerifyBeforeInvest ? "yes" : "no"}
              onChange={(v) => setEmailVerifyBeforeInvest(v === "yes")}
              ariaLabel="Require email verification before investing"
              disabled={readOnly}
              options={[
                { value: "yes", label: "Yes (most common)", icon: MailCheck },
                { value: "no", label: "No", icon: MailX },
              ]}
            />
          </div>
        </div>
        <div className="cp_settings_row cp_settings_row_spaced">
          <div className="cp_settings_label_col">
            <SettingsFieldLabel>
              Allow investors to select primary company member in investment funnel
            </SettingsFieldLabel>
          </div>
          <div className="cp_settings_control">
            <CardRadioGroup
              name="cp-primary-member"
              value={primaryMemberInFunnel ? "yes" : "no"}
              onChange={(v) => setPrimaryMemberInFunnel(v === "yes")}
              ariaLabel="Allow investors to select primary company member in investment funnel"
              disabled={readOnly}
              options={[
                { value: "yes", label: "Yes", icon: Users },
                { value: "no", label: "No", icon: UserX },
              ]}
            />
          </div>
        </div>
        <div className="cp_settings_row cp_settings_row_spaced">
          <div className="cp_settings_label_col">
            <SettingsFieldLabel>
              Allow these profile types to request distributions by checks
            </SettingsFieldLabel>
          </div>
          <div className="cp_settings_control">
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
                disabled={readOnly}
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
                      disabled={readOnly}
                      onChange={() => {
                        if (distributionAllSelected) {
                          setDistributionTypes([]);
                        } else {
                          setDistributionTypes([...DEFAULT_DISTRIBUTION_TYPES]);
                        }
                      }}
                    />
                    <span className="cp_distribution_select_row_label">
                      All profile types
                    </span>
                  </label>
                  <div className="cp_distribution_select_divider" aria-hidden />
                  {DEFAULT_DISTRIBUTION_TYPES.map((t) => {
                    const checked = distributionTypes.includes(t);
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
                          disabled={readOnly}
                          onChange={() => {
                            setDistributionTypes((prev) =>
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
            <div className="cp_media_card">
              <div className="cp_media_preview cp_media_preview_logo" aria-hidden>
                <Building2 size={40} strokeWidth={1.5} />
                <span className="cp_media_preview_label">{companyName}</span>
              </div>
              <div className="cp_media_actions">
                <button type="button" className="um_btn_secondary" disabled={readOnly}>
                  <Upload size={16} strokeWidth={2} aria-hidden />
                  Upload new
                </button>
                <button type="button" className="um_btn_secondary" disabled={readOnly}>
                  <Trash2 size={16} strokeWidth={2} aria-hidden />
                  Delete
                </button>
              </div>
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
            <div className="cp_media_card">
              <div
                className="cp_media_preview cp_media_preview_bg"
                role="img"
                aria-label="Background preview placeholder"
              />
              <div className="cp_media_actions">
                <button type="button" className="um_btn_secondary" disabled={readOnly}>
                  <Upload size={16} strokeWidth={2} aria-hidden />
                  Upload new
                </button>
                <button type="button" className="um_btn_secondary" disabled={readOnly}>
                  <Trash2 size={16} strokeWidth={2} aria-hidden />
                  Delete
                </button>
              </div>
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
            <button type="button" className="um_btn_secondary" disabled={readOnly}>
              <Upload size={16} strokeWidth={2} aria-hidden />
              Upload new
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
