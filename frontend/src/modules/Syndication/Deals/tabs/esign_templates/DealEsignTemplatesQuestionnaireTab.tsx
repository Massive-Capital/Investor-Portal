import { Pencil, Plus, Settings2, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { TabsScrollStrip } from "@/common/components/tabs-scroll-strip/TabsScrollStrip"
import { toast } from "@/common/components/Toast"
import {
  fetchDealInvestorQuestionnaire,
  putDealInvestorQuestionnaire,
  type InvestorQuestionnaireConfig,
  type InvestorQuestionnaireQuestion,
  type InvestorQuestionnaireSection,
} from "@/modules/Syndication/Deals/api/dealsApi"
import {
  getDefaultInvestorQuestionnaireConfig,
  mergeQuestionnaireWithDefaults,
  questionsForSection,
  sortSections,
} from "./investorQuestionnaire.types"
import { ManageQuestionnaireModal } from "./ManageQuestionnaireModal"
import { QuestionnaireQuestionCard } from "./QuestionnaireQuestionCard"

interface DealEsignTemplatesQuestionnaireTabProps {
  dealId: string
  canEdit?: boolean
}

function sectionTabId(sectionId: string): string {
  return `deal-esign-q-section-${sectionId}`
}

export function DealEsignTemplatesQuestionnaireTab({
  dealId,
  canEdit = true,
}: DealEsignTemplatesQuestionnaireTabProps) {
  const [config, setConfig] = useState<InvestorQuestionnaireConfig>(() =>
    getDefaultInvestorQuestionnaireConfig(),
  )
  const [activeSectionId, setActiveSectionId] = useState("personal")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [sectionLabelDraft, setSectionLabelDraft] = useState("")
  const seededRef = useRef(false)
  const [expandQuestionId, setExpandQuestionId] = useState<string | null>(null)
  const [manageModalOpen, setManageModalOpen] = useState(false)

  const createCustomQuestion = useCallback(
    (sectionId: string, sortOrder: number): InvestorQuestionnaireQuestion => ({
      id: `question_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sectionId,
      label: "Check Label",
      sortOrder,
      required: false,
      fieldType: "checkboxes",
      options: ["One"],
    }),
    [],
  )

  const persist = useCallback(
    async (next: InvestorQuestionnaireConfig) => {
      if (!canEdit) return true
      setSaving(true)
      try {
        const result = await putDealInvestorQuestionnaire(dealId, next)
        if (result.ok) {
          setConfig(mergeQuestionnaireWithDefaults(result.config).config)
          return true
        }
        toast.error("Could not save questionnaire", result.message)
        return false
      } finally {
        setSaving(false)
      }
    },
    [canEdit, dealId],
  )

  const updateConfig = useCallback(
    (
      updater: (prev: InvestorQuestionnaireConfig) => InvestorQuestionnaireConfig,
      options?: { persist?: boolean },
    ) => {
      setConfig((prev) => {
        const next = updater(prev)
        if (options?.persist !== false && canEdit) {
          void persist(next)
        }
        return next
      })
    },
    [canEdit, persist],
  )

  useEffect(() => {
    let cancelled = false
    seededRef.current = false
    void (async () => {
      setLoading(true)
      const result = await fetchDealInvestorQuestionnaire(dealId)
      if (cancelled) return
      if (result.ok) {
        const isEmpty = result.config.sections.length === 0
        const merged = isEmpty
          ? {
              config: getDefaultInvestorQuestionnaireConfig(),
              needsUpdate: true,
            }
          : mergeQuestionnaireWithDefaults(result.config)
        const next = merged.config
        setConfig(next)
        const sections = sortSections(next.sections)
        if (sections.length > 0) {
          setActiveSectionId(sections[0]!.id)
        }
        const needsSeed = merged.needsUpdate
        if (canEdit && needsSeed && !seededRef.current) {
          seededRef.current = true
          const saveResult = await putDealInvestorQuestionnaire(dealId, next)
          if (!cancelled && saveResult.ok) {
            setConfig(
              mergeQuestionnaireWithDefaults(saveResult.config).config,
            )
          }
        }
      } else {
        toast.error("Could not load questionnaire", result.message)
        const fallback = getDefaultInvestorQuestionnaireConfig()
        setConfig(fallback)
        setActiveSectionId("personal")
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [canEdit, dealId])

  const sections = sortSections(config.sections)
  const activeSection =
    sections.find((s) => s.id === activeSectionId) ?? sections[0]
  const activeQuestions = activeSection
    ? questionsForSection(config.questions, activeSection.id)
    : []

  const onToggleRequired = useCallback(
    (questionId: string, required: boolean) => {
      updateConfig((prev) => ({
        ...prev,
        questions: prev.questions.map((q) =>
          q.id === questionId && !q.isDefault ? { ...q, required } : q,
        ),
      }))
    },
    [updateConfig],
  )

  const onUpdateQuestion = useCallback(
    (
      questionId: string,
      patch: Partial<
        Pick<
          InvestorQuestionnaireQuestion,
          "label" | "fieldType" | "subtext" | "required" | "options"
        >
      >,
    ) => {
      updateConfig((prev) => ({
        ...prev,
        questions: prev.questions.map((q) => {
          if (q.id !== questionId) return q
          const safePatch = q.isDefault
            ? {
                ...(patch.subtext !== undefined ? { subtext: patch.subtext } : {}),
                ...(patch.options !== undefined ? { options: patch.options } : {}),
              }
            : patch
          const next = { ...q, ...safePatch }
          const subtext = next.subtext?.trim()
          if (!subtext) delete next.subtext
          else next.subtext = subtext
          if (next.fieldType === "radio" || next.fieldType === "checkboxes") {
            const opts = (next.options ?? [])
              .map((o) => o.trim())
              .filter(Boolean)
            if (opts.length > 0) next.options = opts
            else delete next.options
          } else {
            delete next.options
          }
          return next
        }),
      }))
    },
    [updateConfig],
  )

  const onDeleteQuestion = useCallback(
    (question: InvestorQuestionnaireQuestion) => {
      if (question.isDefault) return
      updateConfig((prev) => ({
        ...prev,
        questions: prev.questions.filter((q) => q.id !== question.id),
      }))
    },
    [updateConfig],
  )

  const onAddField = useCallback(() => {
    if (!activeSection || activeSection.isDefault) return
    const question = createCustomQuestion(
      activeSection.id,
      activeQuestions.length,
    )
    setExpandQuestionId(question.id)
    updateConfig((prev) => ({
      ...prev,
      questions: [...prev.questions, question],
    }))
  }, [activeSection, activeQuestions.length, createCustomQuestion, updateConfig])

  const onAddSection = useCallback(() => {
    const id = `section_${Date.now()}`
    const firstQuestion = createCustomQuestion(id, 0)
    updateConfig((prev) => {
      const maxOrder = prev.sections.reduce(
        (m, s) => Math.max(m, s.sortOrder),
        -1,
      )
      const nextSection: InvestorQuestionnaireSection = {
        id,
        label: "New section",
        sortOrder: maxOrder + 1,
      }
      return {
        ...prev,
        sections: [...prev.sections, nextSection],
        questions: [...prev.questions, firstQuestion],
      }
    })
    setActiveSectionId(id)
    setEditingSectionId(id)
    setSectionLabelDraft("New section")
    setExpandQuestionId(firstQuestion.id)
  }, [createCustomQuestion, updateConfig])

  const onRemoveSection = useCallback(
    (sectionId: string) => {
      const section = config.sections.find((s) => s.id === sectionId)
      if (!section || section.isDefault) return
      updateConfig((prev) => ({
        ...prev,
        sections: prev.sections.filter((s) => s.id !== sectionId),
        questions: prev.questions.filter((q) => q.sectionId !== sectionId),
      }))
      if (activeSectionId === sectionId) {
        const remaining = sortSections(
          config.sections.filter((s) => s.id !== sectionId),
        )
        setActiveSectionId(remaining[0]?.id ?? "personal")
      }
    },
    [activeSectionId, config.sections, updateConfig],
  )

  const commitSectionLabel = useCallback(
    (sectionId: string) => {
      const label = sectionLabelDraft.trim() || "New section"
      updateConfig((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId ? { ...s, label } : s,
        ),
      }))
      setEditingSectionId(null)
    },
    [sectionLabelDraft, updateConfig],
  )

  return (
    <div
      className={`deal_esign_questionnaire_root${loading ? " deal_esign_questionnaire_root_loading" : ""}`}
      aria-busy={loading || saving}
    >
      {!canEdit ? (
        <p className="deal_esign_readonly_banner" role="note">
          You can view the investor questionnaire. Editing is restricted to the
          lead sponsor.
        </p>
      ) : null}

      <div className="deal_esign_questionnaire_toolbar">
        <button
          type="button"
          className="deal_esign_questionnaire_manage_btn"
          disabled={loading || saving}
          onClick={() => setManageModalOpen(true)}
        >
          <Settings2 size={16} strokeWidth={2} aria-hidden />
          Manage Questionnaire
        </button>
      </div>

      <ManageQuestionnaireModal
        open={manageModalOpen}
        sections={sections}
        visibility={config.profileSectionVisibility}
        canEdit={canEdit}
        saving={saving}
        onClose={() => setManageModalOpen(false)}
        onVisibilityChange={(profileSectionVisibility) => {
          updateConfig((prev) => ({
            ...prev,
            profileSectionVisibility,
          }))
        }}
      />

      <div className="deal_esign_questionnaire_sections_outer">
        <TabsScrollStrip scrollClassName="deal_esign_questionnaire_sections_scroll">
          <div
            className="deal_esign_questionnaire_sections_row"
            role="tablist"
            aria-label="Questionnaire sections"
          >
            {sections.map((section) => {
              const isActive = section.id === activeSectionId
              const isEditing = editingSectionId === section.id
              const tabId = sectionTabId(section.id)
              return (
                <div
                  key={section.id}
                  className={`deal_esign_questionnaire_section_tab${isActive ? " deal_esign_questionnaire_section_tab_active" : ""}`}
                >
                  <button
                    type="button"
                    id={tabId}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls="deal-esign-questionnaire-panel"
                    className="deal_esign_questionnaire_section_tab_btn"
                    onClick={() => {
                      setActiveSectionId(section.id)
                      setEditingSectionId(null)
                    }}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        className="deal_esign_questionnaire_section_edit_input"
                        value={sectionLabelDraft}
                        aria-label="Section name"
                        autoFocus
                        onChange={(e) => setSectionLabelDraft(e.target.value)}
                        onBlur={() => commitSectionLabel(section.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            commitSectionLabel(section.id)
                          }
                          if (e.key === "Escape") {
                            setEditingSectionId(null)
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span>{section.label}</span>
                    )}
                  </button>
                  {canEdit ? (
                    <>
                      <button
                        type="button"
                        className="deal_esign_questionnaire_section_icon_btn"
                        aria-label={`Rename ${section.label}`}
                        onClick={() => {
                          setActiveSectionId(section.id)
                          setEditingSectionId(section.id)
                          setSectionLabelDraft(section.label)
                        }}
                      >
                        <Pencil size={14} strokeWidth={2} aria-hidden />
                      </button>
                      {!section.isDefault ? (
                        <button
                          type="button"
                          className="deal_esign_questionnaire_section_icon_btn deal_esign_questionnaire_section_icon_btn_danger"
                          aria-label={`Remove ${section.label}`}
                          onClick={() => onRemoveSection(section.id)}
                        >
                          <X size={14} strokeWidth={2} aria-hidden />
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              )
            })}
            {canEdit ? (
              <button
                type="button"
                className="deal_esign_questionnaire_add_section_btn"
                aria-label="Add section"
                onClick={onAddSection}
              >
                <Plus size={18} strokeWidth={2} aria-hidden />
              </button>
            ) : null}
          </div>
        </TabsScrollStrip>
      </div>

      <div
        id="deal-esign-questionnaire-panel"
        role="tabpanel"
        aria-labelledby={
          activeSection ? sectionTabId(activeSection.id) : undefined
        }
        className="deal_esign_questionnaire_panel"
      >
        {activeSection ? (
          <ul
            className="deal_esign_questionnaire_questions"
            aria-label={`Questions in ${activeSection.label}`}
          >
            {activeQuestions.map((question, index) => (
              <QuestionnaireQuestionCard
                key={question.id}
                question={question}
                index={index}
                canEdit={canEdit}
                saving={saving}
                defaultExpanded={question.id === expandQuestionId}
                onToggleRequired={onToggleRequired}
                onUpdateQuestion={onUpdateQuestion}
                onDeleteQuestion={onDeleteQuestion}
              />
            ))}
          </ul>
        ) : null}
        {activeSection && canEdit && !activeSection.isDefault ? (
          <div className="deal_esign_questionnaire_add_field_wrap">
            <div className="deal_esign_questionnaire_add_field_rule" aria-hidden />
            <button
              type="button"
              className="deal_esign_questionnaire_add_field_btn"
              disabled={saving}
              onClick={onAddField}
            >
              <Plus size={16} strokeWidth={2} aria-hidden />
              Add field
            </button>
            <div className="deal_esign_questionnaire_add_field_rule" aria-hidden />
          </div>
        ) : null}
        {!activeSection ? (
          <p className="deal_esign_questionnaire_empty" role="status">
            No sections configured.
          </p>
        ) : null}
      </div>
    </div>
  )
}
