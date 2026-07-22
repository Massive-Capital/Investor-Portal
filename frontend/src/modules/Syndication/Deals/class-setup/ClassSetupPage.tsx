import { ArrowLeft } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom"
import { toast } from "../../../../common/components/Toast/toastStore"
import { ConfirmDeleteModal } from "../../../../common/components/ConfirmDeleteModal"
import { setAppDocumentTitle } from "../../../../common/utils/appDocumentTitle"
import {
  buildDealDetailReturnSearch,
  OFFERING_DETAILS_CLASSES_RETURN,
  type DealDetailReturnState,
} from "../utils/offeringDetailsSectionNav"
import {
  createClassSetupClassApi,
  deleteClassSetupClassApi,
  duplicateClassSetupClassApi,
  fetchClassSetup,
  saveClassSetup,
} from "./api/classSetupApi"
import { CapitalizationCard } from "./components/CapitalizationCard"
import { ClassSetupSkeleton } from "./components/ClassSetupSkeleton"
import { ClassSetupTable } from "./components/ClassSetupTable"
import { PromoteScheduleSection } from "./components/PromoteScheduleSection"
import { SetupValidationPanel } from "./components/SetupValidationPanel"
import type {
  ClassSetupClass,
  ClassSetupDealMeta,
  ClassSetupType,
} from "./types/class-setup.types"
import { CLASS_TYPE_META, emptyPromoteSchedule } from "./types/class-setup.types"
import {
  computeClassSetupTotals,
  createLocalClass,
} from "./utils/classSetupTotals"
import { validateClassSetupLocal } from "./utils/classSetupValidation"
import {
  normalizePromoteShares,
  removeClassFromPromote,
  updatePromoteShare,
} from "./utils/promoteSchedule"
import "../../usermanagement/user_management.css"
import "../deals-list.css"
import "./class-setup.css"

const NEW_CLASS_TYPES: ClassSetupType[] = [
  "lp",
  "gp",
  "preferred_equity",
  "mezzanine",
]

function parseNewClassType(raw: string | null): ClassSetupType | null {
  if (!raw) return null
  const v = raw.trim().toLowerCase()
  if (v === "1" || v === "true" || v === "yes") return "lp"
  if ((NEW_CLASS_TYPES as readonly string[]).includes(v))
    return v as ClassSetupType
  return null
}

export function ClassSetupPage() {
  const { dealId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const returnState = location.state as DealDetailReturnState | null

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dealName, setDealName] = useState("")
  const [meta, setMeta] = useState<ClassSetupDealMeta>({
    targetRaise: "0",
    latestChanges: "",
    promote: emptyPromoteSchedule(),
  })
  const [classes, setClasses] = useState<ClassSetupClass[]>([])
  const [deleteTarget, setDeleteTarget] = useState<ClassSetupClass | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [focusClassKey, setFocusClassKey] = useState<string | null>(null)
  const [showCreatePanel, setShowCreatePanel] = useState(false)
  const bootstrappedQueryRef = useRef(false)

  const dealDetailPath =
    dealId != null && dealId !== ""
      ? `/deals/${encodeURIComponent(dealId)}`
      : "/deals"

  const goBack = useCallback(() => {
    const qs = buildDealDetailReturnSearch({
      tab:
        returnState?.returnTab ??
        OFFERING_DETAILS_CLASSES_RETURN.returnTab ??
        "offering_details",
      offeringSection:
        returnState?.returnSection ??
        OFFERING_DETAILS_CLASSES_RETURN.returnSection,
    })
    navigate(`${dealDetailPath}${qs}`)
  }, [
    dealDetailPath,
    navigate,
    returnState?.returnSection,
    returnState?.returnTab,
  ])

  const clearQueryFlags = useCallback(() => {
    if (
      !searchParams.has("new") &&
      !searchParams.has("classId") &&
      !searchParams.has("mode")
    )
      return
    const next = new URLSearchParams(searchParams)
    next.delete("new")
    next.delete("classId")
    next.delete("mode")
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const load = useCallback(async () => {
    if (!dealId) return
    setLoading(true)
    try {
      const { bundle } = await fetchClassSetup(dealId)
      setDealName(bundle.dealName)
      setMeta(bundle.meta)
      setClasses(bundle.classes)
      return bundle.classes
    } catch (err) {
      toast.error(
        "Could not load class setup",
        err instanceof Error ? err.message : "Try again later.",
      )
      return [] as ClassSetupClass[]
    } finally {
      setLoading(false)
    }
  }, [dealId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setAppDocumentTitle("Class Setup")
  }, [])

  const handleAddClass = useCallback(
    async (classType: ClassSetupType): Promise<ClassSetupClass | null> => {
      if (!dealId) return null
      try {
        const created = await createClassSetupClassApi(dealId, classType)
        const next = { ...created, expanded: true }
        setClasses((prev) => {
          const list = [...prev, next]
          setMeta((m) => ({
            ...m,
            promote: normalizePromoteShares(m.promote, list),
          }))
          return list
        })
        setFocusClassKey(next.id || next.clientKey)
        setShowCreatePanel(false)
        toast.success("Class added", `${created.name} was created. Fill in the row, then Save.`)
        return next
      } catch {
        const local = createLocalClass(classType, classes.length)
        setClasses((prev) => {
          const list = [...prev, local]
          setMeta((m) => ({
            ...m,
            promote: normalizePromoteShares(m.promote, list),
          }))
          return list
        })
        setFocusClassKey(local.clientKey)
        setShowCreatePanel(false)
        return local
      }
    },
    [classes.length, dealId],
  )

  // Add Investor Class (?mode=create / ?new=lp) and Edit (?classId=) entry points
  useEffect(() => {
    if (loading || bootstrappedQueryRef.current) return

    const mode = searchParams.get("mode")?.trim().toLowerCase() || ""
    const newType = parseNewClassType(searchParams.get("new"))
    const editId = searchParams.get("classId")?.trim() || ""

    if (mode !== "create" && !newType && !editId) return

    bootstrappedQueryRef.current = true
    clearQueryFlags()

    if (mode === "create") {
      setShowCreatePanel(true)
      return
    }

    if (newType) {
      setShowCreatePanel(true)
      void handleAddClass(newType)
      return
    }

    if (editId) setFocusClassKey(editId)
  }, [clearQueryFlags, handleAddClass, loading, searchParams])

  useEffect(() => {
    bootstrappedQueryRef.current = false
  }, [dealId])

  const validation = useMemo(
    () => validateClassSetupLocal({ meta, classes }),
    [meta, classes],
  )

  const totals = useMemo(
    () => computeClassSetupTotals(meta, classes),
    [meta, classes],
  )

  async function handleDuplicate(classItem: ClassSetupClass) {
    if (!dealId) return
    if (classItem.id) {
      try {
        const dup = await duplicateClassSetupClassApi(dealId, classItem.id)
        const next = { ...dup, expanded: true }
        setClasses((prev) => {
          const list = [...prev, next]
          setMeta((m) => ({
            ...m,
            promote: normalizePromoteShares(m.promote, list),
          }))
          return list
        })
        setFocusClassKey(next.id || next.clientKey)
        toast.success("Class duplicated", `${dup.name} was created.`)
        return
      } catch (err) {
        toast.error(
          "Duplicate failed",
          err instanceof Error ? err.message : "Try again.",
        )
        return
      }
    }
    const copy: ClassSetupClass = {
      ...classItem,
      id: undefined,
      clientKey: `local_${Date.now().toString(36)}`,
      name: `${classItem.name} (copy)`,
      displayOrder: classes.length,
      expanded: true,
    }
    setClasses((prev) => {
      const list = [...prev, copy]
      setMeta((m) => ({
        ...m,
        promote: normalizePromoteShares(m.promote, list),
      }))
      return list
    })
    setFocusClassKey(copy.clientKey)
  }

  async function handleDeleteConfirm() {
    if (!dealId || !deleteTarget) return
    const classItem = deleteTarget
    const key = classItem.id || classItem.clientKey
    setDeleteBusy(true)
    try {
      if (classItem.id) {
        await deleteClassSetupClassApi(dealId, classItem.id)
      }
      setClasses((prev) => {
        const list = prev.filter((c) => (c.id || c.clientKey) !== key)
        setMeta((m) => ({
          ...m,
          promote: normalizePromoteShares(
            removeClassFromPromote(m.promote, key),
            list,
          ),
        }))
        return list
      })
      setDeleteTarget(null)
      if (focusClassKey === key) setFocusClassKey(null)
      toast.success("Class deleted")
    } catch (err) {
      toast.error(
        "Delete failed",
        err instanceof Error ? err.message : "Try again.",
      )
    } finally {
      setDeleteBusy(false)
    }
  }

  async function handleSave() {
    if (!dealId || !validation.canSave || saving) return
    setSaving(true)
    try {
      const promote = normalizePromoteShares(meta.promote, classes)
      const { bundle } = await saveClassSetup(
        dealId,
        { ...meta, promote },
        classes,
      )
      setMeta(bundle.meta)
      setClasses(bundle.classes)
      toast.success("Class setup saved")
    } catch (err) {
      toast.error(
        "Save failed",
        err instanceof Error ? err.message : "Check validations and try again.",
      )
    } finally {
      setSaving(false)
    }
  }

  function scrollToPromote() {
    document
      .getElementById("promote-section")
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const promoteNormalized = useMemo(
    () => normalizePromoteShares(meta.promote ?? emptyPromoteSchedule(), classes),
    [meta.promote, classes],
  )

  const promoteStageLabels = useMemo(() => {
    const labels = ["Base"]
    promoteNormalized.hurdles.forEach((h, i) => {
      labels.push(`After H${i + 1} · ${h.rate || 0}%`)
    })
    return labels
  }, [promoteNormalized.hurdles])

  if (!dealId) {
    return (
      <div className="deals_list_page deals_detail_page deals_class_setup_page">
        <p className="deals_list_not_found">Missing deal.</p>
        <Link to="/deals" className="deals_list_inline_back">
          Back to deals
        </Link>
      </div>
    )
  }

  const distributionSetupHref = `/deals/${encodeURIComponent(dealId)}/distribution-setup`

  return (
    <div className="deals_list_page deals_detail_page deals_class_setup_page">
      <header className="deals_list_head cs_page_header">
        <div className="deals_list_title_row">
          <button
            type="button"
            className="deals_list_back_circle"
            onClick={goBack}
            aria-label="Back to deal"
          >
            <ArrowLeft size={20} strokeWidth={2} aria-hidden />
          </button>
          <div className="cs_page_header_text">
            <h1 className="deals_list_title">Class Setup</h1>
            <p className="cs_page_subtitle">
              {dealName ? `${dealName} · ` : ""}
              Add, edit, and manage investor classes
            </p>
          </div>
        </div>
        <div className="cs_page_header_actions">
          <Link
            to={distributionSetupHref}
            state={returnState}
            className="cs_add_btn"
          >
            Distribution Setup
          </Link>
        </div>
      </header>

      {loading ? (
        <ClassSetupSkeleton />
      ) : (
        <div className="cs_page_body">
          {showCreatePanel ? (
            <section className="cs_create_panel" aria-label="Create investor class">
              <div className="cs_create_panel_head">
                <div>
                  <h2 className="cs_create_panel_title">Create investor class</h2>
                  <p className="cs_create_panel_sub">
                    Choose a class type to add a row. Edit the fields in the table,
                    then click Save.
                  </p>
                </div>
                <button
                  type="button"
                  className="cs_subtle_btn"
                  onClick={() => setShowCreatePanel(false)}
                >
                  Dismiss
                </button>
              </div>
              <div className="cs_create_type_grid">
                {NEW_CLASS_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`cs_create_type_btn tone-${CLASS_TYPE_META[t].tone}`}
                    onClick={() => void handleAddClass(t)}
                  >
                    <span className={`cs_swatch ${CLASS_TYPE_META[t].tone}`} />
                    <strong>{CLASS_TYPE_META[t].label}</strong>
                    <span>Add {CLASS_TYPE_META[t].shortLabel}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <CapitalizationCard
            totals={totals}
            targetRaise={meta.targetRaise}
            onTargetRaiseChange={(targetRaise) =>
              setMeta((m) => ({ ...m, targetRaise }))
            }
          />

          <SetupValidationPanel validation={validation} />

          <ClassSetupTable
            classes={classes}
            ownershipTotal={totals.equityOwnershipTotal}
            totalFunded={totals.actuallyFunded}
            focusClassKey={focusClassKey}
            promoteShares={promoteNormalized.shares}
            promoteStageLabels={promoteStageLabels}
            canSave={validation.canSave}
            saving={saving}
            onSave={() => void handleSave()}
            onGotoPromote={scrollToPromote}
            onPromoteShareChange={(classKey, stage, value) => {
              setMeta((m) => ({
                ...m,
                promote: updatePromoteShare(
                  normalizePromoteShares(m.promote, classes),
                  classKey,
                  stage,
                  value,
                ),
              }))
            }}
            onChange={(key, next) => {
              setClasses((prev) =>
                prev.map((c) => ((c.id || c.clientKey) === key ? next : c)),
              )
            }}
            onAdd={(classType) => void handleAddClass(classType)}
            onDuplicate={(classItem) => void handleDuplicate(classItem)}
            onDelete={(classItem) => setDeleteTarget(classItem)}
          />

          <PromoteScheduleSection
            promote={promoteNormalized}
            classes={classes}
            onChange={(promote) =>
              setMeta((m) => ({
                ...m,
                promote: normalizePromoteShares(promote, classes),
              }))
            }
          />

          <ConfirmDeleteModal
            open={deleteTarget != null}
            title="Delete investor class"
            message="Are you sure you want to delete this investor class? This cannot be undone."
            itemLabel={deleteTarget?.name}
            busy={deleteBusy}
            onCancel={() => {
              if (deleteBusy) return
              setDeleteTarget(null)
            }}
            onConfirm={() => void handleDeleteConfirm()}
          />
        </div>
      )}
    </div>
  )
}
