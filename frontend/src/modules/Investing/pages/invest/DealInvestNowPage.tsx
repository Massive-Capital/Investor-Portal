import { ArrowLeft, ChevronRight, Loader2, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { getSessionUserEmail } from "@/common/auth/sessionUserEmail"
import { toast } from "@/common/components/Toast"
import { setAppDocumentTitle } from "@/common/utils/appDocumentTitle"
import { usePortalMode } from "@/modules/Investing/context/PortalModeContext"
import type { SavedAddress } from "@/modules/Investing/pages/profiles/address.types"
import {
  fetchMyProfileBook,
  normalizeInvestorProfileListRow,
} from "@/modules/Investing/pages/profiles/investingProfileBookApi"
import type { InvestorProfileListRow } from "@/modules/Investing/pages/profiles/investor-profiles.types"
import { upsertRuntimeInvestmentRow } from "@/modules/Investing/pages/investments/investmentsRuntimeStore"
import {
  fetchInvestmentSignStatus,
  type InvestmentSignStatusPayload,
} from "@/modules/Investing/api/investmentSignatureApi"
import {
  patchMyLpDealInvestNowCommitment,
  postMyLpDealInvestNowEsignSend,
} from "@/modules/Syndication/Deals/api/lpInvestNowCommitmentApi"
import type { DealEsignTemplateFileRecord } from "@/modules/Syndication/Deals/api/dealsApi"
import {
  fetchDealById,
  fetchDealEsignTemplates,
  fetchDealInvestorClasses,
  fetchDealInvestorQuestionnaire,
  fetchDealInvestors,
  fetchDealMembers,
  fetchDealMyEsignDocuments,
} from "@/modules/Syndication/Deals/api/dealsApi"
import { esignCategoryLabel } from "@/modules/Syndication/Deals/utils/esignTemplateCategories"
import type { InvestorQuestionnaireConfig } from "@/modules/Syndication/Deals/tabs/esign_templates/investorQuestionnaire.types"
import { investorProfileLabel } from "@/modules/Syndication/Deals/constants/investor-profile"
import {
  EMPTY_INVESTORS_PAYLOAD,
  previewMinimumInvestmentDisplay,
} from "@/modules/Syndication/Deals/dealOfferingPreviewShared"
import type { DealInvestorClass } from "@/modules/Syndication/Deals/types/deal-investor-class.types"
import { dealWorkspacePath } from "@/modules/Syndication/Deals/utils/dealWorkspacePath"
import {
  ALL_SAVED_PROFILES_IN_USE_ON_DEAL_MSG,
  availableBookProfilesForCommitmentType,
  buildBlockedProfileKeysForInvestNow,
  CHOSEN_PROFILE_ALREADY_USED_MSG,
  lpProfileUseKey,
} from "@/modules/Syndication/Deals/utils/lpInvestNowProfileBlocking"
import {
  filterBookProfilesByCommitmentKind,
  NO_SAVED_PROFILES_FOR_INVESTOR_TYPE_MSG,
} from "@/modules/Syndication/Deals/utils/lpInvestNowSavedProfileOptions"
import {
  formatCurrencyUsdTypeInput,
  parseMoneyDigits,
} from "@/modules/Syndication/Deals/utils/offeringMoneyFormat"
import { getLpInvestNowPrefillFromPayload } from "@/modules/Syndication/Deals/utils/prefillLpInvestNowFields"
import {
  commitmentProfileIdFromBookProfile,
  resolveInvestNowInvestmentClassLabel,
  resolveInvestNowSponsorLabel,
} from "@/modules/Syndication/Deals/utils/resolveInvestNowDealContext"
import {
  buildInvestNowQuestionnairePrefill,
  mergeInvestNowQuestionnaireAnswers,
} from "./investNowQuestionnairePrefill"
import {
  validateInvestNowQuestionnaireAnswers,
  validateInvestNowQuestionnaireSection,
} from "./investNowQuestionnaireValidation"
import type { InvestNowQuestionnaireAnswers } from "./investNowQuestionnaireValidation"
import {
  buildInvestNowFlowSteps,
  investNowActiveStepperPhaseId,
  investNowFlowStepSubtitle,
} from "./investNowFlowSteps"
import { InvestNowFlowStepper } from "./InvestNowFlowStepper"
import { InvestNowQuestionnaireSectionStep } from "./InvestNowQuestionnaireSectionStep"
import { InvestNowW9Step } from "./InvestNowW9Step"
import {
  InvestNowEsignaturesStep,
  mapMyEsignDocumentsToInvestNowRows,
  type InvestNowEsignDocRow,
} from "./InvestNowEsignaturesStep"
import {
  buildInvestNowW9Prefill,
  investNowW9FormApiPayload,
  mergeInvestNowW9Values,
  validateInvestNowW9Form,
} from "./investNowW9FormUtils"
import { EMPTY_INVEST_NOW_W9 } from "./investNowW9.types"
import { InvestNowInvestmentStep } from "./InvestNowInvestmentStep"
import { InvestNowInvestorStep } from "./InvestNowInvestorStep"
import {
  esignCategoryIdFromCommitmentProfile,
  esignTemplateForCategory,
  filterMyEsignDocumentsForCategory,
  investNowWorkflowLabelForProfileDocs,
  questionnaireIncludedInInvestNowFlow,
  visibleQuestionnaireSectionsForProfile,
} from "./investNowEsignContext"
import "@/modules/Syndication/Deals/deals-list.css"
import "@/modules/Syndication/Deals/deals-create.css"
import "./invest-now-flow.css"

type InvestNowLocationState = {
  returnTo?: string
}

function formatDealCloseDateForInvestments(raw: string | undefined): string {
  const t = String(raw ?? "").trim()
  if (!t) return "—"
  const d = new Date(t)
  if (!Number.isFinite(d.getTime())) return t
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function DealInvestNowPage() {
  const { dealId: dealIdParam = "" } = useParams<{ dealId: string }>()
  const dealId = decodeURIComponent(dealIdParam.trim())
  const navigate = useNavigate()
  const location = useLocation()
  const { switchToInvesting } = usePortalMode()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [error, setError] = useState("")

  const [dealName, setDealName] = useState("")
  const [closeDate, setCloseDate] = useState<string | null>(null)
  const [offeringSize, setOfferingSize] = useState("")
  const [investmentClassLabel, setInvestmentClassLabel] = useState("—")
  const [sponsorLabel, setSponsorLabel] = useState("—")

  const [bookProfiles, setBookProfiles] = useState<
    { id: string; profileName: string; profileType: string }[]
  >([])
  const [bookProfileRows, setBookProfileRows] = useState<InvestorProfileListRow[]>(
    [],
  )
  const [bookAddresses, setBookAddresses] = useState<SavedAddress[]>([])
  const [bookLoading, setBookLoading] = useState(true)
  const [blockedProfileKeys, setBlockedProfileKeys] = useState<Set<string>>(
    () => new Set(),
  )

  const [savedUserProfileId, setSavedUserProfileId] = useState("")
  const [profileId, setProfileId] = useState("")
  const [investorClasses, setInvestorClasses] = useState<DealInvestorClass[]>(
    [],
  )
  const [amount, setAmount] = useState("")
  const [fundingMethod, setFundingMethod] = useState("")
  const [questionnaireAnswers, setQuestionnaireAnswers] =
    useState<InvestNowQuestionnaireAnswers>({})
  const [w9Values, setW9Values] = useState(EMPTY_INVEST_NOW_W9)
  const [esignFilesByCategory, setEsignFilesByCategory] = useState<
    Record<string, DealEsignTemplateFileRecord[]>
  >({})
  const [questionnaireConfig, setQuestionnaireConfig] =
    useState<InvestorQuestionnaireConfig | null>(null)
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [esignLoading, setEsignLoading] = useState(false)
  const [esignSendError, setEsignSendError] = useState<string | null>(null)
  const [esignSendOk, setEsignSendOk] = useState(false)
  const [esignDocuments, setEsignDocuments] = useState<InvestNowEsignDocRow[]>([])
  const [esignPending, setEsignPending] = useState(false)
  const [esignCompleted, setEsignCompleted] = useState(false)
  const [esignWorkflowLabel, setEsignWorkflowLabel] = useState<string | null>(
    null,
  )
  const [esignSignatureRequestId, setEsignSignatureRequestId] = useState<
    string | null
  >(null)
  const [investNowInvestmentId, setInvestNowInvestmentId] = useState<
    string | null
  >(null)
  const [webhookSignStatus, setWebhookSignStatus] =
    useState<InvestmentSignStatusPayload | null>(null)
  const [signStatusLoading, setSignStatusLoading] = useState(false)
  const [status, setStatus] = useState("")
  const [docSignedDate, setDocSignedDate] = useState("")

  const minimumInvestmentHint = useMemo(() => {
    const display = previewMinimumInvestmentDisplay(investorClasses)
    if (!display || display === "—") return ""
    return `Minimum is ${display}`
  }, [investorClasses])

  const esignCategoryId = useMemo(
    () => esignCategoryIdFromCommitmentProfile(profileId),
    [profileId],
  )

  const esignTemplate = useMemo(
    () => esignTemplateForCategory(esignFilesByCategory, esignCategoryId),
    [esignFilesByCategory, esignCategoryId],
  )

  const visibleQuestionnaireSections = useMemo(
    () =>
      visibleQuestionnaireSectionsForProfile(
        questionnaireConfig,
        esignCategoryId,
      ),
    [questionnaireConfig, esignCategoryId],
  )

  const questionnaireInFlow = useMemo(
    () =>
      questionnaireIncludedInInvestNowFlow({
        template: esignTemplate,
        config: questionnaireConfig,
        esignCategoryId,
      }),
    [esignTemplate, questionnaireConfig, esignCategoryId],
  )

  const flowSteps = useMemo(
    () =>
      buildInvestNowFlowSteps({
        showQuestionnaire: questionnaireInFlow,
        visibleSections: visibleQuestionnaireSections,
      }),
    [questionnaireInFlow, visibleQuestionnaireSections],
  )

  const currentStep = flowSteps[stepIndex] ?? flowSteps[0]

  const firstQuestionnaireStepIndex = useMemo(
    () => flowSteps.findIndex((s) => s.kind === "questionnaire"),
    [flowSteps],
  )

  const w9StepIndex = useMemo(
    () => flowSteps.findIndex((s) => s.kind === "w9"),
    [flowSteps],
  )

  const esignStepIndex = useMemo(
    () => flowSteps.findIndex((s) => s.kind === "esignatures"),
    [flowSteps],
  )

  useEffect(() => {
    setStepIndex((index) => Math.min(index, Math.max(0, flowSteps.length - 1)))
  }, [flowSteps.length])

  const minimumInvestmentAmount = useMemo(() => {
    const display = previewMinimumInvestmentDisplay(investorClasses)
    if (!display || display === "—") return null
    const n = parseMoneyDigits(display)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [investorClasses])

  const backTo = useMemo(() => {
    const fromState = (location.state as InvestNowLocationState | null)
      ?.returnTo?.trim()
    if (fromState) return fromState
    return dealId ? dealWorkspacePath(dealId) : "/investing/investments"
  }, [dealId, location.state])

  useEffect(() => {
    switchToInvesting()
  }, [switchToInvesting])

  useEffect(() => {
    if (!dealId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const em = getSessionUserEmail()?.trim().toLowerCase() ?? ""
    void (async () => {
      try {
        const [deal, classes, inv, members, book] = await Promise.all([
          fetchDealById(dealId),
          fetchDealInvestorClasses(dealId).catch(() => []),
          fetchDealInvestors(dealId, { lpInvestorsOnly: true }).catch(
            () => EMPTY_INVESTORS_PAYLOAD,
          ),
          fetchDealMembers(dealId).catch(() => []),
          fetchMyProfileBook().catch(() => ({
            profiles: [] as InvestorProfileListRow[],
            beneficiaries: [],
            addresses: [] as SavedAddress[],
          })),
        ])
        if (cancelled) return

        const name =
          deal.dealName?.trim() || deal.propertyName?.trim() || "Deal"
        setDealName(name)
        setCloseDate(deal.closeDate)
        setOfferingSize(deal.offeringSize?.trim() ?? "")
        setAppDocumentTitle(`Invest — ${name}`)

        const rows = (book.profiles ?? []).map((p) =>
          normalizeInvestorProfileListRow(p),
        )
        setBookProfileRows(rows)
        setBookAddresses((book.addresses ?? []) as SavedAddress[])
        setBookProfiles(
          rows.map((p) => ({
            id: p.id,
            profileName: p.profileName,
            profileType: p.profileType,
          })),
        )

        const prefill = em
          ? getLpInvestNowPrefillFromPayload(inv, em)
          : null
        setBlockedProfileKeys(
          buildBlockedProfileKeysForInvestNow(
            inv.investors,
            em,
            prefill?.viewerRowId,
          ),
        )
        setInvestorClasses(classes)
        setSponsorLabel(resolveInvestNowSponsorLabel(deal, members))

        const viewerClass = prefill
          ? inv.investors.find(
              (r) =>
                String(r.userEmail ?? "").trim().toLowerCase() === em,
            )?.investorClass
          : undefined
        setInvestmentClassLabel(
          resolveInvestNowInvestmentClassLabel(classes, prefill, viewerClass),
        )

        if (prefill) {
          setProfileId(prefill.profileId)
          setSavedUserProfileId(prefill.userInvestorProfileId ?? "")
          setAmount(
            prefill.amount.trim()
              ? formatCurrencyUsdTypeInput(prefill.amount)
              : "",
          )
          setStatus(prefill.status)
          setDocSignedDate(prefill.docSignedDate)
        }
      } catch {
        if (!cancelled) navigate(backTo, { replace: true })
      } finally {
        if (!cancelled) {
          setBookLoading(false)
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dealId, navigate, backTo])

  const selectedBookProfile = useMemo(
    () => bookProfiles.find((p) => p.id === savedUserProfileId),
    [bookProfiles, savedUserProfileId],
  )

  useEffect(() => {
    if (!selectedBookProfile) return
    const next = commitmentProfileIdFromBookProfile(selectedBookProfile)
    if (next) setProfileId(next)
  }, [selectedBookProfile])

  useEffect(() => {
    setEsignDocuments([])
    setEsignCompleted(false)
    setEsignPending(false)
    setEsignSignatureRequestId(null)
    setEsignSendOk(false)
    setEsignSendError(null)
  }, [profileId])

  useEffect(() => {
    if (!questionnaireInFlow) setQuestionnaireAnswers({})
  }, [questionnaireInFlow])

  useEffect(() => {
    if (!questionnaireInFlow || !savedUserProfileId.trim()) return
    const prefill = buildInvestNowQuestionnairePrefill({
      profiles: bookProfileRows,
      addresses: bookAddresses,
      savedUserProfileId,
      config: questionnaireConfig,
      sectionId: "personal",
    })
    setQuestionnaireAnswers((prev) =>
      mergeInvestNowQuestionnaireAnswers(prev, prefill),
    )
  }, [
    questionnaireInFlow,
    savedUserProfileId,
    bookProfileRows,
    bookAddresses,
    questionnaireConfig,
  ])

  useEffect(() => {
    if (!dealId || !profileId.trim()) return
    let cancelled = false
    setDocumentsLoading(true)
    void (async () => {
      const [esignRes, questionnaireRes] = await Promise.all([
        fetchDealEsignTemplates(dealId),
        fetchDealInvestorQuestionnaire(dealId),
      ])
      if (cancelled) return
      if (esignRes.ok) setEsignFilesByCategory(esignRes.filesByCategory)
      if (questionnaireRes.ok) setQuestionnaireConfig(questionnaireRes.config)
      setDocumentsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [dealId, profileId])

  useEffect(() => {
    if (!savedUserProfileId.trim()) return
    const prefill = buildInvestNowW9Prefill({
      profiles: bookProfileRows,
      addresses: bookAddresses,
      savedUserProfileId,
      questionnaireAnswers,
    })
    setW9Values((prev) => mergeInvestNowW9Values(prev, prefill))
  }, [
    savedUserProfileId,
    bookProfileRows,
    bookAddresses,
    questionnaireAnswers,
  ])

  useEffect(() => {
    if (stepIndex !== w9StepIndex || w9StepIndex < 0 || !savedUserProfileId.trim()) {
      return
    }
    const prefill = buildInvestNowW9Prefill({
      profiles: bookProfileRows,
      addresses: bookAddresses,
      savedUserProfileId,
      questionnaireAnswers,
    })
    setW9Values((prev) => mergeInvestNowW9Values(prev, prefill))
  }, [
    stepIndex,
    w9StepIndex,
    savedUserProfileId,
    bookProfileRows,
    bookAddresses,
    questionnaireAnswers,
  ])

  const profileDropdownOptions = useMemo(() => {
    const active = bookProfiles.filter((p) => p.profileName?.trim())
    return active.map((p) => {
      const pid = commitmentProfileIdFromBookProfile(p)
      const key = lpProfileUseKey(pid, p.id)
      return {
        value: p.id,
        label: p.profileName.trim(),
        disabled: !pid || blockedProfileKeys.has(key),
      }
    })
  }, [bookProfiles, blockedProfileKeys])

  const validateInvestorStep = useCallback((): string | null => {
    if (bookLoading) return "Loading your saved profiles…"
    if (!savedUserProfileId.trim()) return "Select a profile"
    if (!profileId.trim()) return "This profile type cannot be used for this deal"
    const matching = filterBookProfilesByCommitmentKind(bookProfiles, profileId)
    if (matching.length === 0) return NO_SAVED_PROFILES_FOR_INVESTOR_TYPE_MSG
    const available = availableBookProfilesForCommitmentType(
      profileId,
      bookProfiles,
      blockedProfileKeys,
    )
    if (available.length === 0) return ALL_SAVED_PROFILES_IN_USE_ON_DEAL_MSG
    const k = lpProfileUseKey(profileId.trim(), savedUserProfileId)
    if (blockedProfileKeys.has(k)) return CHOSEN_PROFILE_ALREADY_USED_MSG
    if (!investmentClassLabel.trim() || investmentClassLabel === "—") {
      return "No investment class is configured for this deal"
    }
    if (!sponsorLabel.trim() || sponsorLabel === "—") {
      return "Sponsor information is not available for this deal"
    }
    return null
  }, [
    bookLoading,
    savedUserProfileId,
    profileId,
    bookProfiles,
    blockedProfileKeys,
    investmentClassLabel,
    sponsorLabel,
  ])

  const onContinueFromInvestor = useCallback(() => {
    const msg = validateInvestorStep()
    if (msg) {
      setError(msg)
      return
    }
    setError("")
    setStepIndex(1)
  }, [validateInvestorStep])

  const validateInvestmentStep = useCallback((): string | null => {
    const n = parseMoneyDigits(String(amount).trim())
    if (!Number.isFinite(n) || n <= 0) {
      return "Enter an investment amount greater than 0"
    }
    if (
      minimumInvestmentAmount != null &&
      n < minimumInvestmentAmount
    ) {
      const minLabel = previewMinimumInvestmentDisplay(investorClasses)
      return minLabel && minLabel !== "—"
        ? `Investment amount must be at least ${minLabel}`
        : `Investment amount must be at least ${minimumInvestmentAmount}`
    }
    if (!fundingMethod.trim()) {
      return "Select a funding method"
    }
    return null
  }, [
    amount,
    fundingMethod,
    investorClasses,
    minimumInvestmentAmount,
    minimumInvestmentHint,
  ])

  const validateAllQuestionnaireAndW9 = useCallback((): string | null => {
    if (documentsLoading) return "Loading documents…"
    if (questionnaireInFlow) {
      const questionnaireErr = validateInvestNowQuestionnaireAnswers({
        config: questionnaireConfig,
        visibleSections: visibleQuestionnaireSections,
        answers: questionnaireAnswers,
      })
      if (questionnaireErr) return questionnaireErr
    }
    return validateInvestNowW9Form(w9Values)
  }, [
    documentsLoading,
    questionnaireInFlow,
    visibleQuestionnaireSections,
    questionnaireConfig,
    questionnaireAnswers,
    w9Values,
  ])

  const goToStepIndexForValidationError = useCallback(
    (message: string) => {
      if (message.includes("investment amount") || message.includes("funding")) {
        setStepIndex(1)
        return
      }
      if (message.includes("profile") || message.includes("Sponsor")) {
        setStepIndex(0)
        return
      }
      if (questionnaireInFlow && firstQuestionnaireStepIndex >= 0) {
        for (const section of visibleQuestionnaireSections) {
          const sectionErr = validateInvestNowQuestionnaireSection({
            config: questionnaireConfig,
            sectionId: section.id,
            answers: questionnaireAnswers,
          })
          if (sectionErr) {
            const idx = flowSteps.findIndex(
              (s) =>
                s.kind === "questionnaire" && s.sectionId === section.id,
            )
            if (idx >= 0) setStepIndex(idx)
            return
          }
        }
      }
      if (w9StepIndex >= 0) setStepIndex(w9StepIndex)
    },
    [
      questionnaireInFlow,
      firstQuestionnaireStepIndex,
      visibleQuestionnaireSections,
      questionnaireConfig,
      questionnaireAnswers,
      flowSteps,
      w9StepIndex,
    ],
  )

  const onContinueFromInvestment = useCallback(() => {
    const msg = validateInvestmentStep()
    if (msg) {
      setError(msg)
      return
    }
    setError("")
    setStepIndex((prev) => prev + 1)
  }, [validateInvestmentStep])

  const investorDisplayName = useMemo(() => {
    const p = bookProfiles.find((row) => row.id === savedUserProfileId)
    return p?.profileName?.trim() || ""
  }, [bookProfiles, savedUserProfileId])

  const esignProfileLabel = useMemo(
    () => esignCategoryLabel(esignCategoryId),
    [esignCategoryId],
  )

  const refreshWebhookSignStatus = useCallback(
    async (investmentId: string, expectedSignatureRequestId?: string | null) => {
      const id = investmentId.trim()
      if (!id) return
      setSignStatusLoading(true)
      const res = await fetchInvestmentSignStatus(id)
      setSignStatusLoading(false)
      if (!res.ok) return
      setWebhookSignStatus(res.payload)
      const webhookSig = res.payload.signature_request_id?.trim() ?? ""
      const expected = expectedSignatureRequestId?.trim() ?? ""
      const sigMatches =
        !expected || !webhookSig || webhookSig === expected
      if (res.payload.status === "Completed" && sigMatches) {
        setEsignCompleted(true)
        setEsignPending(false)
      }
    },
    [],
  )

  useEffect(() => {
    setEsignCompleted(false)
    setEsignPending(false)
    setEsignWorkflowLabel(null)
    setEsignDocuments([])
    setEsignSendOk(false)
    setEsignSendError(null)
    setWebhookSignStatus(null)
    setEsignSignatureRequestId(null)
  }, [profileId])

  const loadEsignStepData = useCallback(async () => {
    if (!dealId.trim()) return
    setEsignLoading(true)
    setEsignSendError(null)
    setEsignSendOk(false)
    let trackedInvestmentId = investNowInvestmentId?.trim() || null
    const w9Payload = investNowW9FormApiPayload(w9Values)
    const sendRes = await postMyLpDealInvestNowEsignSend(dealId, {
      profileId: profileId.trim(),
      memberDisplayName: investorDisplayName,
      ...(questionnaireInFlow && Object.keys(questionnaireAnswers).length > 0
        ? { questionnaireAnswers }
        : {}),
      w9Form: w9Payload,
    })
    if (!sendRes.ok) {
      setEsignSendError(sendRes.message)
      setEsignSendOk(false)
    } else {
      setEsignSendError(null)
      setEsignSendOk(true)
      const sentSigId = sendRes.signatureRequestId?.trim() || null
      setEsignSignatureRequestId(sentSigId)
      const invId = sendRes.investmentId?.trim() || null
      if (invId) {
        trackedInvestmentId = invId
        setInvestNowInvestmentId(invId)
      }
    }
    const docs = await fetchDealMyEsignDocuments(dealId)
    const categoryId = esignCategoryIdFromCommitmentProfile(profileId.trim())
    const profileDocs = filterMyEsignDocumentsForCategory(
      docs.documents,
      categoryId,
    )
    const fallbackSigId = sendRes.ok
      ? sendRes.signatureRequestId?.trim() || null
      : null
    const profileSignatureRequestId =
      fallbackSigId ||
      profileDocs
        .map((d) => d.signatureRequestId?.trim())
        .find(Boolean) ||
      null
    setEsignDocuments(
      mapMyEsignDocumentsToInvestNowRows(profileDocs).map((row) => {
        if (row.status !== "pending" || row.signatureRequestId?.trim()) {
          return row
        }
        if (!fallbackSigId) return row
        return { ...row, signatureRequestId: fallbackSigId }
      }),
    )
    const profileCompleted =
      profileDocs.length > 0 && profileDocs.every((d) => d.status === "signed")
    const profilePending =
      profileDocs.length > 0
        ? profileDocs.some((d) => d.status !== "signed")
        : Boolean(
            sendRes.ok &&
              !sendRes.alreadyCompleted &&
              (sendRes.alreadySent || Boolean(profileSignatureRequestId)),
          )
    setEsignPending(profilePending)
    setEsignCompleted(
      profileCompleted ||
        Boolean(
          sendRes.ok &&
            sendRes.alreadyCompleted &&
            profileDocs.length > 0 &&
            profileDocs.every((d) => d.status === "signed"),
        ),
    )
    setEsignWorkflowLabel(investNowWorkflowLabelForProfileDocs(profileDocs))
    if (trackedInvestmentId) {
      await refreshWebhookSignStatus(
        trackedInvestmentId,
        profileSignatureRequestId,
      )
    }
    setEsignLoading(false)
  }, [
    dealId,
    profileId,
    investorDisplayName,
    questionnaireInFlow,
    questionnaireAnswers,
    w9Values,
    investNowInvestmentId,
    refreshWebhookSignStatus,
  ])

  useEffect(() => {
    if (stepIndex !== esignStepIndex || esignStepIndex < 0 || !dealId) return
    void loadEsignStepData()
  }, [stepIndex, esignStepIndex, dealId, loadEsignStepData])

  useEffect(() => {
    const invId = investNowInvestmentId?.trim()
    if (
      stepIndex !== esignStepIndex ||
      esignStepIndex < 0 ||
      !invId ||
      esignCompleted
    ) {
      return
    }
    const timer = window.setInterval(() => {
      void refreshWebhookSignStatus(invId, esignSignatureRequestId)
    }, 8000)
    return () => window.clearInterval(timer)
  }, [
    stepIndex,
    esignStepIndex,
    investNowInvestmentId,
    esignSignatureRequestId,
    esignCompleted,
    refreshWebhookSignStatus,
  ])

  const validateEsignaturesStep = useCallback((): string | null => {
    if (esignLoading) return "Loading e-sign documents…"
    if (!esignTemplate) {
      return `No eSign template is configured for ${esignProfileLabel} on this deal`
    }
    if (esignTemplate.dropboxSignStatus !== "ready" && !esignCompleted) {
      return "Your subscription document is not ready for signing yet"
    }
    if (!esignSendOk && !esignCompleted && !esignLoading) {
      return esignSendError ?? "Could not prepare eSign documents. Use Retry on this step."
    }
    if (esignSendError && !esignPending && !esignCompleted) {
      return esignSendError
    }
    const webhookSig = webhookSignStatus?.signature_request_id?.trim() ?? ""
    const activeSig = esignSignatureRequestId?.trim() ?? ""
    const webhookComplete =
      webhookSignStatus?.status === "Completed" &&
      (!activeSig || !webhookSig || webhookSig === activeSig)
    if (!esignCompleted && !webhookComplete) {
      return "Sign all required documents before finishing"
    }
    return null
  }, [
    esignLoading,
    esignTemplate,
    esignProfileLabel,
    esignSendOk,
    esignSendError,
    esignPending,
    esignCompleted,
    webhookSignStatus,
  ])

  const saveCommitment = useCallback(async (): Promise<string | null> => {
    const n = parseMoneyDigits(String(amount).trim())
    const submitStatus = status.trim() || "Open to investment"
    setSubmitting(true)
    setError("")
    const res = await patchMyLpDealInvestNowCommitment(dealId, String(n), {
      profileId: profileId.trim(),
      status: submitStatus,
      docSignedDate: docSignedDate.trim(),
      includeUserInvestorProfileInBody: true,
      userInvestorProfileId: savedUserProfileId.trim(),
      ...(questionnaireInFlow && Object.keys(questionnaireAnswers).length > 0
        ? { questionnaireAnswers }
        : {}),
      w9Form: investNowW9FormApiPayload(w9Values),
    })
    setSubmitting(false)
    if (!res.ok) return res.message
    toast.success(
      "Committed successfully",
      "Your investment commitment was saved. Continue to sign your documents.",
    )
    return null
  }, [
    amount,
    status,
    docSignedDate,
    dealId,
    profileId,
    savedUserProfileId,
    questionnaireInFlow,
    questionnaireAnswers,
    w9Values,
  ])

  const onContinueFromCurrentStep = useCallback(async () => {
    const stepDef = flowSteps[stepIndex]
    if (!stepDef) return

    if (stepDef.kind === "investor") {
      const msg = validateInvestorStep()
      if (msg) {
        setError(msg)
        return
      }
      setError("")
      setStepIndex(stepIndex + 1)
      return
    }

    if (stepDef.kind === "investment") {
      const msg = validateInvestmentStep()
      if (msg) {
        setError(msg)
        return
      }
      setError("")
      setStepIndex(stepIndex + 1)
      return
    }

    if (stepDef.kind === "questionnaire") {
      if (documentsLoading) {
        setError("Loading questionnaire…")
        return
      }
      if (!questionnaireConfig) {
        setError("Questionnaire is not loaded yet")
        return
      }
      const msg = validateInvestNowQuestionnaireSection({
        config: questionnaireConfig,
        sectionId: stepDef.sectionId,
        answers: questionnaireAnswers,
      })
      if (msg) {
        setError(msg)
        return
      }
      setError("")
      setStepIndex(stepIndex + 1)
      return
    }

    if (stepDef.kind === "w9") {
      const investorErr = validateInvestorStep()
      if (investorErr) {
        setError(investorErr)
        setStepIndex(0)
        return
      }
      const investmentErr = validateInvestmentStep()
      if (investmentErr) {
        setError(investmentErr)
        setStepIndex(1)
        return
      }
      const documentsErr = validateAllQuestionnaireAndW9()
      if (documentsErr) {
        setError(documentsErr)
        goToStepIndexForValidationError(documentsErr)
        return
      }
      const commitErr = await saveCommitment()
      if (commitErr) {
        setError(commitErr)
        return
      }
      setError("")
      setStepIndex(stepIndex + 1)
      return
    }
  }, [
    flowSteps,
    stepIndex,
    validateInvestorStep,
    validateInvestmentStep,
    documentsLoading,
    questionnaireConfig,
    questionnaireAnswers,
    validateAllQuestionnaireAndW9,
    goToStepIndexForValidationError,
    saveCommitment,
  ])

  const onFinish = useCallback(async () => {
    const investorErr = validateInvestorStep()
    if (investorErr) {
      setError(investorErr)
      setStepIndex(0)
      return
    }
    const investmentErr = validateInvestmentStep()
    if (investmentErr) {
      setError(investmentErr)
      setStepIndex(1)
      return
    }
    const documentsErr = validateAllQuestionnaireAndW9()
    if (documentsErr) {
      setError(documentsErr)
      goToStepIndexForValidationError(documentsErr)
      return
    }
    const esignErr = validateEsignaturesStep()
    if (esignErr) {
      setError(esignErr)
      if (esignStepIndex >= 0) setStepIndex(esignStepIndex)
      return
    }
    const n = parseMoneyDigits(String(amount).trim())

    const em = getSessionUserEmail()?.trim().toLowerCase() ?? ""
    let investedAmount = n
    try {
      const inv = await fetchDealInvestors(dealId, { lpInvestorsOnly: true })
      if (em && inv.investors?.length) {
        const mine = inv.investors.find(
          (r) => String(r.userEmail ?? "").trim().toLowerCase() === em,
        )
        if (mine) {
          const parsed = parseMoneyDigits(String(mine.committed ?? "").trim())
          if (Number.isFinite(parsed)) investedAmount = parsed
        }
      }
    } catch {
      /* keep local amount */
    }

    toast.success(
      "Investment complete",
      "Your commitment and signed documents were saved.",
    )

    upsertRuntimeInvestmentRow({
      dealId,
      investmentName: dealName,
      offeringName: dealName,
      investmentProfile: investorProfileLabel(profileId.trim()),
      investedAmount,
      distributedAmount: 0,
      currentValuation: offeringSize || "—",
      dealCloseDate: formatDealCloseDateForInvestments(closeDate?.trim()),
      status: "Active",
      actionRequired: "None",
    })

    navigate("/dashboard", { replace: true })
  }, [
    validateInvestorStep,
    validateInvestmentStep,
    validateAllQuestionnaireAndW9,
    validateEsignaturesStep,
    goToStepIndexForValidationError,
    esignStepIndex,
    amount,
    dealId,
    profileId,
    dealName,
    offeringSize,
    closeDate,
    navigate,
  ])

  if (!dealId) {
    return (
      <div className="deals_list_page deals_detail_page invest_now_flow_page">
        <p className="deals_list_not_found">Missing deal.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="deals_list_page deals_detail_page deals_add_investor_class_page deals_add_deal_asset_page deals_create_flow invest_now_flow_page">
        <section
          className="deals_create_loading_panel"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2
            className="deals_create_loading_icon"
            size={28}
            strokeWidth={2}
            aria-hidden
          />
          <p className="deals_create_loading_text">Loading invest now…</p>
        </section>
      </div>
    )
  }

  const isFirstStep = stepIndex <= 0
  const isLastStep = stepIndex >= flowSteps.length - 1
  const continueDisabled =
    submitting ||
    (currentStep?.kind === "investor" && bookLoading) ||
    (currentStep?.kind === "questionnaire" &&
      (documentsLoading || !questionnaireConfig)) ||
    (currentStep?.kind === "w9" && documentsLoading)

  function renderCurrentStep() {
    if (!currentStep) return null

    if (currentStep.kind === "investor") {
      return (
        <InvestNowInvestorStep
          profileOptions={profileDropdownOptions}
          savedUserProfileId={savedUserProfileId}
          onSavedProfileChange={(id) => {
            setSavedUserProfileId(id)
            if (error) setError("")
          }}
          investmentClassLabel={investmentClassLabel}
          sponsorLabel={sponsorLabel}
          loading={submitting}
          disabled={submitting}
          bookLoading={bookLoading}
          error={error}
          onAddProfile={() => navigate("/investing/profiles/add")}
        />
      )
    }

    if (currentStep.kind === "investment") {
      return (
        <InvestNowInvestmentStep
          amount={amount}
          fundingMethod={fundingMethod}
          minimumHint={minimumInvestmentHint}
          onAmountChange={(v) => {
            setAmount(v)
            if (error) setError("")
          }}
          onFundingMethodChange={(v) => {
            setFundingMethod(v)
            if (error) setError("")
          }}
          disabled={submitting}
          error={error}
        />
      )
    }

    if (currentStep.kind === "questionnaire") {
      if (!questionnaireConfig) {
        return (
          <section
            className="deals_create_card invest_now_step_card"
            aria-busy="true"
          >
            <h2 className="deals_create_section_title deals_create_step_card_title">
              Questionnaire
            </h2>
            <p className="deals_create_loading_text" role="status">
              <Loader2
                className="deals_create_loading_icon"
                size={20}
                aria-hidden
              />
              Loading questionnaire…
            </p>
          </section>
        )
      }
      return (
        <InvestNowQuestionnaireSectionStep
          step={currentStep}
          config={questionnaireConfig}
          answers={questionnaireAnswers}
          showIntro={currentStep.sectionId === visibleQuestionnaireSections[0]?.id}
          disabled={submitting || documentsLoading}
          error={error}
          onAnswersChange={(answers) => {
            setQuestionnaireAnswers(answers)
            if (error) setError("")
          }}
        />
      )
    }

    if (currentStep.kind === "w9") {
      return (
        <InvestNowW9Step
          w9Values={w9Values}
          onW9Change={(v) => {
            setW9Values(v)
            if (error) setError("")
          }}
          disabled={submitting || documentsLoading}
          error={error}
        />
      )
    }

    return (
      <InvestNowEsignaturesStep
        dealId={dealId}
        esignCategoryId={esignCategoryId}
        profileTemplate={esignTemplate}
        profileLabel={esignProfileLabel}
        questionnaireInFlow={questionnaireInFlow}
        investorDisplayName={investorDisplayName}
        sendError={esignSendError}
        esignSendOk={esignSendOk}
        esignLoading={esignLoading}
        esignDocuments={esignDocuments}
        esignPending={esignPending}
        esignCompleted={esignCompleted}
        esignWorkflowLabel={esignWorkflowLabel}
        webhookSignStatus={webhookSignStatus}
        signStatusLoading={signStatusLoading}
        fallbackSignatureRequestId={esignSignatureRequestId}
        onRefreshDocuments={() => loadEsignStepData()}
        disabled={submitting || esignLoading}
        error={error}
      />
    )
  }

  const stepSubtitle = currentStep
    ? investNowFlowStepSubtitle(currentStep)
    : ""
  const activeStepperPhaseId = investNowActiveStepperPhaseId(currentStep)

  return (
    <div className="deals_list_page deals_detail_page deals_add_investor_class_page deals_add_deal_asset_page deals_create_flow invest_now_flow_page">
      <header className="deals_list_head deals_add_investor_class_page_head deals_create_page_head">
        <div className="deals_add_deal_asset_head_main deals_create_head_main">
          <div className="deals_list_title_row deals_add_deal_asset_title_row">
            <button
              type="button"
              className="deals_list_back_circle"
              onClick={() => navigate(backTo)}
              aria-label={
                backTo === "/investing/investments"
                  ? "Back to investments"
                  : "Back to deal"
              }
            >
              <ArrowLeft size={20} strokeWidth={2} aria-hidden />
            </button>
            <div className="deals_add_deal_asset_title_stack">
              <h1 className="deals_list_title">Invest now — {dealName}</h1>
              {stepSubtitle ? (
                <p className="deals_create_subtitle">{stepSubtitle}</p>
              ) : null}
            </div>
          </div>
          <InvestNowFlowStepper
            activePhaseId={activeStepperPhaseId}
            includeQuestionnaire={questionnaireInFlow}
          />
        </div>
      </header>

      <section className="deals_create_deal_section" aria-label="Invest now form">
        <form
          className="deals_add_deal_asset_form"
          onSubmit={(e) => e.preventDefault()}
          noValidate
        >
          <div className="deals_add_deal_asset_form_scroll">
            {renderCurrentStep()}
          </div>

          <div className="um_modal_actions deal_inv_ic_add_panel_actions deals_add_deal_asset_footer_actions">
            <button
              type="button"
              className="um_btn_secondary"
              disabled={submitting}
              onClick={() => navigate(backTo)}
            >
              <X size={16} strokeWidth={2} aria-hidden />
              Cancel
            </button>
            <div className="add_contact_modal_actions_trailing">
              {!isFirstStep ? (
                <button
                  type="button"
                  className="um_btn_secondary"
                  disabled={submitting}
                  onClick={() => {
                    setError("")
                    setStepIndex((index) => Math.max(0, index - 1))
                  }}
                >
                  <ArrowLeft size={16} strokeWidth={2} aria-hidden />
                  Back
                </button>
              ) : null}
              {!isLastStep ? (
                <button
                  type="button"
                  className="um_btn_primary"
                  disabled={continueDisabled}
                  onClick={() => {
                    if (currentStep?.kind === "investor") {
                      onContinueFromInvestor()
                      return
                    }
                    if (currentStep?.kind === "investment") {
                      onContinueFromInvestment()
                      return
                    }
                    void onContinueFromCurrentStep()
                  }}
                >
                  {submitting && currentStep?.kind === "w9" ? (
                    <>
                      <Loader2
                        size={16}
                        strokeWidth={2}
                        className="deals_create_loading_icon"
                        aria-hidden
                      />
                      Saving…
                    </>
                  ) : (
                    <>
                      Continue
                      <ChevronRight size={18} strokeWidth={2} aria-hidden />
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  className="um_btn_primary"
                  disabled={submitting || esignLoading}
                  onClick={() => void onFinish()}
                >
                  {submitting ? (
                    <>
                      <Loader2
                        size={16}
                        strokeWidth={2}
                        className="deals_create_loading_icon"
                        aria-hidden
                      />
                      Finishing…
                    </>
                  ) : (
                    "Finish"
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}

export default DealInvestNowPage
