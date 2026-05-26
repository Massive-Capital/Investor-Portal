import type { DealEsignTemplateFileRecord } from "@/modules/Syndication/Deals/api/dealsApi"
import type { InvestorQuestionnaireConfig } from "@/modules/Syndication/Deals/tabs/esign_templates/investorQuestionnaire.types"
import { sortSections } from "@/modules/Syndication/Deals/tabs/esign_templates/investorQuestionnaire.types"
import { isQuestionnaireSectionVisibleForProfile } from "@/modules/Syndication/Deals/tabs/esign_templates/investorQuestionnaireProfileVisibility"

/** Maps commitment `profile_id` to eSign template `categoryId`. */
export function esignCategoryIdFromCommitmentProfile(
  commitmentProfileId: string,
): string {
  const id = commitmentProfileId.trim()
  if (id === "llc_corp_trust_etc") return "llc"
  if (id === "custodian_ira_401k") return "custodian_ira_401k"
  if (id === "joint_tenancy") return "joint_tenancy"
  return "individual"
}

export function esignTemplateForCategory(
  filesByCategory: Record<string, DealEsignTemplateFileRecord[]>,
  categoryId: string,
): DealEsignTemplateFileRecord | undefined {
  const files = filesByCategory[categoryId] ?? []
  return files[0]
}

/** Keep only documents for the investor's selected profile category (lead sponsor templates). */
export function filterMyEsignDocumentsForCategory<
  T extends { categoryId?: string },
>(documents: T[], categoryId: string): T[] {
  const cat = categoryId.trim()
  if (!cat) return documents
  return documents.filter((d) => {
    const docCat = d.categoryId?.trim()
    return !docCat || docCat === cat
  })
}

export function sponsorIncludedQuestionnaireOnTemplate(
  file: DealEsignTemplateFileRecord | undefined,
): boolean {
  return Boolean(file?.includeQuestionnaire)
}

export type VisibleQuestionnaireSection = {
  id: string
  label: string
}

/** Sections the sponsor left enabled for this profile on Manage Questionnaire. */
export function visibleQuestionnaireSectionsForProfile(
  config: InvestorQuestionnaireConfig | null | undefined,
  esignCategoryId: string,
): VisibleQuestionnaireSection[] {
  if (!config?.sections?.length) return []
  const visibility = config.profileSectionVisibility
  return sortSections(config.sections)
    .filter((section) =>
      isQuestionnaireSectionVisibleForProfile(
        visibility,
        esignCategoryId,
        section.id,
      ),
    )
    .map((section) => ({ id: section.id, label: section.label }))
}

/** Workflow label for the current profile's e-sign documents only (not other profiles). */
export function investNowWorkflowLabelForProfileDocs(
  documents: { status: string }[],
): string | null {
  if (documents.length === 0) return null
  if (documents.every((d) => d.status === "signed")) return "Completed"
  if (documents.some((d) => d.status !== "signed")) return "Sent"
  return null
}

/** True when the investor should see questionnaire steps (template + profile sections). */
export function questionnaireIncludedInInvestNowFlow(params: {
  template: DealEsignTemplateFileRecord | undefined
  config: InvestorQuestionnaireConfig | null | undefined
  esignCategoryId: string
}): boolean {
  if (!sponsorIncludedQuestionnaireOnTemplate(params.template)) return false
  return (
    visibleQuestionnaireSectionsForProfile(
      params.config,
      params.esignCategoryId,
    ).length > 0
  )
}
