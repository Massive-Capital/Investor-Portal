import { Download, Eye, FileSignature, FileText, Search } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { InvestmentEsignSignModal } from "./InvestmentEsignSignModal"
import { InvestorOfferingDocumentsList } from "./components/InvestorOfferingDocumentsList"
import { fetchDealMyEsignDocuments } from "@/modules/Syndication/Deals/api/dealsApi"
import "@/modules/Syndication/Deals/deal-offering-details.css"
import { OFFERING_PREVIEW_SECTIONS_CHANGED_EVENT } from "@/modules/Syndication/Deals/utils/offeringPreviewDocSections"
import {
  ESIGN_TEMPLATE_CATEGORIES,
  esignCategoryLabel,
} from "@/modules/Syndication/Deals/utils/esignTemplateCategories"
import { resolveEsignDocumentUrlForViewer } from "@/modules/Syndication/Deals/utils/investorEsignStatus"
import "@/modules/Syndication/usermanagement/user_management.css"
import "@/modules/Syndication/Deals/deals-list.css"
import "@/modules/Syndication/Deals/deal-investors-tab.css"
import { buildInvestmentDocumentAudience } from "./utils/buildInvestmentDocumentAudience"
import type { InvestmentDocumentAudienceContext } from "./utils/investmentDocumentAudience"
import {
  dealHasOfferingDocumentSections,
  EMPTY_INVESTMENT_DOCUMENT_AUDIENCE,
  listInvestmentDetailDocumentSectionGroups,
  type InvestmentDetailDocumentRow,
  type InvestmentDetailDocumentSectionGroup,
} from "./utils/investmentDetailDocuments"
import { refreshInvestmentDealDocumentsPreview } from "./utils/refreshInvestmentDealDocumentsPreview"
import { bindInvestmentOfferingDocumentsAutoRefresh } from "./utils/bindInvestmentOfferingDocumentsAutoRefresh"
import "@/modules/Syndication/Deals/deal-esign-ui.css"
import "../deals/deal-details/lp-deal-details.css"
import "./investment-detail.css"

type InvestmentDetailDocumentsTabProps = {
  dealId: string
}

type DocumentsSubTab = "offering" | "esignatures"

function safeDownloadFilename(name: string): string {
  const base = name.trim() || "document"
  return base.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 200)
}

function investmentEsignStatusLabel(status: "pending" | "signed"): string {
  return status === "signed" ? "Signed" : "Awaiting signature"
}

function investmentEsignStatusClassName(status: "pending" | "signed"): string {
  return status === "signed"
    ? "lpd_doc_esign_status lpd_doc_esign_status--signed"
    : "lpd_doc_esign_status lpd_doc_esign_status--pending"
}

function filterOfferingDocumentSections(
  sections: InvestmentDetailDocumentSectionGroup[],
  query: string,
): InvestmentDetailDocumentSectionGroup[] {
  const q = query.trim().toLowerCase()
  return sections
    .filter((section) => section.totalOnDeal > 0)
    .map((section) => {
      if (!q) return section
      const sectionLabelMatches = section.sectionLabel.toLowerCase().includes(q)
      const documents = section.documents.filter((d) => {
        const blob = [d.name, d.sectionLabel, section.sectionLabel]
          .join(" ")
          .toLowerCase()
        return blob.includes(q)
      })
      if (sectionLabelMatches) return section
      return { ...section, documents }
    })
    .filter((section) => {
      if (!q) return true
      return (
        section.documents.length > 0 ||
        section.sectionLabel.toLowerCase().includes(q)
      )
    })
}

type EsignProfileCardData = {
  categoryId: string
  label: string
  /** One shared e-sign template document per investor profile type. */
  document: InvestmentDetailDocumentRow
}

/** One card per profile type that has a shared e-sign document for this investor. */
function buildEsignProfileCards(
  documents: InvestmentDetailDocumentRow[],
): EsignProfileCardData[] {
  const cards: EsignProfileCardData[] = []

  for (const cat of ESIGN_TEMPLATE_CATEGORIES) {
    const document = documents.find(
      (d) => (d.categoryId?.trim() || "") === cat.id,
    )
    if (!document) continue
    cards.push({
      categoryId: cat.id,
      label: cat.label,
      document,
    })
  }

  const otherDocument = documents.find((d) => {
    const cid = d.categoryId?.trim() || ""
    return !cid || !ESIGN_TEMPLATE_CATEGORIES.some((c) => c.id === cid)
  })
  if (otherDocument) {
    cards.push({
      categoryId: "_other",
      label: "Other",
      document: otherDocument,
    })
  }

  return cards
}

function esignProfileCardMatchesQuery(
  card: EsignProfileCardData,
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const d = card.document
  const blob = [card.label, d.name, d.sectionLabel, d.visibilityLabel]
    .join(" ")
    .toLowerCase()
  return blob.includes(q)
}

export function InvestmentDetailDocumentsTab({
  dealId,
}: InvestmentDetailDocumentsTabProps) {
  const [query, setQuery] = useState("")
  const [activeSubTab, setActiveSubTab] = useState<DocumentsSubTab>("offering")
  const [loadPending, setLoadPending] = useState(true)
  const [audience, setAudience] =
    useState<InvestmentDocumentAudienceContext>(EMPTY_INVESTMENT_DOCUMENT_AUDIENCE)
  const [sectionsRevision, setSectionsRevision] = useState(0)
  const [previewSyncFailed, setPreviewSyncFailed] = useState(false)
  const [dealHasDocumentSections, setDealHasDocumentSections] = useState(false)
  const [esignDocuments, setEsignDocuments] = useState<
    InvestmentDetailDocumentRow[]
  >([])
  const [esignPending, setEsignPending] = useState(false)
  const [esignLoadError, setEsignLoadError] = useState<string | null>(null)
  const [signModalOpen, setSignModalOpen] = useState(false)
  const [signModalSignatureRequestId, setSignModalSignatureRequestId] = useState<
    string | null
  >(null)
  const fetchGenRef = useRef(0)
  const autoEsignTabRef = useRef(false)

  const openSignModal = useCallback((signatureRequestId?: string | null) => {
    setSignModalSignatureRequestId(signatureRequestId?.trim() || null)
    setSignModalOpen(true)
  }, [])

  const loadEsignDocuments = useCallback(async (id: string) => {
    const esign = await fetchDealMyEsignDocuments(id)
    setEsignPending(esign.esignPending)
    setEsignLoadError(esign.loadError ?? null)
    setEsignDocuments(
      esign.documents.map((d) => {
        const categoryId = d.categoryId?.trim() || ""
        return {
          id: `esign-${d.fileId}`,
          name: d.name,
          url: resolveEsignDocumentUrlForViewer(d.url),
          dateAdded: "—",
          sectionLabel: categoryId
            ? esignCategoryLabel(categoryId)
            : "E-signatures",
          visibilityLabel: investmentEsignStatusLabel(d.status),
          esignStatus: d.status,
          source: "esign" as const,
          canSign: d.status === "pending",
          signatureRequestId: d.signatureRequestId?.trim() || undefined,
          categoryId: categoryId || undefined,
        }
      }),
    )
    if (esign.esignPending && !autoEsignTabRef.current) {
      autoEsignTabRef.current = true
      setActiveSubTab("esignatures")
    }
  }, [])

  useEffect(() => {
    const id = dealId.trim()
    if (!id) {
      setAudience(EMPTY_INVESTMENT_DOCUMENT_AUDIENCE)
      setPreviewSyncFailed(false)
      setLoadPending(false)
      return
    }

    const gen = ++fetchGenRef.current
    setLoadPending(true)
    setPreviewSyncFailed(false)

    void (async () => {
      const preview = await refreshInvestmentDealDocumentsPreview(id)
      if (fetchGenRef.current !== gen) return
      setDealHasDocumentSections(preview.hasSections)
      setPreviewSyncFailed(!preview.syncedFromServer)

      let aud = EMPTY_INVESTMENT_DOCUMENT_AUDIENCE
      try {
        aud = await buildInvestmentDocumentAudience(id)
      } catch {
        aud = EMPTY_INVESTMENT_DOCUMENT_AUDIENCE
      }
      if (fetchGenRef.current !== gen) return
      setAudience(aud)

      await loadEsignDocuments(id)
      if (fetchGenRef.current !== gen) return

      setSectionsRevision((n) => n + 1)
      setLoadPending(false)
    })()
  }, [dealId, loadEsignDocuments])

  useEffect(() => {
    const id = dealId.trim()
    if (!id) return
    return bindInvestmentOfferingDocumentsAutoRefresh(id, () => {
      setDealHasDocumentSections(dealHasOfferingDocumentSections(id))
      setSectionsRevision((n) => n + 1)
    })
  }, [dealId])

  useEffect(() => {
    const id = dealId.trim()
    if (!id) return
    const bumpSections = () => setSectionsRevision((n) => n + 1)
    const onCustom = (e: Event) => {
      const d = (e as CustomEvent<{ dealId?: string }>).detail
      if (d?.dealId === id) bumpSections()
    }
    window.addEventListener(OFFERING_PREVIEW_SECTIONS_CHANGED_EVENT, onCustom)
    return () => {
      window.removeEventListener(
        OFFERING_PREVIEW_SECTIONS_CHANGED_EVENT,
        onCustom,
      )
    }
  }, [dealId])

  const offeringDocumentSections = useMemo(() => {
    return listInvestmentDetailDocumentSectionGroups(dealId, audience)
  }, [dealId, audience, sectionsRevision])

  const offeringDocuments = useMemo(
    () => offeringDocumentSections.flatMap((section) => section.documents),
    [offeringDocumentSections],
  )

  const filteredOfferingSections = useMemo(
    () => filterOfferingDocumentSections(offeringDocumentSections, query),
    [offeringDocumentSections, query],
  )

  const esignProfileCards = useMemo(() => {
    const built = buildEsignProfileCards(esignDocuments)
    return built.filter((card) => esignProfileCardMatchesQuery(card, query))
  }, [esignDocuments, query])

  const firstPendingSignatureRequestId = useMemo(() => {
    const pending = esignDocuments.find(
      (d) => d.canSign && d.signatureRequestId?.trim(),
    )
    return pending?.signatureRequestId?.trim() ?? null
  }, [esignDocuments])

  const showAudienceGate =
    previewSyncFailed &&
    !dealHasDocumentSections &&
    !dealHasOfferingDocumentSections(dealId) &&
    offeringDocuments.length === 0 &&
    esignDocuments.length === 0 &&
    activeSubTab === "offering"

  return (
    <div
      id="inv-detail-panel-documents"
      className="investment_detail_tab_panel investment_detail_documents_panel"
      role="tabpanel"
      aria-labelledby="inv-detail-tab-documents"
    >
      <div
        className="um_panel um_members_tab_panel deals_list_card_surface investment_detail_documents_card"
        aria-labelledby="inv-sec-documents"
      >
        <h2 id="inv-sec-documents" className="um_section_title">
          Documents
        </h2>

        <div
          className="um_members_tabs_outer deals_tabs_outer um_segmented_tabs_outer investment_detail_docs_subtabs_outer"
          role="presentation"
        >
          <div
            className="um_members_tabs_row deals_tabs_row um_segmented_tabs_row investment_detail_docs_subtabs"
            role="tablist"
            aria-label="Document categories"
          >
            <button
              type="button"
              role="tab"
              id="inv-docs-tab-offering"
              aria-selected={activeSubTab === "offering"}
              aria-controls="inv-docs-panel-offering"
              className={`um_members_tab deals_tabs_tab um_segmented_tab${
                activeSubTab === "offering" ? " um_members_tab_active" : ""
              }`}
              onClick={() => setActiveSubTab("offering")}
            >
              <FileText
                className="deals_tabs_icon um_segmented_tab_icon"
                size={16}
                strokeWidth={2}
                aria-hidden
              />
              <span className="deals_tabs_label um_segmented_tab_label">
                Offering Documents
                {offeringDocuments.length > 0 ? (
                  <span className="investment_detail_docs_tab_count">
                    {offeringDocuments.length}
                  </span>
                ) : null}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              id="inv-docs-tab-esignatures"
              aria-selected={activeSubTab === "esignatures"}
              aria-controls="inv-docs-panel-esignatures"
              className={`um_members_tab deals_tabs_tab um_segmented_tab${
                activeSubTab === "esignatures" ? " um_members_tab_active" : ""
              }`}
              onClick={() => setActiveSubTab("esignatures")}
            >
              <FileSignature
                className="deals_tabs_icon um_segmented_tab_icon"
                size={16}
                strokeWidth={2}
                aria-hidden
              />
              <span className="deals_tabs_label um_segmented_tab_label">
                E-signatures
                {esignDocuments.length > 0 ? (
                  <span className="investment_detail_docs_tab_count">
                    {esignDocuments.length}
                  </span>
                ) : null}
              </span>
            </button>
          </div>
        </div>

        <div className="investment_detail_documents_body">
          {loadPending ? (
            <p className="investment_detail_documents_status" role="status">
              Loading documents…
            </p>
          ) : activeSubTab === "offering" ? (
            <OfferingDocumentsPanel
              showAudienceGate={showAudienceGate}
              previewSyncFailed={previewSyncFailed}
              hasSectionsOnDeal={
                dealHasDocumentSections ||
                dealHasOfferingDocumentSections(dealId) ||
                offeringDocuments.length > 0
              }
              offeringDocuments={offeringDocuments}
              filteredOfferingSections={filteredOfferingSections}
              searchQuery={query}
              onSearchQueryChange={setQuery}
            />
          ) : (
            <EsignaturesDocumentsPanel
              esignPending={esignPending}
              esignLoadError={esignLoadError}
              esignDocuments={esignDocuments}
              esignProfileCards={esignProfileCards}
              searchQuery={query}
              onSearchQueryChange={setQuery}
              firstPendingSignatureRequestId={firstPendingSignatureRequestId}
              onOpenSignModal={openSignModal}
            />
          )}
        </div>
      </div>

      <InvestmentEsignSignModal
        open={signModalOpen}
        dealId={dealId.trim()}
        signatureRequestId={signModalSignatureRequestId}
        onClose={() => {
          setSignModalOpen(false)
          setSignModalSignatureRequestId(null)
        }}
        onSignedComplete={() => void loadEsignDocuments(dealId.trim())}
      />
    </div>
  )
}

function OfferingDocumentsPanel({
  showAudienceGate,
  previewSyncFailed,
  hasSectionsOnDeal,
  offeringDocuments,
  filteredOfferingSections,
  searchQuery,
  onSearchQueryChange,
}: {
  showAudienceGate: boolean
  previewSyncFailed: boolean
  hasSectionsOnDeal: boolean
  offeringDocuments: InvestmentDetailDocumentRow[]
  filteredOfferingSections: InvestmentDetailDocumentSectionGroup[]
  searchQuery: string
  onSearchQueryChange: (value: string) => void
}) {
  const hasVisibleDocs = offeringDocuments.length > 0
  const hasSearchMatches = filteredOfferingSections.length > 0
  const showOfferingList =
    !showAudienceGate &&
    (hasSectionsOnDeal || hasVisibleDocs) &&
    !(searchQuery.trim() && !hasSearchMatches)

  const statusMessage = showAudienceGate
    ? "Sign in as an investor with a commitment on this deal to view offering documents shared by your sponsor."
    : previewSyncFailed && !hasSectionsOnDeal
      ? "Could not load the latest document list from the server. Try refreshing the page, or open this investment again after your sponsor shares files on the deal Documents tab."
      : !hasSectionsOnDeal
        ? "No offering documents are on this deal yet."
        : searchQuery.trim() && !hasSearchMatches
          ? "No offering documents match your search."
          : null

  return (
    <div
      id="inv-docs-panel-offering"
      role="tabpanel"
      aria-labelledby="inv-docs-tab-offering"
      className="investment_detail_docs_subpanel"
    >
      <div className="deal_docs investment_detail_offering_docs">
        <div className="um_panel um_members_tab_panel deals_list_table_panel deals_list_card_surface deal_inv_table_panel deal_assets_datatable_panel investment_detail_offering_docs_panel">
          <div
            className="um_toolbar deal_docs_toolbar investment_detail_offering_docs_toolbar"
            role="toolbar"
            aria-label="Search offering documents"
          >
            <div className="um_search_wrap">
              <Search className="um_search_icon" size={16} strokeWidth={2} aria-hidden />
              <input
                type="search"
                className="um_search_input"
                placeholder="Search documents…"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                aria-label="Search offering documents"
                autoComplete="off"
              />
            </div>
          </div>

          {previewSyncFailed && hasSectionsOnDeal ? (
            <p className="investment_detail_offering_docs_notice" role="status">
              Showing cached documents; a fresh sync from the server was not
              available.
            </p>
          ) : null}

          {statusMessage ? (
            <p
              className={`investment_detail_documents_status${previewSyncFailed && !hasSectionsOnDeal ? " investment_detail_documents_status--alert" : ""}`}
              role={previewSyncFailed && !hasSectionsOnDeal ? "alert" : "status"}
            >
              {statusMessage}
            </p>
          ) : null}

          {!hasVisibleDocs && showOfferingList && !searchQuery.trim() ? (
            <p className="investment_detail_offering_docs_notice" role="status">
              No offering documents match your visibility or Shared With settings
              on this deal yet.
            </p>
          ) : null}

          {showOfferingList ? (
            <InvestorOfferingDocumentsList sections={filteredOfferingSections} />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function EsignProfileTypeCardsGrid({
  cards,
  onOpenSignModal,
}: {
  cards: EsignProfileCardData[]
  onOpenSignModal: (signatureRequestId?: string | null) => void
}) {
  return (
    <div
      className={`deal_esign_profile_cards_grid investment_detail_esign_profile_cards${
        cards.length === 1 ? " investment_detail_esign_profile_cards--single" : ""
      }`}
      role="list"
      aria-label="E-sign documents by profile type"
    >
      {cards.map((card) => {
        const doc = card.document
        const url = doc.url?.trim() || ""
        const canSign = Boolean(doc.canSign)
        const status = doc.esignStatus

        return (
          <article
            key={card.categoryId}
            className="deal_esign_profile_card investment_detail_esign_profile_card"
            role="listitem"
            aria-labelledby={`inv-esign-card-${card.categoryId}`}
          >
            <header className="deal_esign_profile_card_head">
              <div className="investment_detail_esign_profile_card_head_row">
                <h3
                  id={`inv-esign-card-${card.categoryId}`}
                  className="deal_esign_profile_card_title"
                >
                  {card.label}
                </h3>
                {status ? (
                  <span
                    className={`${investmentEsignStatusClassName(status)} investment_detail_esign_profile_card_status`}
                  >
                    {investmentEsignStatusLabel(status)}
                  </span>
                ) : null}
              </div>
            </header>
            <div className="investment_detail_esign_profile_card_body">
              <p
                className="investment_detail_esign_card_doc_name"
                title={doc.name}
              >
                <FileSignature
                  className="investment_detail_esign_card_doc_icon"
                  size={16}
                  strokeWidth={2}
                  aria-hidden
                />
                <span>{doc.name}</span>
              </p>
              {url || canSign ? (
                <div
                  className="investment_detail_esign_card_doc_actions"
                  role="group"
                  aria-label={`${doc.name} actions`}
                >
                  {canSign ? (
                    <button
                      type="button"
                      className="lpd_doc_action lpd_link lpd_doc_action_sign"
                      aria-label={`Sign ${doc.name}`}
                      onClick={() =>
                        onOpenSignModal(doc.signatureRequestId ?? null)
                      }
                    >
                      <FileSignature size={15} strokeWidth={2} aria-hidden />
                      Sign
                    </button>
                  ) : null}
                  {url ? (
                    <>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="lpd_doc_action lpd_link"
                        aria-label={`View ${doc.name}`}
                      >
                        <Eye size={15} strokeWidth={2} aria-hidden />
                        View
                      </a>
                      <a
                        href={url}
                        download={safeDownloadFilename(doc.name)}
                        rel="noopener noreferrer"
                        className="lpd_doc_action lpd_link"
                        aria-label={`Download ${doc.name}`}
                      >
                        <Download size={15} strokeWidth={2} aria-hidden />
                        Download
                      </a>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function EsignaturesDocumentsPanel({
  esignPending,
  esignLoadError,
  esignDocuments,
  esignProfileCards,
  searchQuery,
  onSearchQueryChange,
  firstPendingSignatureRequestId,
  onOpenSignModal,
}: {
  esignPending: boolean
  esignLoadError: string | null
  esignDocuments: InvestmentDetailDocumentRow[]
  esignProfileCards: EsignProfileCardData[]
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  firstPendingSignatureRequestId: string | null
  onOpenSignModal: (signatureRequestId?: string | null) => void
}) {
  const hasAny = esignDocuments.length > 0
  const hasVisibleCards = esignProfileCards.length > 0

  return (
    <div
      id="inv-docs-panel-esignatures"
      role="tabpanel"
      aria-labelledby="inv-docs-tab-esignatures"
      className="investment_detail_docs_subpanel"
    >
      <div className="investment_detail_esign_docs">
        <div className="um_panel um_members_tab_panel deals_list_card_surface investment_detail_esign_docs_panel">
          {esignPending ? (
            <div
              className="investment_detail_esign_pending_banner"
              role="status"
            >
              <p className="investment_detail_esign_pending_banner_text">
                You have documents waiting for your signature.
              </p>
              <button
                type="button"
                className="um_btn_primary investment_detail_esign_pending_banner_btn"
                onClick={() => onOpenSignModal(firstPendingSignatureRequestId)}
              >
                <FileSignature size={16} strokeWidth={2} aria-hidden />
                Sign now
              </button>
            </div>
          ) : null}

          <div
            className="um_toolbar investment_detail_esign_docs_toolbar"
            role="toolbar"
            aria-label="Search e-sign documents"
          >
            <div className="um_search_wrap">
              <Search
                className="um_search_icon"
                size={16}
                strokeWidth={2}
                aria-hidden
              />
              <input
                type="search"
                className="um_search_input"
                placeholder="Search e-sign documents…"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                aria-label="Search e-sign documents"
                autoComplete="off"
              />
            </div>
          </div>

          {esignLoadError ? (
            <p className="deal_esign_notice deal_esign_notice--error" role="alert">
              {esignLoadError}
            </p>
          ) : null}

          {!hasAny ? (
            <p className="investment_detail_documents_status">
              No e-sign documents have been sent to you on this deal yet. When
              your sponsor sends templates for signature, they will appear here.
            </p>
          ) : !hasVisibleCards ? (
            <p className="investment_detail_documents_status">
              {searchQuery.trim()
                ? "No e-sign documents match your search."
                : "No e-sign documents are available for your profile types on this deal."}
            </p>
          ) : (
            <EsignProfileTypeCardsGrid
              cards={esignProfileCards}
              onOpenSignModal={onOpenSignModal}
            />
          )}
        </div>
      </div>
    </div>
  )
}
