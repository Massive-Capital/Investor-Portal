import { useEffect, useMemo, useState } from "react";
import { Code2, Copy, GripVertical, Plus, Trash2 } from "lucide-react";
import { DataTablePagination } from "../../common/components/DataTablePagination/DataTablePagination";
import { toast } from "../../common/components/Toast";

type Props = {
  companyName: string;
  readOnly?: boolean;
};

type OfferingRow = {
  id: string;
  name: string;
  internalName: string;
  status: string;
  closeDate: string;
  warnRow?: boolean;
};

/** Page link shown on Offerings tab (dev / demo) */
const PUBLIC_OFFERINGS_PAGE_URL = "http://localhost:5173";

/** Placeholder rows for UI only — replace with API data when wired */
const MOCK_OFFERINGS: OfferingRow[] = [
  {
    id: "demo-1",
    name: "Sample offering (draft)",
    internalName: "DEMO-DRAFT-001",
    status: "Draft",
    closeDate: "6/30/2026",
    warnRow: true,
  },
  {
    id: "demo-2",
    name: "Sample offering (active)",
    internalName: "DEMO-ACTIVE-001",
    status: "Active",
    closeDate: "12/15/2026",
  },
  {
    id: "demo-3",
    name: "Sample offering (closed)",
    internalName: "DEMO-CLOSED-001",
    status: "Closed",
    closeDate: "3/1/2025",
  },
];

export function CompanyOfferingsPageTab(props: Props) {
  const { readOnly = false } = props;
  const pageUrl = PUBLIC_OFFERINGS_PAGE_URL;
  const [visibility, setVisibility] = useState<"hidden" | "visible">("hidden");
  const [disclaimer, setDisclaimer] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const draftOrPastCount = useMemo(
    () =>
      MOCK_OFFERINGS.filter(
        (o) => o.status === "Draft" || o.status === "Past",
      ).length,
    [],
  );

  const offeringsTotalPages = Math.max(
    1,
    Math.ceil(MOCK_OFFERINGS.length / pageSize),
  );

  useEffect(() => {
    if (page > offeringsTotalPages) {
      setPage(offeringsTotalPages);
    }
  }, [page, offeringsTotalPages]);

  const offeringsPageSafe = Math.min(page, offeringsTotalPages);

  const pageRows = useMemo(() => {
    const start = (offeringsPageSafe - 1) * pageSize;
    return MOCK_OFFERINGS.slice(start, start + pageSize);
  }, [offeringsPageSafe, pageSize]);

  async function copyPageLink() {
    try {
      await navigator.clipboard.writeText(pageUrl);
      toast.success("Copied", "Link copied to clipboard.");
    } catch {
      toast.error("Copy failed", "Could not copy to clipboard.");
    }
  }

  function embedPage() {
    toast.success("Coming soon", "Embed snippet will be available in a future update.");
  }

  return (
    <div className="cp_offerings_root">
      <section
        className="cp_offerings_section"
        aria-labelledby="cp-offerings-public-settings"
      >
        <h3 id="cp-offerings-public-settings" className="cp_offerings_section_title">
          Public page settings
        </h3>

        <div className="cp_offerings_field_row">
          <div className="cp_offerings_field_label">Page link</div>
          <div className="cp_offerings_field_control">
            <div className="cp_offerings_link_block">
              <div className="cp_offerings_url_box">{pageUrl}</div>
              <div className="cp_offerings_link_actions">
                <button
                  type="button"
                  className="cp_offerings_btn_outline"
                  onClick={() => void copyPageLink()}
                >
                  <Copy size={16} strokeWidth={2} aria-hidden />
                  Copy to clipboard
                </button>
                <button
                  type="button"
                  className="cp_offerings_btn_outline"
                  disabled={readOnly}
                  onClick={embedPage}
                >
                  <Code2 size={16} strokeWidth={2} aria-hidden />
                  Embed
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="cp_offerings_field_row">
          <div className="cp_offerings_field_label">Page visibility</div>
          <div className="cp_offerings_field_control">
            <div
              className="cp_offerings_visibility"
              role="radiogroup"
              aria-label="Page visibility"
            >
              <label
                className={`cp_offerings_radio_option${
                  visibility === "hidden" ? " cp_offerings_radio_option_selected" : ""
                }`}
              >
                <input
                  type="radio"
                  className="cp_offerings_radio_input"
                  name="cp-offerings-visibility"
                  checked={visibility === "hidden"}
                  disabled={readOnly}
                  onChange={() => setVisibility("hidden")}
                />
                <span className="cp_offerings_radio_face" aria-hidden />
                <span className="cp_offerings_radio_text">Hidden</span>
              </label>
              <label
                className={`cp_offerings_radio_option${
                  visibility === "visible" ? " cp_offerings_radio_option_selected" : ""
                }`}
              >
                <input
                  type="radio"
                  className="cp_offerings_radio_input"
                  name="cp-offerings-visibility"
                  checked={visibility === "visible"}
                  disabled={readOnly}
                  onChange={() => setVisibility("visible")}
                />
                <span className="cp_offerings_radio_face" aria-hidden />
                <span className="cp_offerings_radio_text">Visible with link</span>
              </label>
            </div>
          </div>
        </div>

        <div className="cp_offerings_field_row cp_offerings_field_row_disclaimer">
          <div className="cp_offerings_field_label">Disclaimer</div>
          <div className="cp_offerings_field_control">
            <textarea
              className="cp_offerings_disclaimer"
              rows={5}
              placeholder="Optionally enter a disclaimer to be shown at the bottom of the page."
              value={disclaimer}
              disabled={readOnly}
              onChange={(e) => setDisclaimer(e.target.value)}
              aria-label="Disclaimer"
            />
          </div>
        </div>
      </section>

      <section
        className="cp_offerings_section"
        aria-labelledby="cp-offerings-public-list"
      >
        <div className="cp_offerings_table_section_head">
          <h3 id="cp-offerings-public-list" className="cp_offerings_section_title">
            Public page offerings
          </h3>
          <button
            type="button"
            className="cp_offerings_btn_outline"
            disabled={readOnly}
          >
            <Plus size={16} strokeWidth={2} aria-hidden />
            Add offering
          </button>
        </div>

        {draftOrPastCount > 0 ? (
          <div className="cp_offerings_alert" role="status">
            {draftOrPastCount} of your offerings are set to &apos;Draft&apos; or &apos;Past&apos;
            status, which prevents {draftOrPastCount === 1 ? "it" : "them"} from being displayed.
          </div>
        ) : null}

        <div className="um_table_wrap cp_offerings_table_wrap">
          <table className="um_table cp_offerings_table">
            <thead>
              <tr>
                <th scope="col" className="cp_offerings_th_drag" aria-label="Reorder" />
                <th scope="col">Offering name</th>
                <th scope="col">Offering internal name</th>
                <th scope="col">Offering status</th>
                <th scope="col">Close date</th>
                <th scope="col" className="um_th_actions">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr
                  key={row.id}
                  className={row.warnRow ? "cp_offerings_row_warn" : undefined}
                >
                  <td className="cp_offerings_td_drag">
                    <span className="cp_offerings_drag" aria-hidden>
                      <GripVertical size={18} strokeWidth={2} />
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="cp_offerings_name_link"
                      disabled={readOnly}
                    >
                      {row.name}
                    </button>
                  </td>
                  <td>{row.internalName}</td>
                  <td>{row.status}</td>
                  <td>{row.closeDate}</td>
                  <td className="um_td_actions">
                    <button
                      type="button"
                      className="cp_offerings_icon_btn"
                      disabled={readOnly}
                      aria-label={`Remove ${row.name} from public page`}
                    >
                      <Trash2 size={18} strokeWidth={2} aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DataTablePagination
          page={offeringsPageSafe}
          pageSize={pageSize}
          totalItems={MOCK_OFFERINGS.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 25, 50]}
          ariaLabel="Public offerings table pagination"
        />
      </section>
    </div>
  );
}
