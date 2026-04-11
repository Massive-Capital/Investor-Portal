import { ArrowLeft } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { setAppDocumentTitle } from "../../../../common/utils/appDocumentTitle"
import { fetchDealInvestorClasses } from "./api/dealsApi"
import {
  AddInvestorClassPanel,
  DEAL_ADD_IC_PAGE_TITLE_ID,
} from "./components/OfferingInformationSection"
import type { DealInvestorClass } from "./types/deal-investor-class.types"
import "../../../usermanagement/user_management.css"
import "./deal-investor-class.css"
import "./deals-create.css"
import "./deals-list.css"

export function AddDealInvestorClassPage() {
  const { dealId } = useParams()
  const navigate = useNavigate()
  const [rows, setRows] = useState<DealInvestorClass[]>([])
  const [loading, setLoading] = useState(true)
  const [pipelineStep, setPipelineStep] = useState<1 | 2 | 3>(1)
  const [showHurdleStep, setShowHurdleStep] = useState(false)

  const backPath =
    dealId != null && dealId !== ""
      ? `/deals/${encodeURIComponent(dealId)}`
      : "/deals"

  const goBack = useCallback(() => {
    navigate(backPath)
  }, [navigate, backPath])

  const load = useCallback(async () => {
    if (!dealId) return
    setLoading(true)
    try {
      const list = await fetchDealInvestorClasses(dealId)
      setRows(list)
    } finally {
      setLoading(false)
    }
  }, [dealId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setAppDocumentTitle("Add Investor Class")
  }, [])

  useEffect(() => {
    setPipelineStep(1)
    setShowHurdleStep(false)
  }, [dealId])

  if (!dealId) {
    return (
      <div className="deals_list_page deals_detail_page">
        <p className="deals_list_not_found">Missing deal.</p>
        <Link to="/deals" className="deals_list_inline_back">
          Back to deals
        </Link>
      </div>
    )
  }

  return (
    <div className="deals_list_page deals_detail_page deals_add_investor_class_page deals_add_deal_asset_page deals_investor_class_add_edit_page">
      <header className="deals_list_head deals_add_investor_class_page_head">
        <div className="deals_add_deal_asset_head_main">
          <div className="deals_list_title_row deals_add_deal_asset_title_row">
            <button
              type="button"
              className="deals_list_back_circle"
              onClick={goBack}
              aria-label="Back to deal"
            >
              <ArrowLeft size={20} strokeWidth={2} aria-hidden />
            </button>
            <div className="deals_add_deal_asset_title_stack">
              <h1 id={DEAL_ADD_IC_PAGE_TITLE_ID} className="deals_list_title">
                Add Investor Class
              </h1>
            </div>
          </div>
          <div
            className="add_contact_stepper deals_add_deal_asset_stepper"
            role="group"
            aria-label="Progress"
          >
            <div
              className={
                pipelineStep === 1
                  ? "add_contact_step_node add_contact_step_node_active"
                  : "add_contact_step_node add_contact_step_node_done"
              }
            >
              <span
                className="add_contact_step_dot"
                aria-current={pipelineStep === 1 ? "step" : undefined}
              >
                1
              </span>
              <span className="add_contact_step_label">Class Details</span>
            </div>
            <span
              className={
                pipelineStep > 1
                  ? "add_contact_step_line add_contact_step_line_active"
                  : "add_contact_step_line"
              }
              aria-hidden
            />
            {showHurdleStep ? (
              <>
                <div
                  className={
                    pipelineStep === 2
                      ? "add_contact_step_node add_contact_step_node_active"
                      : pipelineStep > 2
                        ? "add_contact_step_node add_contact_step_node_done"
                        : "add_contact_step_node"
                  }
                >
                  <span className="add_contact_step_dot">2</span>
                  <span className="add_contact_step_label">Hurdle</span>
                </div>
                <span
                  className={
                    pipelineStep > 2
                      ? "add_contact_step_line add_contact_step_line_active"
                      : "add_contact_step_line"
                  }
                  aria-hidden
                />
                <div
                  className={
                    pipelineStep === 3
                      ? "add_contact_step_node add_contact_step_node_active"
                      : "add_contact_step_node"
                  }
                >
                  <span className="add_contact_step_dot">3</span>
                  <span className="add_contact_step_label">
                    Advanced
                  </span>
                </div>
              </>
            ) : (
              <div
                className={
                  pipelineStep === 2
                    ? "add_contact_step_node add_contact_step_node_active"
                    : "add_contact_step_node"
                }
              >
                <span className="add_contact_step_dot">2</span>
                <span className="add_contact_step_label">
                  Advanced
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {loading ? (
        <section className="deals_add_investor_class_loading_panel" role="status">
          <p className="deal_offering_muted">Loading investor classes…</p>
        </section>
      ) : (
        <AddInvestorClassPanel
          asPage
          dealId={dealId}
          existingClasses={rows}
          onClose={goBack}
          onCreated={goBack}
          pipelineStep={pipelineStep}
          onPipelineStepChange={setPipelineStep}
          includeHurdleStep={showHurdleStep}
          onAddHurdleClick={() => setShowHurdleStep(true)}
        />
      )}
    </div>
  )
}
