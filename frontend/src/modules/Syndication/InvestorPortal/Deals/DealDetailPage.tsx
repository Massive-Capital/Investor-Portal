import type { LucideIcon } from "lucide-react"
import {
  ArrowLeft,
  BarChart3,
  File,
  FileSignature,
  FileText,
  Megaphone,
  Users,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  dealDetailApiToRecord,
  dealStageLabel,
  type DealRecord,
} from "../deals-mock-data"
import { usePortalMode } from "../../../../common/context/PortalModeContext"
import { getSessionUserEmail } from "../../../../common/auth/sessionUserEmail"
import { setAppDocumentTitle } from "../../../../common/utils/appDocumentTitle"
import {
  buildDealOfferingPreviewShareUrl,
  deleteDealMemberRoster,
  fetchDealById,
  fetchDealInvestorClasses,
  fetchDealInvestors,
  fetchDealMembers,
  isDealDetailFormIncomplete,
  postDealMemberInvitationEmail,
  type DealDetailApi,
} from "./api/dealsApi"
import { EMPTY_INVESTORS_PAYLOAD } from "./dealOfferingPreviewShared"
import { DealOfferingPreviewInner } from "./DealOfferingPreviewInner"
import { applyOfferingInvestorPreviewJsonFromServer } from "./utils/offeringPreviewServerState"
import { dealStageChipCompactClassName } from "./utils/dealStageChip"
import { ADD_MEMBER_DRAFT_ROW_ID } from "./deal-members/add-investment/addMemberDraftInvestorRow"
import {
  clearAddMemberDraft,
  loadAddMemberDraft,
} from "./deal-members/add-investment/addMemberFormDraftStorage"
import {
  DealInvestorsTab,
  type DealInvestorsTabHandle,
} from "./components/DealInvestorsTab"
import { LpInvestNowModal } from "./components/LpInvestNowModal"
import { DealMembersTab } from "./deal-members"
import { DealEsignTemplatesTab } from "./components/DealEsignTemplatesTab"
import { DealDocumentsTab } from "./components/DealDocumentsTab"
import { DealOfferingDetailsTab } from "./components/DealOfferingDetailsTab"
import type {
  DealInvestorRow,
  DealInvestorsPayload,
} from "./types/deal-investors.types"
import type { DealInvestorClass } from "./types/deal-investor-class.types"
import { DealInvestorRoleBadge } from "./components/DealInvestorRoleBadge"
import {
  resolveViewerDealInvestorRoleRaw,
  resolveViewerDealMemberRole,
  visibleDealDetailTabIds,
} from "./utils/dealDetailTabVisibility"
import { toast } from "../../../../common/components/Toast"
import { dealHasOfferingShareLink } from "./utils/offeringOverviewForm"
import { TabsScrollStrip } from "../../../../common/components/tabs-scroll-strip/TabsScrollStrip"
import { notifyDealsListRefetch } from "./createDealFormDraftStorage"
import { investorProfileLabel } from "./constants/investor-profile"
import { upsertRuntimeInvestmentRow } from "../../../Investing/InvestorPortal/Investments/investmentsRuntimeStore"
import "../../../usermanagement/user_management.css"
import "./deal-offering-portfolio.css"
import "./deals-list.css"

/** Deal detail: `/deals/:dealId`. Tab **Deal Members** (`deal_members`) renders `DealMembersTab` (root `deal_members_tab` in deal-members/tab/deal-members.css). */
interface DealDetailTabDef {
  id: string
  label: string
  icon: LucideIcon
}

const DEAL_DETAIL_TABS: DealDetailTabDef[] = [
  { id: "offering_details", label: "Offering Details", icon: FileText },
  { id: "documents", label: "Documents", icon: File },
  { id: "esign_templates", label: "eSign Templates", icon: FileSignature },
  { id: "investors", label: "Investors", icon: Users },
  { id: "investor_communication", label: "Investor Communication ", icon: BarChart3 },
  { id: "distributions", label: "Distributions", icon: BarChart3 },
  { id: "deal_members", label: "Deal Members", icon: Users },
]

export function DealDetailPage() {
  const { mode } = usePortalMode()
  const { dealId } = useParams()
  const [activeTab, setActiveTab] = useState<string>("offering_details")
  const [addInvestmentOpen, setAddInvestmentOpen] = useState(false)
  /** True while shared Add/Edit investment modal is open (add or edit) — hides session draft row in Deal Members table. */
  const [sharedInvestmentModalOpen, setSharedInvestmentModalOpen] =
    useState(false)
  /** Which flow opened the shared modal — drives “Add Member” vs “Add Investor” title. */
  const [investmentModalEntry, setInvestmentModalEntry] = useState<
    "member" | "investor"
  >("member")
  /** Add-member modal: restore session draft (draft row) vs empty form (“Add Member” button). */
  const [restoreAddMemberSessionDraft, setRestoreAddMemberSessionDraft] =
    useState(true)
  const [dealMembersRefreshKey, setDealMembersRefreshKey] = useState(0)
  const dealInvestorsTabRef = useRef<DealInvestorsTabHandle>(null)
  const [deal, setDeal] = useState<DealRecord | null | undefined>(undefined)
  const [dealDetailApi, setDealDetailApi] = useState<DealDetailApi | null>(null)

  const handleDealPersisted = useCallback((d: DealDetailApi) => {
    setDealDetailApi(d)
    setDeal(dealDetailApiToRecord(d))
    notifyDealsListRefetch()
  }, [])
  const [investingOfferingClasses, setInvestingOfferingClasses] = useState<
    DealInvestorClass[]
  >([])
  const [investingOfferingInvestors, setInvestingOfferingInvestors] =
    useState<DealInvestorsPayload>(EMPTY_INVESTORS_PAYLOAD)
  const [memberRosterForTabs, setMemberRosterForTabs] = useState<
    DealInvestorRow[]
  >([])
  const [lpInvestNowOpen, setLpInvestNowOpen] = useState(false)
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

  /** Bumps `DealInvestorsTab` fetch after LP “Invest now” so the Investors tab shows the new commitment. */
  const [investorsListRefreshKey, setInvestorsListRefreshKey] = useState(0)

  const handleLpInvestNowSuccess = useCallback(
    (
      payload: DealInvestorsPayload,
      saved: { profileId: string; committedAmount: number },
    ) => {
      setInvestingOfferingInvestors(payload)
      if (dealId?.trim()) {
        const investmentName =
          dealDetailApi?.dealName?.trim() ||
          dealDetailApi?.propertyName?.trim() ||
          "Deal"
        upsertRuntimeInvestmentRow({
          dealId: dealId.trim(),
          investmentName,
          offeringName: investmentName,
          investmentProfile: investorProfileLabel(saved.profileId),
          investedAmount: saved.committedAmount,
          distributedAmount: 0,
          currentValuation: dealDetailApi?.offeringSize?.trim() || "—",
          dealCloseDate: formatDealCloseDateForInvestments(
            dealDetailApi?.closeDate?.trim(),
          ),
          status: "Active",
          actionRequired: "None",
        })
      }
      setInvestorsListRefreshKey((k) => k + 1)
      setDealMembersRefreshKey((r) => r + 1)
      void dealInvestorsTabRef.current?.refetchInvestors()
    },
    [dealId, dealDetailApi],
  )

  useEffect(() => {
    if (!dealId?.trim()) return
    let cancelled = false
    void fetchDealMembers(dealId).then((rows) => {
      if (!cancelled) setMemberRosterForTabs(rows)
    })
    return () => {
      cancelled = true
    }
  }, [dealId, dealMembersRefreshKey])

  const sessionEmail = getSessionUserEmail()

  const viewerDealTabIds = useMemo(() => {
    const role = resolveViewerDealMemberRole(
      memberRosterForTabs,
      sessionEmail,
    )
    return visibleDealDetailTabIds(role)
  }, [memberRosterForTabs, sessionEmail])

  const viewerDealInvestorRoleRaw = useMemo(
    () =>
      resolveViewerDealInvestorRoleRaw(memberRosterForTabs, sessionEmail),
    [memberRosterForTabs, sessionEmail],
  )

  const dealsListBackPath = mode === "investing" ? "/investing/deals" : "/deals"

  const dealDetailTabsVisible = useMemo(
    () => DEAL_DETAIL_TABS.filter((t) => viewerDealTabIds.has(t.id)),
    [viewerDealTabIds],
  )

  useEffect(() => {
    if (dealDetailTabsVisible.length === 0) return
    if (!dealDetailTabsVisible.some((t) => t.id === activeTab))
      setActiveTab(dealDetailTabsVisible[0].id)
  }, [dealDetailTabsVisible, activeTab])

  useEffect(() => {
    if (!dealId) {
      setDeal(undefined)
      return
    }
    let cancelled = false
    setDeal(undefined)
    setDealDetailApi(null)
    void (async () => {
      try {
        const d = await fetchDealById(dealId)
        if (!cancelled) {
          applyOfferingInvestorPreviewJsonFromServer(
            d.id,
            d.offeringInvestorPreviewJson,
          )
          setDealDetailApi(d)
          setDeal(dealDetailApiToRecord(d))
        }
      } catch {
        if (!cancelled) {
          setDeal(null)
          setDealDetailApi(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dealId])

  useEffect(() => {
    if (mode !== "investing" || !dealId?.trim()) return
    let cancelled = false
    setInvestingOfferingClasses([])
    setInvestingOfferingInvestors(EMPTY_INVESTORS_PAYLOAD)
    void (async () => {
      const id = dealId.trim()
      const [icResult, invResult] = await Promise.allSettled([
        fetchDealInvestorClasses(id),
        fetchDealInvestors(id),
      ])
      if (cancelled) return
      setInvestingOfferingClasses(
        icResult.status === "fulfilled" ? icResult.value : [],
      )
      setInvestingOfferingInvestors(
        invResult.status === "fulfilled"
          ? invResult.value
          : EMPTY_INVESTORS_PAYLOAD,
      )
    })()
    return () => {
      cancelled = true
    }
  }, [mode, dealId])

  useEffect(() => {
    if (!dealId) return
    if (deal === undefined) {
      setAppDocumentTitle("Deal")
      return
    }
    if (deal === null) {
      setAppDocumentTitle("Deal not found")
      return
    }
    const title =
      dealDetailApi?.dealName?.trim() || deal.title.trim() || "Deal"
    setAppDocumentTitle(title)
  }, [dealId, deal, dealDetailApi?.dealName])

  useEffect(() => {
    const el = document.getElementById(`deal-tab-${activeTab}`)
    if (!el) return
    el.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    })
  }, [activeTab])

  const displayName =
    dealDetailApi?.dealName?.trim() ||
    (deal !== undefined && deal !== null ? deal.title : "")
  const displayStage =
    deal !== undefined && deal !== null && dealDetailApi?.dealStage
      ? dealStageLabel(dealDetailApi.dealStage)
      : ""

  const dealFormIncomplete =
    dealDetailApi != null && isDealDetailFormIncomplete(dealDetailApi)

  const announcementTitle =
    dealDetailApi?.dealAnnouncementTitle?.trim() ?? ""
  const announcementMessage =
    dealDetailApi?.dealAnnouncementMessage?.trim() ?? ""
  const showDealAnnouncement =
    Boolean(announcementTitle) || Boolean(announcementMessage)

  const hideStagePillBecauseDraftBadge =
    dealFormIncomplete &&
    dealDetailApi != null &&
    String(dealDetailApi.dealStage ?? "").trim().toLowerCase() === "draft"

  const offeringLinkAvailable = useMemo(
    () => dealHasOfferingShareLink(dealDetailApi),
    [dealDetailApi],
  )

  const handleCopyMemberOfferingLink = useCallback(
    async (_row: DealInvestorRow) => {
      if (!dealId?.trim() || !dealDetailApi || !dealHasOfferingShareLink(dealDetailApi))
        return
      try {
        const url = await buildDealOfferingPreviewShareUrl(dealId.trim(), {
          previewToken: dealDetailApi.offeringPreviewToken,
        })
        await navigator.clipboard.writeText(url)
        toast.success(
          "Link copied",
          "The offering preview link was copied to your clipboard.",
        )
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Could not copy the offering link."
        toast.error("Could not copy link", msg)
      }
    },
    [dealId, dealDetailApi],
  )

  const handleSendMemberInvitationMail = useCallback(
    async (row: DealInvestorRow) => {
      const email = row.userEmail?.trim()
      if (!email || email === "—") {
        toast.error("No email address", "This row has no email to send to.")
        return
      }
      if (!dealId) return
      const name = row.displayName?.trim()
      const result = await postDealMemberInvitationEmail(dealId, {
        to_email: email,
        member_display_name: name && name !== "—" ? name : undefined,
      })
      if (result.ok) {
        toast.success(
          "Invitation sent",
          "The member invitation email was sent using your server mail settings.",
        )
        void dealInvestorsTabRef.current?.refetchInvestors()
      } else {
        toast.error("Could not send email", result.message)
      }
    },
    [dealId],
  )

  const handleDeleteMember = useCallback(
    async (row: DealInvestorRow) => {
      if (row.id === ADD_MEMBER_DRAFT_ROW_ID && dealId) {
        const draft = loadAddMemberDraft(dealId)
        const autosavedRosterId = draft?.backendInvestmentId?.trim()
        if (autosavedRosterId) {
          const del = await deleteDealMemberRoster(dealId, autosavedRosterId)
          if (!del.ok) {
            toast.error("Could not remove member", del.message)
            return
          }
        }
        clearAddMemberDraft(dealId)
        toast.success(
          "Draft removed",
          autosavedRosterId
            ? "The add-member draft and its autosaved roster entry were removed."
            : "The unsaved add-member draft was discarded.",
        )
        setDealMembersRefreshKey((k) => k + 1)
        void dealInvestorsTabRef.current?.refetchInvestors()
        return
      }
      if (!dealId?.trim()) return
      const result = await deleteDealMemberRoster(dealId, row.id)
      if (result.ok) {
        toast.success(
          "Member removed",
          "This member was removed from the deal.",
        )
        setDealMembersRefreshKey((k) => k + 1)
        void dealInvestorsTabRef.current?.refetchInvestors()
      } else {
        toast.error("Could not remove member", result.message)
      }
    },
    [dealId],
  )

  if (!dealId)
    return (
      <div className="deals_list_page deals_detail_page">
        <p className="deals_list_not_found">Missing deal.</p>
      </div>
    )

  if (deal === undefined)
    return (
      <div className="deals_list_page deals_detail_page">
        <p className="deals_list_not_found">Loading deal…</p>
      </div>
    )

  if (!deal)
    return (
      <div className="deals_list_page deals_detail_page">
        <p className="deals_list_not_found">
          Deal not found.{" "}
          <Link to={dealsListBackPath} className="deals_list_inline_back">
            <ArrowLeft size={18} strokeWidth={2} aria-hidden />
            Back to deals
          </Link>
        </p>
      </div>
    )

  const showSyndicatingDealChrome = mode !== "investing"

  return (
    <div className="deals_list_page deals_detail_page">
      {showSyndicatingDealChrome ? (
      <header className="deals_list_head">
        {showDealAnnouncement ? (
          <div
            className="deal_detail_announcement_banner"
            role="region"
            aria-label="Deal announcement"
          >
            <Megaphone
              size={16}
              strokeWidth={2}
              className="deal_detail_announcement_banner_icon"
              aria-hidden
            />
            <div className="deal_detail_announcement_banner_body">
              <p className="deal_detail_announcement_banner_label">
                Announcement
              </p>
              {announcementTitle ? (
                <p className="deal_detail_announcement_banner_title">
                  {announcementTitle}
                </p>
              ) : null}
              {announcementMessage ? (
                <p className="deal_detail_announcement_banner_message">
                  {announcementMessage}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="deals_list_title_row">
          <Link
            className="deals_list_back_circle"
            to={dealsListBackPath}
            aria-label="Back to deals"
          >
            <ArrowLeft size={20} strokeWidth={2} aria-hidden />
          </Link>
          <div className="deals_detail_title_stack">
            <div className="deals_list_name_with_draft deals_detail_title_name_block">
              <h1 className="deals_list_title">{displayName}</h1>
              {dealFormIncomplete ? (
                <span
                  className="deals_list_draft_badge"
                  title="Deal details are incomplete or not finalized"
                >
                  Draft
                </span>
              ) : null}
            </div>
            {!hideStagePillBecauseDraftBadge && displayStage ? (
              <span
                className={dealStageChipCompactClassName(dealDetailApi?.dealStage)}
              >
                {displayStage}
              </span>
            ) : null}
          </div>
        </div>
      </header>
      ) : null}

      {mode === "investing" && dealDetailApi ? (
        <section
          className="deal_detail_investing_preview_section um_panel"
          aria-labelledby="deal-detail-investing-preview-heading"
        >
          <div className="deal_detail_investing_section_back">
            <Link
              className="deals_list_back_circle"
              to={dealsListBackPath}
              aria-label="Back to deals"
            >
              <ArrowLeft size={20} strokeWidth={2} aria-hidden />
            </Link>
          </div>
          <h2
            id="deal-detail-investing-preview-heading"
            className="deal_detail_investing_preview_heading"
          >
            Offering overview
          </h2>
          <p className="deal_detail_investing_preview_lead">
            Same content and layout as Preview offering and the shared investor
            link — gallery, summary, documents, and highlights follow what is
            marked visible to investors.
          </p>
          {viewerDealInvestorRoleRaw ? (
            <div
              className="deals_deal_view_sponsor_role_banner deal_detail_investing_sponsor_banner"
              role="status"
              aria-label="Your role on this deal"
            >
              <span className="deals_deal_view_sponsor_role_label">
                Your role on this deal
              </span>
              <DealInvestorRoleBadge
                investorRole={viewerDealInvestorRoleRaw}
              />
            </div>
          ) : null}
          <div className="deal_offer_pf_page deal_detail_investing_offer_pf">
            <div className="deal_offer_pf">
              <DealOfferingPreviewInner
                detail={dealDetailApi}
                classes={investingOfferingClasses}
                investorsPayload={investingOfferingInvestors}
                applyInvestorLinkVisibility
                isPublicOfferingRoute={false}
                showInvestNowCta
                onInvestNow={() => setLpInvestNowOpen(true)}
                galleryUsesPersistedSourcesOnly={false}
              />
            </div>
          </div>
          {dealId?.trim() ? (
            <LpInvestNowModal
              open={lpInvestNowOpen}
              onClose={() => setLpInvestNowOpen(false)}
              dealId={dealId.trim()}
              dealName={displayName}
              onSuccess={handleLpInvestNowSuccess}
            />
          ) : null}
        </section>
      ) : null}

      {showSyndicatingDealChrome ? (
        <>
      <div className="um_members_tabs_outer deals_tabs_outer">
        <TabsScrollStrip scrollClassName="deals_tabs_scroll">
          <div
            className="um_members_tabs_row deals_tabs_row"
            role="tablist"
            aria-label="Deal sections"
          >
            {dealDetailTabsVisible.map((tab) => {
              const isActive = activeTab === tab.id
              const TabIcon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="deal-detail-tabpanel"
                  id={`deal-tab-${tab.id}`}
                  className={`um_members_tab deals_tabs_tab${isActive ? " um_members_tab_active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <TabIcon
                    className="deals_tabs_icon"
                    size={18}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <span className="deals_tabs_label">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </TabsScrollStrip>
      </div>

      <div
        className={
          activeTab === "deal_members"
            ? "um_members_tab_content deal_members_tab"
            : "um_members_tab_content"
        }
      >
        <div
          id="deal-detail-tabpanel"
          className="deal_detail_tab_panel"
          role="tabpanel"
          aria-labelledby={`deal-tab-${activeTab}`}
        >
        {activeTab === "investors" || activeTab === "deal_members" ? (
          <>
            {activeTab === "deal_members" ? (
              <DealMembersTab
                dealId={dealId}
                offeringLinkAvailable={offeringLinkAvailable}
                addInvestmentOpen={addInvestmentOpen}
                sharedInvestmentModalOpen={sharedInvestmentModalOpen}
                investorsRefreshKey={dealMembersRefreshKey}
                onAddMember={() => {
                  setInvestmentModalEntry("member")
                  setRestoreAddMemberSessionDraft(false)
                  setAddInvestmentOpen(true)
                }}
                onEditMember={(row: DealInvestorRow) => {
                  if (row.id === ADD_MEMBER_DRAFT_ROW_ID) {
                    setInvestmentModalEntry("member")
                    setRestoreAddMemberSessionDraft(true)
                    setAddInvestmentOpen(true)
                    return
                  }
                  dealInvestorsTabRef.current?.openEditInvestor(row)
                }}
                onCopyMemberOfferingLink={handleCopyMemberOfferingLink}
                onSendMemberInvitationMail={handleSendMemberInvitationMail}
                onDeleteMember={handleDeleteMember}
                onViewMember={(row) => {
                  dealInvestorsTabRef.current?.openViewInvestor(row)
                }}
              />
            ) : null}
            <DealInvestorsTab
              ref={dealInvestorsTabRef}
              dealId={dealId}
              dealName={displayName}
              dealDetail={dealDetailApi}
              investorsListRefreshKey={investorsListRefreshKey}
              addInvestmentOpen={addInvestmentOpen}
              onSharedInvestmentModalOpenChange={setSharedInvestmentModalOpen}
              modalOnly={activeTab === "deal_members"}
              onAddInvestmentClose={() => setAddInvestmentOpen(false)}
              onOpenFullInvestmentModal={() => {
                setInvestmentModalEntry("investor")
                setRestoreAddMemberSessionDraft(true)
                setAddInvestmentOpen(true)
              }}
              addInvestmentEntry={
                activeTab === "investors"
                  ? "investor"
                  : investmentModalEntry
              }
              restoreAddMemberSessionDraft={restoreAddMemberSessionDraft}
              onInvestorsChanged={() =>
                setDealMembersRefreshKey((k) => k + 1)
              }
              onSendInvitationMail={handleSendMemberInvitationMail}
              onCopyOfferingLink={handleCopyMemberOfferingLink}
              onDeleteMember={handleDeleteMember}
              offeringLinkAvailable={offeringLinkAvailable}
            />
          </>
        ) : activeTab === "offering_details" && dealDetailApi ? (
          <DealOfferingDetailsTab
            detail={dealDetailApi}
            onDealUpdated={handleDealPersisted}
          />
        ) : activeTab === "documents" && dealDetailApi ? (
          <DealDocumentsTab
            dealId={dealDetailApi.id}
            onOfferingPreviewSynced={handleDealPersisted}
          />
        ) : activeTab === "esign_templates" ? (
          <DealEsignTemplatesTab dealId={dealId} />
        ) : (
          <div className="deal_detail_wip_wrap" role="status">
            <p className="deal_detail_wip_title">Working in progress</p>
            <p className="deal_detail_wip_hint">
              There is no content here yet. Check back soon or complete the
              related details in your workflow.
            </p>
          </div>
        )}
        </div>
      </div>
        </>
      ) : null}
    </div>
  )
}
