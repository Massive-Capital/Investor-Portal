import { ArrowLeft, ChevronRight, Loader2, Save } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "../../../../common/components/Toast"
import { AssetStepForm } from "./components/AssetStepForm"
import { DealStepForm } from "./components/DealStepForm"
import { DealsStepper } from "./components/DealsStepper"
import {
  buildCreateDealFormData,
  createDealMultipart,
  fetchDealById,
  updateDealMultipart,
} from "./api/dealsApi"
import { mapDealDetailApiToCreateDrafts } from "./createDealFormMap"
import {
  emptyAssetStepDraft,
  emptyDealStepDraft,
  type AssetStepDraft,
  type DealStepDraft,
} from "./types/deals.types"
import "./deals-create.css"

const STEPS = [
  { id: "deal", label: "Deal" },
  { id: "assets", label: "Assets" },
] as const

function DealStepBillingNote() {
  return (
    <p className="deals_create_billing_info" role="note">
      Your default billing method will be charged automatically. To assign a
      different billing method, go to{" "}
      <Link className="deals_create_billing_info_link" to="/billing">
        Billing
      </Link>
      .
    </p>
  )
}

export function CreateDealPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editDealId = searchParams.get("edit")?.trim() || null

  const [step, setStep] = useState(0)
  const [dealDraft, setDealDraft] = useState(emptyDealStepDraft)
  const [assetDraft, setAssetDraft] = useState(emptyAssetStepDraft)
  const [assetImages, setAssetImages] = useState<File[]>([])
  const [dealErrors, setDealErrors] = useState<
    Partial<Record<keyof DealStepDraft, string>>
  >({})
  const [assetErrors, setAssetErrors] = useState<
    Partial<Record<keyof AssetStepDraft, string>>
  >({})
  const [saving, setSaving] = useState(false)
  const [loadingDeal, setLoadingDeal] = useState(Boolean(editDealId))

  useEffect(() => {
    if (!editDealId) {
      setLoadingDeal(false)
      return
    }
    let cancelled = false
    setLoadingDeal(true)
    void (async () => {
      try {
        const detail = await fetchDealById(editDealId)
        if (cancelled) return
        const { deal, asset } = mapDealDetailApiToCreateDrafts(detail)
        setDealDraft(deal)
        setAssetDraft(asset)
        setAssetImages([])
        setStep(0)
      } catch {
        if (!cancelled) {
          toast.error("Could not load deal to edit.")
          navigate("/deals", { replace: true })
        }
      } finally {
        if (!cancelled) setLoadingDeal(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editDealId, navigate])

  function patchDeal(patch: Partial<DealStepDraft>) {
    setDealDraft((d) => ({ ...d, ...patch }))
    setDealErrors((e) => {
      const next = { ...e }
      for (const k of Object.keys(patch) as (keyof DealStepDraft)[])
        delete next[k]
      return next
    })
  }

  function patchAsset(patch: Partial<AssetStepDraft>) {
    setAssetDraft((d) => ({ ...d, ...patch }))
    setAssetErrors((e) => {
      const next = { ...e }
      for (const k of Object.keys(patch) as (keyof AssetStepDraft)[])
        delete next[k]
      return next
    })
  }

  function validateDeal(): boolean {
    const next: Partial<Record<keyof DealStepDraft, string>> = {}
    if (!dealDraft.dealName.trim())
      next.dealName = "Deal name is required."
    if (!dealDraft.dealStage)
      next.dealStage = "Deal stage is required."
    if (!dealDraft.secType.trim())
      next.secType = "SEC type is required."
    if (!dealDraft.owningEntityName.trim())
      next.owningEntityName = "Owning entity name is required."
    if (!dealDraft.fundsBeforeGpCountersigns)
      next.fundsBeforeGpCountersigns = "Please select Yes or No."
    if (!dealDraft.autoFundingAfterGpCountersigns)
      next.autoFundingAfterGpCountersigns = "Please select Yes or No."
    setDealErrors(next)
    return Object.keys(next).length === 0
  }

  function validateAsset(): boolean {
    const next: Partial<Record<keyof AssetStepDraft, string>> = {}
    if (!assetDraft.propertyName.trim())
      next.propertyName = "Name of property is required."
    setAssetErrors(next)
    return Object.keys(next).length === 0
  }

  function goNext() {
    if (step === 0 && !validateDeal()) return
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0))
  }

  async function saveDeal() {
    if (!validateAsset()) return
    if (!validateDeal()) return
    setSaving(true)
    try {
      const formData = buildCreateDealFormData(
        dealDraft,
        assetDraft,
        assetImages,
      )
      const result = editDealId
        ? await updateDealMultipart(editDealId, formData)
        : await createDealMultipart(formData)
      if (!result.ok) {
        toast.error(
          result.message,
          result.fieldErrors
            ? Object.values(result.fieldErrors).join(" ")
            : undefined,
        )
        return
      }
      toast.success(editDealId ? "Deal updated" : "Deal created")
      navigate("/deals")
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not save deal.",
      )
    } finally {
      setSaving(false)
    }
  }

  const pageTitle = editDealId ? "Edit deal" : "Create deal"

  if (loadingDeal) {
    return (
      <div className="deals_create_page">
        <p className="deals_list_not_found" role="status">
          Loading deal…
        </p>
      </div>
    )
  }

  return (
    <div className="deals_create_page">
      <nav className="deals_create_breadcrumb" aria-label="Breadcrumb">
        <Link to="/deals">Deals</Link>
        <span className="deals_create_breadcrumb_sep" aria-hidden>
          /
        </span>
        <span aria-current="page">{pageTitle}</span>
      </nav>

      <header className="deals_create_head">
        <h1 className="deals_create_title">{pageTitle}</h1>
        <Link className="deals_create_cancel" to="/deals">
          Cancel
        </Link>
      </header>

      <DealsStepper steps={[...STEPS]} activeIndex={step} />

      {step === 0 ? (
        <DealStepForm
          draft={dealDraft}
          errors={dealErrors}
          onChange={patchDeal}
        />
      ) : null}

      {step === 1 ? (
        <AssetStepForm
          draft={assetDraft}
          errors={assetErrors}
          imageFiles={assetImages}
          onChange={patchAsset}
          onImageFilesChange={setAssetImages}
        />
      ) : null}

      <footer className="deals_create_footer">
        {step === 0 && !editDealId ? <DealStepBillingNote /> : null}
        <div className="deals_create_footer_row">
          {step > 0 ? (
            <button type="button" className="deals_create_btn_secondary" onClick={goBack}>
              <ArrowLeft size={18} strokeWidth={2} aria-hidden />
              Back
            </button>
          ) : (
            <span />
          )}
          <div className="deals_create_footer_right">
            {step === 0 ? (
              <button type="button" className="deals_create_btn_primary" onClick={goNext}>
                Next
                <ChevronRight size={18} strokeWidth={2} aria-hidden />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="deals_create_btn_primary"
                  onClick={() => void saveDeal()}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2
                        size={18}
                        strokeWidth={2}
                        className="deals_create_btn_spin"
                        aria-hidden
                      />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save size={18} strokeWidth={2} aria-hidden />
                      Save
                    </>
                  )}
                </button>
                {/* <Link className="deals_create_footer_cancel_link" to="/deals">
                  Cancel
                </Link> */}
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
