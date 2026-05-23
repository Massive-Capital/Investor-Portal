import { Download, Eye, FileSignature, FileText, Search } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { InvestmentEsignSignModal } from "./InvestmentEsignSignModal"
import {
  fetchDealById,
  fetchDealMyEsignDocuments,
} from "@/modules/Syndication/Deals/api/dealsApi"
import {
  OFFERING_PREVIEW_SECTIONS_CHANGED_EVENT,
  offeringPreviewSectionsStorageKey,
} from "@/modules/Syndication/Deals/utils/offeringPreviewDocSections"
import {
  buildEsignProfileStatusTabs,
  esignCategoryLabel,
} from "@/modules/Syndication/Deals/utils/esignTemplateCategories"
import { resolveEsignDocumentUrlForViewer } from "@/modules/Syndication/Deals/utils/investorEsignStatus"
import "@/modules/Syndication/usermanagement/user_management.css"
import { buildInvestmentDocumentAudience } from "./utils/buildInvestmentDocumentAudience"
import type { InvestmentDocumentAudienceContext } from "./utils/investmentDocumentAudience"
import {
  listDocumentsForInvestmentDetail,
  type InvestmentDetailDocumentRow,
} from "./utils/investmentDetailDocuments"
import { syncInvestmentDealDocumentPreview } from "./utils/syncInvestmentDealDocumentPreview"
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

function filterDocuments(
  docs: InvestmentDetailDocumentRow[],
  query: string,
): InvestmentDetailDocumentRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return docs
  return docs.filter((d) => {
    const blob = [d.name, d.sectionLabel, d.visibilityLabel]
      .join(" ")
      .toLowerCase()
    return blob.includes(q)
  })
}

async function refreshDealDocumentPreviewFromServer(
  dealId: string,
): Promise<boolean> {
  const id = dealId.trim()
  if (!id) return false
  try {
    const deal = await fetchDealById(id)
    syncInvestmentDealDocumentPreview(id, deal.offeringInvestorPreviewJson, {
      notify: false,
    })
    return true
  } catch {
    return false
  }
}

export function InvestmentDetailDocumentsTab({
  dealId,
}: InvestmentDetailDocumentsTabProps) {
  const [query, setQuery] = useState("")
  const [activeSubTab, setActiveSubTab] = useState<DocumentsSubTab>("offering")
  const [loadPending, setLoadPending] = useState(true)
  const [audience, setAudience] =
    useState<InvestmentDocumentAudienceContext | null>(null)
  const [sectionsRevision, setSectionsRevision] = useState(0)
  const [previewSyncFailed, setPreviewSyncFailed] = useState(false)
  const [esignDocuments, setEsignDocuments] = useState<
    InvestmentDetailDocumentRow[]
  >([])
  const [esignPending, setEsignPending] = useState(false)
  const [esignLoadError, setEsignLoadError] = useState<string | null>(null)
  const [signModalOpen, setSignModalOpen] = useState(false)
  const [signModalSignatureRequestId, setSignModalSignatureRequestId] = useState<
    string | null
  >(null)
  const [activeEsignProfileId, setActiveEsignProfileId] = useState<string | null>(
    null,
  )
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
          sectionLabel: categoryId
            ? esignCategoryLabel(categoryId)
            : "E-signatures",
          visibilityLabel:
            d.status === "signed" ? "Signed" : "Awaiting signature",
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
      setAudience(null)
      setPreviewSyncFailed(false)
      setLoadPending(false)
      return
    }

    const gen = ++fetchGenRef.current
    setLoadPending(true)
    setPreviewSyncFailed(false)

    void (async () => {
      let aud: InvestmentDocumentAudienceContext | null = null
      try {
        aud = await buildInvestmentDocumentAudience(id)
      } catch {
        aud = null
      }
      if (fetchGenRef.current !== gen) return
      setAudience(aud)

      const synced = await refreshDealDocumentPreviewFromServer(id)
      if (fetchGenRef.current !== gen) return
      if (!synced && aud) setPreviewSyncFailed(true)

      await loadEsignDocuments(id)
      if (fetchGenRef.current !== gen) return

      setSectionsRevision((n) => n + 1)
      setLoadPending(false)
    })()
  }, [dealId, loadEsignDocuments])

  useEffect(() => {
    const id = dealId.trim()
    if (!id) return
    const sectionsStorageKey = offeringPreviewSectionsStorageKey(id)
    const bumpSections = () => setSectionsRevision((n) => n + 1)
    const onCustom = (e: Event) => {
      const d = (e as CustomEvent<{ dealId?: string }>).detail
      if (d?.dealId === id) bumpSections()
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === sectionsStorageKey) bumpSections()
    }
    window.addEventListener(OFFERING_PREVIEW_SECTIONS_CHANGED_EVENT, onCustom)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener(
        OFFERING_PREVIEW_SECTIONS_CHANGED_EVENT,
        onCustom,
      )
      window.removeEventListener("storage", onStorage)
    }
  }, [dealId])

  const offeringDocuments = useMemo(() => {
    if (!audience) return []
    const base = listDocumentsForInvestmentDetail(dealId, audience)
    return [...base.all].sort((a, b) =>
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
    )
  }, [dealId, audience, sectionsRevision])

  const filteredOffering = useMemo(
    () => filterDocuments(offeringDocuments, query),
    [offeringDocuments, query],
  )

  const esignProfileTabs = useMemo(
    () =>
      buildEsignProfileStatusTabs(
        esignDocuments.map((d) => ({
          fileId: d.id.replace(/^esign-/, ""),
          name: d.name,
          categoryId: d.categoryId,
        })),
        null,
      ),
    [esignDocuments],
  )

  useEffect(() => {
    if (esignProfileTabs.length === 0) {
      setActiveEsignProfileId(null)
      return
    }
    setActiveEsignProfileId((prev) => {
      if (prev && esignProfileTabs.some((t) => t.categoryId === prev)) return prev
      return esignProfileTabs[0]?.categoryId ?? null
    })
  }, [esignProfileTabs])

  const esignDocumentsForProfile = useMemo(() => {
    if (!activeEsignProfileId) return esignDocuments
    return esignDocuments.filter(
      (d) => (d.categoryId?.trim() || "_other") === activeEsignProfileId,
    )
  }, [esignDocuments, activeEsignProfileId])

  const filteredEsign = useMemo(
    () => filterDocuments(esignDocumentsForProfile, query),
    [esignDocumentsForProfile, query],
  )

  const firstPendingSignatureRequestId = useMemo(() => {
    const pending = esignDocuments.find(
      (d) => d.canSign && d.signatureRequestId?.trim(),
    )
    return pending?.signatureRequestId?.trim() ?? null
  }, [esignDocuments])

  const showAudienceGate =
    !audience && esignDocuments.length === 0 && activeSubTab === "offering"

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

        <div className="lpdd_doc_search um_search_wrap">
          <Search className="um_search_icon" size={16} strokeWidth={2} aria-hidden />
          <input
            type="search"
            className="um_search_input"
            placeholder={
              activeSubTab === "esignatures"
                ? "Search e-sign documents…"
                : "Search offering documents…"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={
              activeSubTab === "esignatures"
                ? "Search e-sign documents"
                : "Search offering documents"
            }
            autoComplete="off"
          />
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
              offeringDocuments={offeringDocuments}
              filteredOffering={filteredOffering}
            />
          ) : (
            <EsignaturesDocumentsPanel
              esignPending={esignPending}
              esignLoadError={esignLoadError}
              esignDocuments={esignDocuments}
              esignProfileTabs={esignProfileTabs}
              activeEsignProfileId={activeEsignProfileId}
              onEsignProfileChange={setActiveEsignProfileId}
              filteredEsign={filteredEsign}
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
  offeringDocuments,
  filteredOffering,
}: {
  showAudienceGate: boolean
  previewSyncFailed: boolean
  offeringDocuments: InvestmentDetailDocumentRow[]
  filteredOffering: InvestmentDetailDocumentRow[]
}) {
  const hasAny = offeringDocuments.length > 0
  const hasFiltered = filteredOffering.length > 0

  return (
    <div
      id="inv-docs-panel-offering"
      role="tabpanel"
      aria-labelledby="inv-docs-tab-offering"
      className="investment_detail_docs_subpanel"
    >
      {showAudienceGate ? (
        <p className="investment_detail_documents_status">
          Sign in as an investor with a commitment on this deal to view offering
          documents shared by your sponsor.
        </p>
      ) : previewSyncFailed && !hasAny ? (
        <p className="investment_detail_documents_status" role="alert">
          Could not load the latest document list from the server. Try refreshing
          the page, or open this investment again after your sponsor shares files on
          the deal Documents tab.
        </p>
      ) : !hasAny ? (
        <p className="investment_detail_documents_status">
          No offering documents are visible to you on this deal yet.
        </p>
      ) : !hasFiltered ? (
        <p className="investment_detail_documents_status">
          No offering documents match your search.
        </p>
      ) : (
        <div className="investment_detail_documents_groups">
          {previewSyncFailed ? (
            <p className="investment_detail_tab_hint" role="status">
              Showing cached documents; a fresh sync from the server was not
              available.
            </p>
          ) : null}
          <ul className="lpd_doc_list">
            {filteredOffering.map((doc) => (
              <DocumentRow key={`${doc.source}-${doc.id}`} doc={doc} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function EsignaturesDocumentsPanel({
  esignPending,
  esignLoadError,
  esignDocuments,
  esignProfileTabs,
  activeEsignProfileId,
  onEsignProfileChange,
  filteredEsign,
  firstPendingSignatureRequestId,
  onOpenSignModal,
}: {
  esignPending: boolean
  esignLoadError: string | null
  esignDocuments: InvestmentDetailDocumentRow[]
  esignProfileTabs: ReturnType<typeof buildEsignProfileStatusTabs>
  activeEsignProfileId: string | null
  onEsignProfileChange: (categoryId: string) => void
  filteredEsign: InvestmentDetailDocumentRow[]
  firstPendingSignatureRequestId: string | null
  onOpenSignModal: (signatureRequestId?: string | null) => void
}) {
  const hasAny = esignDocuments.length > 0
  const hasFiltered = filteredEsign.length > 0

  return (
    <div
      id="inv-docs-panel-esignatures"
      role="tabpanel"
      aria-labelledby="inv-docs-tab-esignatures"
      className="investment_detail_docs_subpanel"
    >
      {/* <p className="investment_detail_documents_group_hint">
        Subscription documents sent for your signature on this deal.
      </p>

      <div className="deal_esign_panel_head_row">
        <span />
        <button type="button" className="deal_esign_refresh_btn" onClick={onRefresh}>
          Refresh from Dropbox Sign
        </button>
      </div> */}

      {esignLoadError ? (
        <p className="deal_esign_notice deal_esign_notice--error" role="alert">
          {esignLoadError}
        </p>
      ) : null}

      {esignProfileTabs.length > 1 ? (
        <div
          className="um_members_tabs_outer deals_tabs_outer um_segmented_tabs_outer investment_detail_esign_profile_tabs_outer"
          role="presentation"
        >
          <div
            className="um_members_tabs_row deals_tabs_row um_segmented_tabs_row"
            role="tablist"
            aria-label="E-sign profile types"
          >
            {esignProfileTabs.map((tab) => {
              const selected = tab.categoryId === activeEsignProfileId
              return (
                <button
                  key={tab.categoryId}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`um_members_tab deals_tabs_tab um_segmented_tab${
                    selected ? " um_members_tab_active" : ""
                  }`}
                  onClick={() => onEsignProfileChange(tab.categoryId)}
                >
                  <span className="deals_tabs_label um_segmented_tab_label">
                    {tab.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {esignPending ? (
        <p className="investment_detail_tab_hint investment_detail_esign_pending_hint">
          You have documents waiting for your signature.{" "}
          <button
            type="button"
            className="lpd_link lpd_link_button"
            onClick={() => onOpenSignModal(firstPendingSignatureRequestId)}
          >
            Sign now
          </button>
        </p>
      ) : null}

      {!hasAny ? (
        <p className="investment_detail_documents_status">
          No e-sign documents have been sent to you on this deal yet. When your
          sponsor sends templates for signature, they will appear here.
        </p>
      ) : !hasFiltered ? (
        <p className="investment_detail_documents_status">
          No e-sign documents match your search.
        </p>
      ) : (
        <ul className="lpd_doc_list">
          {filteredEsign.map((doc) => (
            <DocumentRow
              key={`${doc.source}-${doc.id}`}
              doc={doc}
              onOpenSignModal={() =>
                onOpenSignModal(doc.signatureRequestId ?? null)
              }
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function DocumentRow({
  doc,
  onOpenSignModal,
}: {
  doc: InvestmentDetailDocumentRow
  onOpenSignModal?: () => void
}) {
  const url = doc.url?.trim() || ""
  const canSign = Boolean(doc.canSign && onOpenSignModal)
  const isEsign = doc.source === "esign"
  const Icon = isEsign ? FileSignature : FileText

  return (
    <li className={`lpd_doc_item${isEsign ? " lpd_doc_item_esign" : ""}`}>
      <div className="lpd_doc_main">
        <Icon
          className="lpd_doc_ico"
          size={18}
          strokeWidth={2}
          aria-hidden
        />
        <div>
          <div className="lpd_doc_name">{doc.name}</div>
          <div className="lpd_doc_meta">
            {doc.sectionLabel}
            {" · "}
            {doc.visibilityLabel}
          </div>
        </div>
      </div>
      {url || canSign ? (
        <div
          className="lpd_doc_actions"
          role="group"
          aria-label={`${doc.name} actions`}
        >
          {canSign ? (
            <button
              type="button"
              className="lpd_doc_action lpd_link lpd_doc_action_sign"
              aria-label={`Sign ${doc.name}`}
              onClick={onOpenSignModal}
            >
              <FileSignature size={16} strokeWidth={2} aria-hidden />
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
                <Eye size={16} strokeWidth={2} aria-hidden />
                View
              </a>
              <a
                href={url}
                download={safeDownloadFilename(doc.name)}
                rel="noopener noreferrer"
                className="lpd_doc_action lpd_link"
                aria-label={`Download ${doc.name}`}
              >
                <Download size={16} strokeWidth={2} aria-hidden />
                Download
              </a>
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}
