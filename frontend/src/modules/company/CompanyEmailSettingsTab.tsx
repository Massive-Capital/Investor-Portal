import { useState } from "react";
import { CircleHelp, Mail, PenLine } from "lucide-react";

type Props = {
  companyName: string;
  readOnly?: boolean;
};

/** Shown for From / Reply-to / Notification addresses in the email settings UI */
const PLATFORM_DISPLAY_EMAIL = "platform.admin@example.com";

function HelpTip({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="cp_email_help_btn"
      aria-label={label}
      title={label}
    >
      <CircleHelp size={14} strokeWidth={2} aria-hidden />
    </button>
  );
}

export function CompanyEmailSettingsTab(props: Props) {
  const { readOnly = false } = props;
  const [textDirection, setTextDirection] = useState("ltr");

  return (
    <div className="cp_email_layout cp_email_layout_single">
      <fieldset
        disabled={readOnly}
        className="cp_email_main_fieldset"
      >
        <legend className="cp_sr_only">Email settings</legend>
        <div className="cp_email_main">
        <section className="cp_email_section" aria-labelledby="cp-email-auto">
          <h3 id="cp-email-auto" className="cp_email_section_title">
            Investor automated emails
          </h3>
          <p className="cp_email_section_desc">
            Customize the email notifications sent to your company&apos;s investors.
          </p>
          <button type="button" className="cp_btn_customize">
            Customize email notifications
          </button>
        </section>

        <section className="cp_email_section" aria-labelledby="cp-email-sig">
          <h3 id="cp-email-sig" className="cp_email_section_title">
            Email signatures
          </h3>
          <p className="cp_email_section_desc">
            Customize the email signatures that will be included in your emails.
          </p>
          <button type="button" className="cp_btn_customize">
            Customize email signatures
          </button>
        </section>

        <section className="cp_email_section" aria-labelledby="cp-email-deliver">
          <h3 id="cp-email-deliver" className="cp_email_section_title">
            Email sending &amp; deliverability
          </h3>
          <div className="cp_email_row">
            <div className="cp_email_row_label">
              <span>Custom sending domain</span>
              <HelpTip label="Help: custom sending domain" />
            </div>
            <div className="cp_email_row_actions">
              <button type="button" className="cp_email_btn_outline cp_email_btn_sm">
                Manage
              </button>
              <button type="button" className="cp_email_btn_outline cp_email_btn_sm">
                Delete
              </button>
            </div>
          </div>
          {/* Personal inbox integration — Marketing plan upsell (hidden)
          <div className="cp_email_row">
            <div className="cp_email_row_label">
              <span>Personal inbox integration</span>
              <HelpTip label="Help: personal inbox integration" />
            </div>
            <div className="cp_email_row_value">
              <p className="cp_email_muted_line">
                Available in Marketing plan or higher.{" "}
                <button type="button" className="cp_email_link_btn">
                  View all CRM plans
                </button>
              </p>
            </div>
          </div>
          <div className="cp_email_row">
            <div className="cp_email_row_label">
              <span>Company inbox integration</span>
              <HelpTip label="Help: company inbox integration" />
            </div>
            <div className="cp_email_row_value">
              <p className="cp_email_muted_line">
                Available in Marketing plan or higher.{" "}
                <button type="button" className="cp_email_link_btn">
                  View all CRM plans
                </button>
              </p>
            </div>
          </div>
          */}
        </section>

        <section className="cp_email_section" aria-labelledby="cp-email-addresses">
          <h3 id="cp-email-addresses" className="cp_email_section_title">
            Email addresses
          </h3>

          <div className="cp_email_address_block">
            <div className="cp_email_address_row">
              <div className="cp_email_row_label">
                <span>&apos;From&apos; email address</span>
                <HelpTip label="Help: From email address" />
              </div>
              <div className="cp_email_address_body">
                <div className="cp_email_address_value">
                  <Mail size={16} strokeWidth={1.75} className="cp_email_address_icon" aria-hidden />
                  {PLATFORM_DISPLAY_EMAIL}
                </div>
                <button type="button" className="cp_email_btn_outline cp_email_btn_sm">
                  Preview company email
                </button>
              </div>
            </div>

            <div className="cp_email_address_row">
              <div className="cp_email_row_label">
                <span>&apos;Reply-to&apos; email address</span>
                <HelpTip label="Help: Reply-to email address" />
              </div>
              <div className="cp_email_address_body">
                <div className="cp_email_address_value">
                  <Mail size={16} strokeWidth={1.75} className="cp_email_address_icon" aria-hidden />
                  {PLATFORM_DISPLAY_EMAIL}
                </div>
                <button type="button" className="cp_email_btn_outline cp_email_btn_sm">
                  <PenLine size={14} strokeWidth={2} aria-hidden />
                  Edit
                </button>
              </div>
            </div>

            <div className="cp_email_address_row">
              <div className="cp_email_row_label">
                <span>Notification email address</span>
                <HelpTip label="Help: notification email address" />
              </div>
              <div className="cp_email_address_body">
                <div className="cp_email_address_value">
                  <Mail size={16} strokeWidth={1.75} className="cp_email_address_icon" aria-hidden />
                  {PLATFORM_DISPLAY_EMAIL}
                </div>
                <button type="button" className="cp_email_btn_outline cp_email_btn_sm">
                  <PenLine size={14} strokeWidth={2} aria-hidden />
                  Edit
                </button>
              </div>
            </div>

            <div className="cp_email_address_row cp_email_address_row_last">
              <div className="cp_email_row_label">
                <span>Preferred test email recipient address</span>
                <HelpTip label="Help: test email recipient" />
              </div>
              <div className="cp_email_address_body">
                <p className="cp_email_test_hint">
                  Test emails will be sent to the user who initiates them.
                </p>
                <div className="cp_email_row_actions">
                  <button type="button" className="cp_email_btn_outline cp_email_btn_sm">
                    <PenLine size={14} strokeWidth={2} aria-hidden />
                    Edit
                  </button>
                  <button type="button" className="cp_email_btn_outline cp_email_btn_sm">
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="cp_email_section" aria-labelledby="cp-email-editor">
          <h3 id="cp-email-editor" className="cp_email_section_title">
            Editor settings
          </h3>
          <div className="cp_email_row cp_email_row_editor">
            <div className="cp_email_row_label">
              <span>Editor text direction</span>
              <HelpTip label="Help: editor text direction" />
            </div>
            <div className="cp_email_row_value">
              <select
                className="cp_email_select"
                value={textDirection}
                onChange={(e) => setTextDirection(e.target.value)}
                aria-label="Editor text direction"
              >
                <option value="ltr">Left to right (most common)</option>
                <option value="rtl">Right to left</option>
              </select>
            </div>
          </div>
        </section>
        </div>
      </fieldset>

      {/* Setup checklist sidebar (hidden)
      <aside className="cp_email_checklist" aria-label="Email setup checklist">
        <div className="cp_email_checklist_head">
          <span className="cp_email_checklist_title">Setup checklist</span>
          <button
            type="button"
            className="cp_email_checklist_toggle"
            aria-expanded={checklistOpen}
            onClick={() => setChecklistOpen((o) => !o)}
            aria-label={checklistOpen ? "Collapse checklist" : "Expand checklist"}
          >
            <Minus size={16} strokeWidth={2} aria-hidden />
          </button>
        </div>
        {checklistOpen ? (
          <div className="cp_email_checklist_body">
            <p className="cp_email_checklist_intro">
              Optimize your email deliverability and open rate by completing the following
              items:
            </p>
            <ul className="cp_email_checklist_list">
              <li className="cp_email_checklist_item cp_email_checklist_item_incomplete">
                <span className="cp_email_checklist_badge" aria-hidden>
                  <X size={12} strokeWidth={3} />
                </span>
                <span>Set up your custom sending domain</span>
                <HelpTip label="Help: custom sending domain setup" />
              </li>
            </ul>
            <div className="cp_email_progress">
              <div className="cp_email_progress_track" aria-hidden>
                <div className="cp_email_progress_fill" style={{ width: "0%" }} />
              </div>
              <span className="cp_email_progress_label">0% complete</span>
            </div>
          </div>
        ) : null}
      </aside>
      */}
    </div>
  );
}
