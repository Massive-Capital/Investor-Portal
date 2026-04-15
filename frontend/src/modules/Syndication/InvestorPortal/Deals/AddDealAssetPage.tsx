import {
  ArrowLeft,
  ChevronRight,
  Plus,
  Save,
  X,
} from "lucide-react"
import { useCallback, useEffect, useId, useState, type FormEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "../../../../common/components/Toast"
import { assetImagePathsToUrls } from "../../../../common/utils/apiBaseUrl"
import { setAppDocumentTitle } from "../../../../common/utils/appDocumentTitle"
import { fetchDealById, postDealOfferingGalleryUploads } from "./api/dealsApi"
import { mapDealDetailApiToCreateDrafts } from "./createDealFormMap"
import { AssetAdditionalInfoSection } from "./components/AssetAdditionalInfoSection"
import { AssetStepForm } from "./components/AssetStepForm"
import {
  assetTypeFromAttributes,
  createDefaultAssetAttributeRows,
  formatAddressFromAssetDraft,
  getDealAssetPersisted,
  primaryDealAssetRowId,
  serializeAdditionalInfo,
  upsertDealAssetPersisted,
  type AssetAttributeRow,
  type DealAssetPersisted,
  type DealAssetRow,
} from "./types/deal-asset.types"
import { dedupeGalleryUrlsPreserveOrder } from "./utils/offeringGalleryUrls"
import { emptyAssetStepDraft, type AssetStepDraft } from "./types/deals.types"
import "../../../contacts/contacts.css"
import "../../../usermanagement/user_management.css"
import "./deal-investor-class.css"
import "./deals-create.css"
import "./deals-list.css"
import "./components/asset-additional-info.css"

export function AddDealAssetPage() {
  const titleId = useId()
  const { dealId, assetId: assetIdParam } = useParams<{
    dealId: string
    assetId?: string
  }>()
  const navigate = useNavigate()
  const isEdit = Boolean(assetIdParam?.trim())
  const assetId = assetIdParam?.trim() ?? ""

  const [step, setStep] = useState<1 | 2>(1)
  const [assetDraft, setAssetDraft] = useState<AssetStepDraft>(emptyAssetStepDraft)
  const [assetErrors, setAssetErrors] = useState<
    Partial<Record<keyof AssetStepDraft, string>>
  >({})
  const [assetImageFiles, setAssetImageFiles] = useState<File[]>([])
  /** Data URLs or `/uploads/…` URLs — shown when editing */
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([])
  const [attrRows, setAttrRows] = useState<AssetAttributeRow[]>(() =>
    createDefaultAssetAttributeRows(),
  )
  const [hydrated, setHydrated] = useState(!isEdit)
  const [loadError, setLoadError] = useState<string | null>(null)

  const backPath =
    dealId != null && dealId !== ""
      ? `/deals/${encodeURIComponent(dealId)}`
      : "/deals"

  const goBack = useCallback(() => {
    navigate(backPath)
  }, [navigate, backPath])

  useEffect(() => {
    setAppDocumentTitle(isEdit ? "Edit Asset" : "Add Asset")
  }, [isEdit])

  useEffect(() => {
    if (!dealId || !isEdit) {
      setHydrated(true)
      setLoadError(null)
      return
    }

    let cancelled = false
    setHydrated(false)
    setLoadError(null)

    const primaryId = primaryDealAssetRowId(dealId)
    const persisted = getDealAssetPersisted(dealId, assetId)

    if (persisted) {
      setAssetDraft(persisted.draft)
      setAttrRows(persisted.attrRows)

      if (assetId === primaryId) {
        const saved = persisted.imagePreviewDataUrls
        const fromSaved = Array.isArray(saved) ? saved : []
        /** After Save asset, `imagePreviewDataUrls` is the source of truth — server `assetImagePath` is append-only and would show removed files again. */
        if (Array.isArray(persisted.imagePreviewDataUrls)) {
          setExistingImageUrls(dedupeGalleryUrlsPreserveOrder([...fromSaved]))
          setHydrated(true)
        } else {
          void (async () => {
            try {
              const detail = await fetchDealById(dealId)
              if (cancelled) return
              const fromApi = assetImagePathsToUrls(detail.assetImagePath)
              setExistingImageUrls(
                dedupeGalleryUrlsPreserveOrder([...fromSaved, ...fromApi]),
              )
            } catch {
              if (!cancelled) {
                setExistingImageUrls(Array.isArray(saved) ? saved : [])
              }
            } finally {
              if (!cancelled) setHydrated(true)
            }
          })()
        }
      } else {
        const saved = persisted.imagePreviewDataUrls
        setExistingImageUrls(
          dedupeGalleryUrlsPreserveOrder(Array.isArray(saved) ? saved : []),
        )
        setHydrated(true)
      }

      return () => {
        cancelled = true
      }
    }

    if (assetId === primaryId) {
      void (async () => {
        try {
          const detail = await fetchDealById(dealId)
          if (cancelled) return
          const { asset } = mapDealDetailApiToCreateDrafts(detail)
          setAssetDraft(asset)
          setAttrRows(createDefaultAssetAttributeRows())
          setExistingImageUrls(assetImagePathsToUrls(detail.assetImagePath))
        } catch {
          if (!cancelled)
            setLoadError("Could not load this deal. Try again from the deal page.")
        } finally {
          if (!cancelled) setHydrated(true)
        }
      })()
      return () => {
        cancelled = true
      }
    }

    setLoadError(
      "This asset is no longer available to edit. Return to the deal and refresh.",
    )
    setHydrated(true)
    return () => {
      cancelled = true
    }
  }, [dealId, isEdit, assetId])

  useEffect(() => {
    if (isEdit) return
    setAssetDraft(emptyAssetStepDraft())
    setAttrRows(createDefaultAssetAttributeRows())
    setAssetImageFiles([])
    setExistingImageUrls([])
    setStep(1)
    setAssetErrors({})
  }, [dealId, isEdit])

  const patchAsset = useCallback((patch: Partial<AssetStepDraft>) => {
    setAssetDraft((d) => ({ ...d, ...patch }))
    setAssetErrors((e) => {
      const next = { ...e }
      for (const k of Object.keys(patch) as (keyof AssetStepDraft)[]) {
        delete next[k]
      }
      return next
    })
  }, [])

  const addCustomAttribute = useCallback(() => {
    setAttrRows((rows) => [
      ...rows,
      {
        id: `attr-custom-${Date.now()}`,
        label: "",
        kind: "text",
        value: "",
        preset: false,
      },
    ])
  }, [])

  function validateDetails(): boolean {
    const nextErr: Partial<Record<keyof AssetStepDraft, string>> = {}
    if (!assetDraft.propertyName.trim()) {
      nextErr.propertyName = "Property name is required."
    }
    setAssetErrors(nextErr)
    return Object.keys(nextErr).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!dealId) return
    if (step === 1) {
      if (validateDetails()) setStep(2)
      return
    }

    if (!validateDetails()) {
      setStep(1)
      return
    }

    const resolvedId = isEdit ? assetId : `asset-${Date.now()}`
    const prev = isEdit ? getDealAssetPersisted(dealId, resolvedId) : undefined

    let imagePreviewDataUrls = dedupeGalleryUrlsPreserveOrder([
      ...existingImageUrls,
    ])
    if (assetImageFiles.length > 0) {
      const up = await postDealOfferingGalleryUploads(dealId, assetImageFiles)
      if (!up.ok) {
        toast.error(up.message)
        return
      }
      const fromPaths = assetImagePathsToUrls(up.newPaths.join(";"))
      imagePreviewDataUrls = dedupeGalleryUrlsPreserveOrder([
        ...imagePreviewDataUrls,
        ...fromPaths,
      ])
    }

    const imageCount = imagePreviewDataUrls.length

    const row: DealAssetRow = {
      id: resolvedId,
      name: assetDraft.propertyName.trim(),
      address: formatAddressFromAssetDraft(assetDraft),
      assetType: assetTypeFromAttributes(attrRows),
      imageCount,
      archived: prev?.row.archived ?? false,
      additionalInfo: serializeAdditionalInfo(attrRows),
    }

    const entry: DealAssetPersisted = {
      id: resolvedId,
      row,
      draft: assetDraft,
      attrRows,
      imagePreviewDataUrls,
    }
    upsertDealAssetPersisted(dealId, entry)

    setAssetImageFiles([])
    navigate(backPath)
  }

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

  if (isEdit && !hydrated) {
    return (
      <div className="deals_list_page deals_detail_page deals_add_investor_class_page deals_add_deal_asset_page">
        <p className="deals_list_not_found" role="status">
          Loading asset…
        </p>
        <Link to={backPath} className="deals_list_inline_back">
          Back to deal
        </Link>
      </div>
    )
  }

  if (isEdit && loadError) {
    return (
      <div className="deals_list_page deals_detail_page deals_add_investor_class_page deals_add_deal_asset_page">
        <p className="deals_list_not_found">{loadError}</p>
        <Link to={backPath} className="deals_list_inline_back">
          Back to deal
        </Link>
      </div>
    )
  }

  return (
    <div className="deals_list_page deals_detail_page deals_add_investor_class_page deals_add_deal_asset_page">
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
              <h1 id={titleId} className="deals_list_title">
                {isEdit ? "Edit Asset" : "Add Asset"}
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
                step === 1
                  ? "add_contact_step_node add_contact_step_node_active"
                  : "add_contact_step_node add_contact_step_node_done"
              }
            >
              <span
                className="add_contact_step_dot"
                aria-current={step === 1 ? "step" : undefined}
              >
                1
              </span>
              <span className="add_contact_step_label">Assets</span>
            </div>
            <span
              className={
                step === 2
                  ? "add_contact_step_line add_contact_step_line_active"
                  : "add_contact_step_line"
              }
              aria-hidden
            />
            <div
              className={
                step === 2
                  ? "add_contact_step_node add_contact_step_node_active"
                  : "add_contact_step_node"
              }
            >
              <span className="add_contact_step_dot">2</span>
              <span className="add_contact_step_label">
                Additional Information
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="deals_add_deal_asset_panel">
        <form
          className="deals_add_deal_asset_form"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className="deals_add_deal_asset_form_scroll">
            {step === 1 ? (
              <AssetStepForm
                draft={assetDraft}
                errors={assetErrors}
                imageFiles={assetImageFiles}
                onChange={patchAsset}
                onImageFilesChange={setAssetImageFiles}
                existingImageUrls={
                  isEdit ? existingImageUrls : undefined
                }
                onRemoveExistingImage={
                  isEdit
                    ? (i) =>
                        setExistingImageUrls((prev) =>
                          prev.filter((_, j) => j !== i),
                        )
                    : undefined
                }
              />
            ) : (
              <div
                className="deals_add_deal_asset_additional"
                aria-labelledby="deal-add-asset-additional-heading"
              >
                <div className="deals_add_deal_asset_additional_head">
                  <div>
                    <h2
                      id="deal-add-asset-additional-heading"
                      className="deals_add_deal_asset_additional_subtitle"
                    >
                      Additional information
                    </h2>
                    <p className="deals_add_deal_asset_additional_hint">
                      Drag the dots to reorder. Attributes without a value will
                      be hidden from LPs.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="um_btn_secondary deals_add_deal_asset_add_attr_btn"
                    onClick={addCustomAttribute}
                  >
                    <Plus size={18} strokeWidth={2} aria-hidden />
                    Add attribute
                  </button>
                </div>

                <AssetAdditionalInfoSection
                  rows={attrRows}
                  onChange={setAttrRows}
                />
              </div>
            )}
          </div>

          <div className="um_modal_actions deal_inv_ic_add_panel_actions deals_add_deal_asset_footer_actions">
            <button type="button" className="um_btn_secondary" onClick={goBack}>
              <X size={16} strokeWidth={2} aria-hidden />
              Cancel
            </button>
            <div className="add_contact_modal_actions_trailing">
              {step === 2 ? (
                <button
                  type="button"
                  className="um_btn_secondary"
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft size={16} strokeWidth={2} aria-hidden />
                  Back
                </button>
              ) : null}
              {step === 1 ? (
                <button type="submit" className="um_btn_primary">
                  Next
                  <ChevronRight size={18} strokeWidth={2} aria-hidden />
                </button>
              ) : (
                <button type="submit" className="um_btn_primary">
                  <Save size={16} strokeWidth={2} aria-hidden />
                  {isEdit ? "Save changes" : "Save asset"}
                </button>
              )}
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}
