import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Archive, Download, MapPin, Plus, Search, UserCircle, Users } from "lucide-react"
import { TabsScrollStrip } from "@/common/components/tabs-scroll-strip/TabsScrollStrip"
import { toast } from "@/common/components/Toast"
import {
  DataTable,
  type DataTableColumn,
} from "@/common/components/data-table/DataTable"
import {
  AddBeneficiaryModal,
  type BeneficiaryDraft,
} from "./AddBeneficiaryModal"
import { ExportAddressesModal } from "./ExportAddressesModal"
import { ExportBeneficiariesModal } from "./ExportBeneficiariesModal"
import { ExportInvestorProfilesModal } from "./ExportInvestorProfilesModal"
import { AddAddressModal } from "./AddAddressModal"
import { formatSavedAddressLabel, type AddressFormDraft, type SavedAddress } from "./address.types"
import { COUNTRY_OPTIONS, US_STATE_OPTIONS } from "./usStates"
import { DEALS_LIST_REFETCH_EVENT } from "@/modules/Syndication/InvestorPortal/Deals/createDealFormDraftStorage"
import { getMergedInvestmentListRows } from "../investments/investmentsRuntimeData"
import type { InvestmentListRow } from "../investments/investments.types"
import {
  fetchMyProfileBook,
  patchBeneficiaryArchived,
  patchInvestorProfileArchived,
  patchSavedAddressArchived,
  postBeneficiary,
  postSavedAddress,
  putBeneficiary,
  putSavedAddress,
} from "./investingProfileBookApi"
import {
  exportBeneficiaryRow,
  exportInvestorProfileRow,
  exportSavedAddressRow,
} from "./investingProfileBookExport"
import { InvestingEntityViewModal } from "./InvestingEntityViewModal"
import type { InvestorProfileListRow } from "./investor-profiles.types"
import {
  fetchInvestmentCountsByUserInvestorProfileId,
  mergeInvestorProfileRowsWithLinkedCounts,
} from "./profileInvestmentCounts"
import { InvestingProfilesRowActions } from "./InvestingProfilesRowActions"
import "@/modules/usermanagement/user_management.css"
import "@/modules/Syndication/InvestorPortal/Deals/deals-list.css"
import "@/modules/contacts/contacts.css"
import "./investing-profiles.css"

type ProfilesTab = "my-profiles" | "beneficiaries" | "addresses"
type ListStatusTab = "active" | "archived"

type BeneficiaryListRow = BeneficiaryDraft & { id: string; archived?: boolean }

type ViewModalState =
  | { kind: "profile"; row: InvestorProfileListRow }
  | { kind: "beneficiary"; row: BeneficiaryListRow }
  | { kind: "address"; row: SavedAddress }
  | null

function fileSlug(s: string, fallback: string): string {
  const t = s
    .trim()
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 48)
  return t || fallback
}

function formatProfileListDate(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return "—"
  return new Date(t).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/**
 * LP investing shell: `/investing/profiles` — profiles, beneficiaries, and saved addresses.
 */
export default function InvestingProfilesPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ProfilesTab>("my-profiles")
  const [addBenOpen, setAddBenOpen] = useState(false)
  const [addAddressOpen, setAddAddressOpen] = useState(false)
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryListRow[]>([])
  const [profiles, setProfiles] = useState<InvestorProfileListRow[]>([])
  const [mergedInvRows, setMergedInvRows] = useState<InvestmentListRow[]>([])
  /** One deal commitment per `userInvestorProfileId` from the deals API; not from collapsed list rows. */
  const [investmentCountByProfileId, setInvestmentCountByProfileId] = useState<
    ReadonlyMap<string, number> | null
  >(null)
  const [query, setQuery] = useState("")
  const [beneQuery, setBeneQuery] = useState("")
  const [addrQuery, setAddrQuery] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [benePage, setBenePage] = useState(1)
  const [benePageSize, setBenePageSize] = useState(10)
  const [addrPage, setAddrPage] = useState(1)
  const [addrPageSize, setAddrPageSize] = useState(10)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportBeneModalOpen, setExportBeneModalOpen] = useState(false)
  const [exportAddrModalOpen, setExportAddrModalOpen] = useState(false)
  const [profilesStatusTab, setProfilesStatusTab] = useState<ListStatusTab>("active")
  const [beneStatusTab, setBeneStatusTab] = useState<ListStatusTab>("active")
  const [addrStatusTab, setAddrStatusTab] = useState<ListStatusTab>("active")
  const [loadError, setLoadError] = useState<string | null>(null)
  const [bookLoading, setBookLoading] = useState(true)
  const [viewModal, setViewModal] = useState<ViewModalState>(null)
  const [editBeneficiary, setEditBeneficiary] = useState<BeneficiaryListRow | null>(null)
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadError(null)
    setBookLoading(true)
    void (async () => {
      try {
        const [book, inv, byProfile] = await Promise.all([
          fetchMyProfileBook(),
          getMergedInvestmentListRows().catch((): InvestmentListRow[] => []),
          fetchInvestmentCountsByUserInvestorProfileId().catch(
            (): ReadonlyMap<string, number> => new Map(),
          ),
        ])
        if (cancelled) return
        setProfiles(book.profiles)
        setMergedInvRows(inv)
        setInvestmentCountByProfileId(byProfile)
        setBeneficiaries(book.beneficiaries)
        setSavedAddresses(book.addresses)
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error
              ? e.message
              : "Could not load your profile data. Check that you are signed in.",
          )
        }
      } finally {
        if (!cancelled) setBookLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function onDealsListRefetch() {
      void (async () => {
        try {
          const [inv, byProfile] = await Promise.all([
            getMergedInvestmentListRows(),
            fetchInvestmentCountsByUserInvestorProfileId(),
          ])
          setMergedInvRows(inv)
          setInvestmentCountByProfileId(byProfile)
        } catch {
          // keep prior merged rows; profile book API may still have counts
        }
      })()
    }
    window.addEventListener(DEALS_LIST_REFETCH_EVENT, onDealsListRefetch)
    return () => {
      window.removeEventListener(DEALS_LIST_REFETCH_EVENT, onDealsListRefetch)
    }
  }, [])

  const profilesDisplay = useMemo(
    () =>
      mergeInvestorProfileRowsWithLinkedCounts(
        profiles,
        mergedInvRows,
        investmentCountByProfileId,
      ),
    [profiles, mergedInvRows, investmentCountByProfileId],
  )

  const addBeneficiary = useCallback(
    (b: BeneficiaryDraft) => {
      const id = editBeneficiary?.id
      void (async () => {
        try {
          if (id) {
            const row = await putBeneficiary(id, b)
            setBeneficiaries((prev) => prev.map((x) => (x.id === row.id ? row : x)))
            toast.success("Beneficiary updated", "Your changes were saved.")
          } else {
            const row = await postBeneficiary(b)
            setBeneficiaries((prev) => [row, ...prev])
            toast.success("Beneficiary added", "Your beneficiary was saved.")
          }
        } catch (e) {
          toast.error(
            "Could not save beneficiary",
            e instanceof Error ? e.message : "Please try again.",
          )
        }
      })()
    },
    [editBeneficiary],
  )

  const addressInitialDraft = useMemo((): AddressFormDraft | null => {
    if (!editingAddress) return null
    return {
      fullNameOrCompany: editingAddress.fullNameOrCompany,
      country: editingAddress.country,
      street1: editingAddress.street1,
      street2: editingAddress.street2,
      city: editingAddress.city,
      state: editingAddress.state,
      zip: editingAddress.zip,
      checkMemo: editingAddress.checkMemo,
      distributionNote: editingAddress.distributionNote,
    }
  }, [editingAddress])

  const addAddress = useCallback(
    (a: AddressFormDraft) => {
      const addrId = editingAddress?.id
      void (async () => {
        try {
          if (addrId) {
            const row = await putSavedAddress(addrId, a)
            setSavedAddresses((prev) => prev.map((x) => (x.id === row.id ? row : x)))
            toast.success("Address updated", "Your changes were saved.")
          } else {
            const row = await postSavedAddress(a)
            setSavedAddresses((prev) => [row, ...prev])
            toast.success("Address added", "Your address was saved.")
          }
        } catch (e) {
          toast.error(
            "Could not save address",
            e instanceof Error ? e.message : "Please try again.",
          )
        }
      })()
    },
    [editingAddress],
  )

  const setProfileArchived = useCallback((id: string, archived: boolean) => {
    void (async () => {
      try {
        const row = await patchInvestorProfileArchived(id, archived)
        setProfiles((prev) => prev.map((p) => (p.id === id ? row : p)))
      } catch (e) {
        toast.error(
          "Could not update profile",
          e instanceof Error ? e.message : "Please try again.",
        )
      }
    })()
  }, [])

  const setBeneficiaryArchived = useCallback((id: string, archived: boolean) => {
    void (async () => {
      try {
        const row = await patchBeneficiaryArchived(id, archived)
        setBeneficiaries((prev) => prev.map((b) => (b.id === id ? row : b)))
      } catch (e) {
        toast.error(
          "Could not update beneficiary",
          e instanceof Error ? e.message : "Please try again.",
        )
      }
    })()
  }, [])

  const setAddressArchived = useCallback((id: string, archived: boolean) => {
    void (async () => {
      try {
        const row = await patchSavedAddressArchived(id, archived)
        setSavedAddresses((prev) => prev.map((a) => (a.id === id ? row : a)))
      } catch (e) {
        toast.error(
          "Could not update address",
          e instanceof Error ? e.message : "Please try again.",
        )
      }
    })()
  }, [])

  const benInitialDraft = useMemo((): BeneficiaryDraft | null => {
    if (!editBeneficiary) return null
    return {
      fullName: editBeneficiary.fullName,
      relationship: editBeneficiary.relationship,
      taxId: editBeneficiary.taxId,
      phone: editBeneficiary.phone,
      email: editBeneficiary.email,
      addressQuery: editBeneficiary.addressQuery,
    }
  }, [editBeneficiary])

  const profileActiveCount = useMemo(
    () => profiles.filter((p) => !p.archived).length,
    [profiles],
  )
  const profileArchivedCount = useMemo(
    () => profiles.filter((p) => p.archived).length,
    [profiles],
  )
  const beneActiveCount = useMemo(
    () => beneficiaries.filter((b) => !b.archived).length,
    [beneficiaries],
  )
  const beneArchivedCount = useMemo(
    () => beneficiaries.filter((b) => b.archived).length,
    [beneficiaries],
  )
  const addrActiveCount = useMemo(
    () => savedAddresses.filter((a) => !a.archived).length,
    [savedAddresses],
  )
  const addrArchivedCount = useMemo(
    () => savedAddresses.filter((a) => a.archived).length,
    [savedAddresses],
  )

  const profilesByStatus = useMemo(() => {
    return profilesStatusTab === "archived"
      ? profilesDisplay.filter((p) => p.archived)
      : profilesDisplay.filter((p) => !p.archived)
  }, [profilesDisplay, profilesStatusTab])

  const filteredProfiles = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return [...profilesByStatus]
    return profilesByStatus.filter((r) => {
      const dateLabel = formatProfileListDate(r.dateCreated).toLowerCase()
      return (
        (r.profileName ?? "").toLowerCase().includes(q) ||
        (r.profileType ?? "").toLowerCase().includes(q) ||
        (r.addedBy ?? "").toLowerCase().includes(q) ||
        String(r.investmentsCount).includes(q) ||
        dateLabel.includes(q)
      )
    })
  }, [query, profilesByStatus])

  useEffect(() => {
    setPage(1)
  }, [query, profiles.length, profilesStatusTab])

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(filteredProfiles.length / pageSize),
    )
    if (page > totalPages) setPage(totalPages)
  }, [filteredProfiles.length, pageSize, page])

  const profilesPagination = useMemo(
    () => ({
      page,
      pageSize,
      totalItems: filteredProfiles.length,
      onPageChange: setPage,
      onPageSizeChange: (n: number) => {
        setPageSize(n)
        setPage(1)
      },
      ariaLabel: "Profiles table pagination",
    }),
    [page, pageSize, filteredProfiles.length],
  )

  const beneficiariesByStatus = useMemo(() => {
    return beneStatusTab === "archived"
      ? beneficiaries.filter((b) => b.archived)
      : beneficiaries.filter((b) => !b.archived)
  }, [beneficiaries, beneStatusTab])

  const filteredBeneficiaries = useMemo(() => {
    const q = beneQuery.trim().toLowerCase()
    if (!q) return beneficiariesByStatus
    return beneficiariesByStatus.filter((b) => {
      return (
        (b.fullName ?? "").toLowerCase().includes(q) ||
        (b.relationship ?? "").toLowerCase().includes(q) ||
        (b.email ?? "").toLowerCase().includes(q) ||
        (b.phone ?? "").toLowerCase().includes(q) ||
        (b.addressQuery ?? "").toLowerCase().includes(q) ||
        (b.taxId ?? "").toLowerCase().includes(q)
      )
    })
  }, [beneQuery, beneficiariesByStatus])

  const addressesByStatus = useMemo(() => {
    return addrStatusTab === "archived"
      ? savedAddresses.filter((a) => a.archived)
      : savedAddresses.filter((a) => !a.archived)
  }, [addrStatusTab, savedAddresses])

  const filteredAddresses = useMemo(() => {
    const q = addrQuery.trim().toLowerCase()
    if (!q) return addressesByStatus
    return addressesByStatus.filter((a) => {
      const stateLabel =
        US_STATE_OPTIONS.find((s) => s.value === a.state)?.label ?? a.state
      const countryLabel =
        COUNTRY_OPTIONS.find((c) => c.value === a.country)?.label ?? a.country
      const line = [
        a.fullNameOrCompany,
        a.street1,
        a.street2,
        a.city,
        stateLabel,
        a.zip,
        countryLabel,
        a.checkMemo,
        a.distributionNote,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return line.includes(q)
    })
  }, [addrQuery, savedAddresses])

  useEffect(() => {
    setBenePage(1)
  }, [beneQuery, beneficiaries.length, beneStatusTab])

  useEffect(() => {
    setAddrPage(1)
  }, [addrQuery, savedAddresses.length, addrStatusTab])

  useEffect(() => {
    const t = Math.max(1, Math.ceil(filteredBeneficiaries.length / benePageSize))
    if (benePage > t) setBenePage(t)
  }, [filteredBeneficiaries.length, benePageSize, benePage])

  useEffect(() => {
    const t = Math.max(1, Math.ceil(filteredAddresses.length / addrPageSize))
    if (addrPage > t) setAddrPage(t)
  }, [filteredAddresses.length, addrPageSize, addrPage])

  const benePagination = useMemo(
    () => ({
      page: benePage,
      pageSize: benePageSize,
      totalItems: filteredBeneficiaries.length,
      onPageChange: setBenePage,
      onPageSizeChange: (n: number) => {
        setBenePageSize(n)
        setBenePage(1)
      },
      ariaLabel: "Beneficiaries table pagination",
    }),
    [benePage, benePageSize, filteredBeneficiaries.length],
  )

  const addressPagination = useMemo(
    () => ({
      page: addrPage,
      pageSize: addrPageSize,
      totalItems: filteredAddresses.length,
      onPageChange: setAddrPage,
      onPageSizeChange: (n: number) => {
        setAddrPageSize(n)
        setAddrPage(1)
      },
      ariaLabel: "Addresses table pagination",
    }),
    [addrPage, addrPageSize, filteredAddresses.length],
  )

  const viewModalConfig = useMemo(() => {
    if (!viewModal) return null
    if (viewModal.kind === "profile") {
      const r = viewModal.row
      return {
        title: "Profile details" as const,
        rows: [
          { label: "Profile name", value: r.profileName },
          { label: "Profile type", value: r.profileType },
          { label: "Added by", value: r.addedBy },
          { label: "Investments", value: String(r.investmentsCount ?? 0) },
          { label: "Date created", value: formatProfileListDate(r.dateCreated) },
          { label: "Status", value: r.archived ? "Archived" : "Active" },
          {
            label: "Last change note",
            value: r.lastEditReason?.trim() || "—",
          },
        ],
      }
    }
    if (viewModal.kind === "beneficiary") {
      const r = viewModal.row
      return {
        title: "Beneficiary details" as const,
        rows: [
          { label: "Name", value: r.fullName },
          { label: "Relationship", value: r.relationship },
          { label: "Email", value: r.email },
          { label: "Phone", value: r.phone },
          { label: "Address", value: r.addressQuery },
          { label: "Tax ID", value: r.taxId },
          { label: "Status", value: r.archived ? "Archived" : "Active" },
        ],
      }
    }
    const a = viewModal.row
    const countryLabel =
      COUNTRY_OPTIONS.find((c) => c.value === a.country)?.label ?? a.country
    const stateLabel =
      US_STATE_OPTIONS.find((s) => s.value === a.state)?.label ?? a.state
    return {
      title: "Address details" as const,
      rows: [
        { label: "Name / company", value: a.fullNameOrCompany },
        { label: "Country", value: countryLabel },
        { label: "Street line 1", value: a.street1 },
        { label: "Street line 2", value: a.street2 },
        { label: "City", value: a.city },
        { label: "State / region", value: stateLabel },
        { label: "Zip", value: a.zip },
        { label: "Check memo", value: a.checkMemo },
        { label: "Distribution note", value: a.distributionNote },
        { label: "Status", value: a.archived ? "Archived" : "Active" },
      ],
    }
  }, [viewModal])

  const profileColumns: DataTableColumn<InvestorProfileListRow>[] = useMemo(
    () => [
      {
        id: "profileName",
        header: "Profile name",
        sortValue: (r) => (r.profileName ?? "").toLowerCase(),
        tdClassName: "um_td_user",
        cell: (r) => r.profileName?.trim() || "—",
      },
      {
        id: "profileType",
        header: "Profile type",
        sortValue: (r) => (r.profileType ?? "").toLowerCase(),
        cell: (r) => r.profileType || "—",
      },
      {
        id: "addedBy",
        header: "Added by",
        sortValue: (r) => (r.addedBy ?? "").toLowerCase(),
        cell: (r) => r.addedBy?.trim() || "—",
      },
      {
        id: "investments",
        header: "Investments",
        align: "right",
        thClassName: "deals_th_align_right",
        tdClassName: "um_td_numeric",
        sortValue: (r) => r.investmentsCount,
        cell: (r) => String(r.investmentsCount ?? 0),
      },
      {
        id: "dateCreated",
        header: "Date created",
        sortValue: (r) => Date.parse(r.dateCreated) || 0,
        cell: (r) => formatProfileListDate(r.dateCreated),
      },
      {
        id: "actions",
        header: "Actions",
        align: "right",
        thClassName: "um_th_actions",
        tdClassName: "um_td_actions",
        cell: (row) => (
          <InvestingProfilesRowActions
            displayName={row.profileName}
            kind="profile"
            archived={Boolean(row.archived)}
            onSetArchived={(v) => setProfileArchived(row.id, v)}
            onView={() => setViewModal({ kind: "profile", row })}
            onEdit={() => void navigate(`/investing/profiles/${encodeURIComponent(row.id)}/edit`)}
            onExport={() =>
              exportInvestorProfileRow(row, fileSlug(row.profileName, "profile"))
            }
          />
        ),
      },
    ],
    [setProfileArchived, navigate],
  )

  const beneficiaryColumns: DataTableColumn<BeneficiaryListRow>[] = useMemo(
    () => [
      {
        id: "fullName",
        header: "Name",
        sortValue: (r) => (r.fullName ?? "").toLowerCase(),
        tdClassName: "um_td_user",
        cell: (r) => r.fullName?.trim() || "—",
      },
      {
        id: "relationship",
        header: "Relationship",
        sortValue: (r) => (r.relationship ?? "").toLowerCase(),
        cell: (r) => r.relationship?.trim() || "—",
      },
      {
        id: "email",
        header: "Email",
        sortValue: (r) => (r.email ?? "").toLowerCase(),
        cell: (r) => r.email?.trim() || "—",
      },
      {
        id: "phone",
        header: "Phone",
        sortValue: (r) => (r.phone ?? "").toLowerCase(),
        cell: (r) => r.phone?.trim() || "—",
      },
      {
        id: "address",
        header: "Address",
        sortValue: (r) => (r.addressQuery ?? "").toLowerCase(),
        cell: (r) => r.addressQuery?.trim() || "—",
      },
      {
        id: "actions",
        header: "Actions",
        align: "right",
        thClassName: "um_th_actions",
        tdClassName: "um_td_actions",
        cell: (row) => (
          <InvestingProfilesRowActions
            displayName={row.fullName}
            kind="beneficiary"
            archived={Boolean(row.archived)}
            onSetArchived={(v) => setBeneficiaryArchived(row.id, v)}
            onView={() => setViewModal({ kind: "beneficiary", row })}
            onEdit={() => {
              setEditBeneficiary(row)
              setAddBenOpen(true)
            }}
            onExport={() =>
              exportBeneficiaryRow(row, fileSlug(row.fullName, "beneficiary"))
            }
          />
        ),
      },
    ],
    [setBeneficiaryArchived],
  )

  const addressColumns: DataTableColumn<SavedAddress>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Name / company",
        sortValue: (r) => (r.fullNameOrCompany ?? "").toLowerCase(),
        tdClassName: "um_td_user",
        cell: (r) => r.fullNameOrCompany?.trim() || "—",
      },
      {
        id: "address",
        header: "Address",
        sortValue: (r) => formatSavedAddressLabel(r).toLowerCase(),
        cell: (r) => {
          const countryLabel =
            COUNTRY_OPTIONS.find((c) => c.value === r.country)?.label ?? r.country
          const stateLabel =
            US_STATE_OPTIONS.find((s) => s.value === r.state)?.label ?? r.state
          return (
            <span className="investing_profiles_addr_multiline">
              {[
                [r.street1, r.street2].filter(Boolean).join(", "),
                [r.city, stateLabel, r.zip].filter(Boolean).join(", "),
                countryLabel,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )
        },
      },
      {
        id: "checkMemo",
        header: "Check memo",
        sortValue: (r) => (r.checkMemo ?? "").toLowerCase(),
        cell: (r) => r.checkMemo?.trim() || "—",
      },
      {
        id: "distributionNote",
        header: "Distribution note",
        sortValue: (r) => (r.distributionNote ?? "").toLowerCase(),
        cell: (r) => r.distributionNote?.trim() || "—",
      },
      {
        id: "actions",
        header: "Actions",
        align: "right",
        thClassName: "um_th_actions",
        tdClassName: "um_td_actions",
        cell: (row) => (
          <InvestingProfilesRowActions
            displayName={row.fullNameOrCompany}
            kind="address"
            archived={Boolean(row.archived)}
            onSetArchived={(v) => setAddressArchived(row.id, v)}
            onView={() => setViewModal({ kind: "address", row })}
            onEdit={() => {
              setEditingAddress(row)
              setAddAddressOpen(true)
            }}
            onExport={() =>
              exportSavedAddressRow(
                row,
                fileSlug(row.fullNameOrCompany, "address"),
              )
            }
          />
        ),
      },
    ],
    [setAddressArchived],
  )

  return (
    <section className="um_page deals_list_page investing_profiles_page">
      <div className="um_members_header_block">
        <div className="um_header_row">
          <h2 className="um_title um_title_with_icon">
            <UserCircle
              className="um_title_icon"
              size={26}
              strokeWidth={1.75}
              aria-hidden
            />
            Profiles
          </h2>
        </div>
      </div>

      {loadError ? (
        <div
          className="um_panel"
          style={{ marginBottom: "1rem", color: "var(--um-danger, #b42318)" }}
          role="alert"
        >
          {loadError}
        </div>
      ) : null}

      <div className="um_members_tabs_outer deals_tabs_outer">
        <TabsScrollStrip scrollClassName="deals_tabs_scroll">
          <div
            className="um_members_tabs_row deals_tabs_row"
            role="tablist"
            aria-label="Profiles sections"
          >
            <button
              type="button"
              id="profiles-tab-my-profiles"
              role="tab"
              aria-selected={activeTab === "my-profiles"}
              aria-controls="profiles-panel-my-profiles"
              className={`um_members_tab deals_tabs_tab${activeTab === "my-profiles" ? " um_members_tab_active" : ""}`}
              onClick={() => setActiveTab("my-profiles")}
            >
              <UserCircle
                className="deals_tabs_icon"
                size={18}
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="deals_tabs_label">My Profiles</span>
              <span className="deals_tabs_count">({profiles.length})</span>
            </button>
            <button
              type="button"
              id="profiles-tab-beneficiaries"
              role="tab"
              aria-selected={activeTab === "beneficiaries"}
              aria-controls="profiles-panel-beneficiaries"
              className={`um_members_tab deals_tabs_tab${activeTab === "beneficiaries" ? " um_members_tab_active" : ""}`}
              onClick={() => setActiveTab("beneficiaries")}
            >
              <Users
                className="deals_tabs_icon"
                size={18}
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="deals_tabs_label">Beneficiaries</span>
              <span className="deals_tabs_count">({beneficiaries.length})</span>
            </button>
            <button
              type="button"
              id="profiles-tab-addresses"
              role="tab"
              aria-selected={activeTab === "addresses"}
              aria-controls="profiles-panel-addresses"
              className={`um_members_tab deals_tabs_tab${activeTab === "addresses" ? " um_members_tab_active" : ""}`}
              onClick={() => setActiveTab("addresses")}
            >
              <MapPin
                className="deals_tabs_icon"
                size={18}
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="deals_tabs_label">Address</span>
              <span className="deals_tabs_count">({savedAddresses.length})</span>
            </button>
          </div>
        </TabsScrollStrip>
      </div>

      <div
        className="um_members_tab_content"
        id="profiles-tab-panels"
      >
        {activeTab === "my-profiles" && (
          <div
            id="profiles-panel-my-profiles"
            role="tabpanel"
            aria-labelledby="profiles-tab-my-profiles"
            className="um_panel um_members_tab_panel deals_list_table_panel deals_list_card_surface deal_inv_table_panel"
          >
            <div className="um_members_header_block contacts_inner_header">
              <h2 className="investing_profiles_title investing_profiles_sr_only">
                My profiles
              </h2>
              <div className="contacts_toolbar_filters_row">
                <div
                  className="contacts_filter_button_group"
                  role="group"
                  aria-label="Filter profiles by status"
                >
                  <button
                    type="button"
                    id="investing-profiles-filter-active"
                    aria-pressed={profilesStatusTab === "active"}
                    className={`contacts_filter_btn${
                      profilesStatusTab === "active" ? " contacts_filter_btn_active" : ""
                    }`}
                    onClick={() => setProfilesStatusTab("active")}
                  >
                    <UserCircle size={16} strokeWidth={1.75} aria-hidden />
                    <span>Active</span>
                    <span className="contacts_filter_btn_count">({profileActiveCount})</span>
                  </button>
                  <button
                    type="button"
                    id="investing-profiles-filter-archived"
                    aria-pressed={profilesStatusTab === "archived"}
                    className={`contacts_filter_btn${
                      profilesStatusTab === "archived" ? " contacts_filter_btn_active" : ""
                    }`}
                    onClick={() => setProfilesStatusTab("archived")}
                  >
                    <Archive size={16} strokeWidth={1.75} aria-hidden />
                    <span>Archived</span>
                    <span className="contacts_filter_btn_count">({profileArchivedCount})</span>
                  </button>
                </div>
                <button
                  type="button"
                  className="um_btn_primary contacts_toolbar_add_btn"
                  onClick={() => void navigate("/investing/profiles/add")}
                >
                  <Plus size={18} strokeWidth={2} aria-hidden />
                  Add profile
                </button>
              </div>
            </div>
            <div className="um_toolbar deal_inv_table_um_toolbar">
              <div className="um_search_wrap">
                <Search className="um_search_icon" size={18} aria-hidden />
                <input
                  type="search"
                  className="um_search_input"
                  placeholder="Search profiles…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search profiles"
                />
              </div>
              <div className="um_toolbar_actions deal_inv_table_toolbar_actions deals_list_toolbar_actions">
                <button
                  type="button"
                  className="um_toolbar_export_btn"
                  onClick={() => setExportModalOpen(true)}
                >
                  <Download size={18} strokeWidth={2} aria-hidden />
                  <span>Export all profiles</span>
                </button>
              </div>
            </div>
            <DataTable<InvestorProfileListRow>
              visualVariant="members"
              membersTableClassName="um_table_members deal_inv_table"
              columns={profileColumns}
              rows={filteredProfiles}
              isLoading={bookLoading}
              getRowKey={(r, i) => r.id || `profile-row-${i}`}
              emptyLabel={
                query.trim()
                  ? "No profiles match your search."
                  : profilesStatusTab === "archived"
                    ? "No archived profiles. Use Archive in the row menu on the Active tab to move a profile here."
                    : "You have not added a profile yet. Use Add profile to get started."
              }
              initialSort={{ columnId: "dateCreated", direction: "desc" }}
              pagination={
                filteredProfiles.length > 0 ? profilesPagination : undefined
              }
            />
          </div>
        )}

        {activeTab === "beneficiaries" && (
          <div
            id="profiles-panel-beneficiaries"
            role="tabpanel"
            aria-labelledby="profiles-tab-beneficiaries"
            className="um_panel um_members_tab_panel deals_list_table_panel deals_list_card_surface deal_inv_table_panel"
          >
            <div className="um_members_header_block contacts_inner_header">
              <h2 className="investing_profiles_title investing_profiles_sr_only">
                Beneficiaries
              </h2>
              <div className="contacts_toolbar_filters_row">
                <div
                  className="contacts_filter_button_group"
                  role="group"
                  aria-label="Filter beneficiaries by status"
                >
                  <button
                    type="button"
                    id="investing-bene-filter-active"
                    aria-pressed={beneStatusTab === "active"}
                    className={`contacts_filter_btn${
                      beneStatusTab === "active" ? " contacts_filter_btn_active" : ""
                    }`}
                    onClick={() => setBeneStatusTab("active")}
                  >
                    <Users size={16} strokeWidth={1.75} aria-hidden />
                    <span>Active</span>
                    <span className="contacts_filter_btn_count">({beneActiveCount})</span>
                  </button>
                  <button
                    type="button"
                    id="investing-bene-filter-archived"
                    aria-pressed={beneStatusTab === "archived"}
                    className={`contacts_filter_btn${
                      beneStatusTab === "archived" ? " contacts_filter_btn_active" : ""
                    }`}
                    onClick={() => setBeneStatusTab("archived")}
                  >
                    <Archive size={16} strokeWidth={1.75} aria-hidden />
                    <span>Archived</span>
                    <span className="contacts_filter_btn_count">({beneArchivedCount})</span>
                  </button>
                </div>
                <button
                  type="button"
                  className="um_btn_primary contacts_toolbar_add_btn"
                  onClick={() => {
                    setEditBeneficiary(null)
                    setAddBenOpen(true)
                  }}
                >
                  <Plus size={18} strokeWidth={2} aria-hidden />
                  Add beneficiary
                </button>
              </div>
            </div>
            <div className="um_toolbar deal_inv_table_um_toolbar">
              <div className="um_search_wrap">
                <Search className="um_search_icon" size={18} aria-hidden />
                <input
                  type="search"
                  className="um_search_input"
                  placeholder="Search beneficiaries…"
                  value={beneQuery}
                  onChange={(e) => setBeneQuery(e.target.value)}
                  aria-label="Search beneficiaries"
                />
              </div>
              <div className="um_toolbar_actions deal_inv_table_toolbar_actions deals_list_toolbar_actions">
                <button
                  type="button"
                  className="um_toolbar_export_btn"
                  onClick={() => setExportBeneModalOpen(true)}
                >
                  <Download size={18} strokeWidth={2} aria-hidden />
                  <span>Export all beneficiaries</span>
                </button>
              </div>
            </div>
            <DataTable<BeneficiaryListRow>
              visualVariant="members"
              membersTableClassName="um_table_members deal_inv_table"
              columns={beneficiaryColumns}
              rows={filteredBeneficiaries}
              isLoading={bookLoading}
              getRowKey={(r) => r.id}
              emptyLabel={
                beneQuery.trim()
                  ? "No beneficiaries match your search."
                  : beneStatusTab === "archived"
                    ? "No archived beneficiaries. Use Archive in the row menu on the Active tab to move a row here."
                    : "You have not added a beneficiary yet. Use Add beneficiary to get started."
              }
              initialSort={{ columnId: "fullName", direction: "asc" }}
              pagination={
                filteredBeneficiaries.length > 0 ? benePagination : undefined
              }
            />
          </div>
        )}

        {activeTab === "addresses" && (
          <div
            id="profiles-panel-addresses"
            role="tabpanel"
            aria-labelledby="profiles-tab-addresses"
            className="um_panel um_members_tab_panel deals_list_table_panel deals_list_card_surface deal_inv_table_panel"
          >
            <div className="um_members_header_block contacts_inner_header">
              <h2 className="investing_profiles_title investing_profiles_sr_only">Address</h2>
              <div className="contacts_toolbar_filters_row">
                <div
                  className="contacts_filter_button_group"
                  role="group"
                  aria-label="Filter addresses by status"
                >
                  <button
                    type="button"
                    id="investing-addr-filter-active"
                    aria-pressed={addrStatusTab === "active"}
                    className={`contacts_filter_btn${
                      addrStatusTab === "active" ? " contacts_filter_btn_active" : ""
                    }`}
                    onClick={() => setAddrStatusTab("active")}
                  >
                    <MapPin size={16} strokeWidth={1.75} aria-hidden />
                    <span>Active</span>
                    <span className="contacts_filter_btn_count">({addrActiveCount})</span>
                  </button>
                  <button
                    type="button"
                    id="investing-addr-filter-archived"
                    aria-pressed={addrStatusTab === "archived"}
                    className={`contacts_filter_btn${
                      addrStatusTab === "archived" ? " contacts_filter_btn_active" : ""
                    }`}
                    onClick={() => setAddrStatusTab("archived")}
                  >
                    <Archive size={16} strokeWidth={1.75} aria-hidden />
                    <span>Archived</span>
                    <span className="contacts_filter_btn_count">({addrArchivedCount})</span>
                  </button>
                </div>
                <button
                  type="button"
                  className="um_btn_primary contacts_toolbar_add_btn"
                  onClick={() => {
                    setEditingAddress(null)
                    setAddAddressOpen(true)
                  }}
                >
                  <Plus size={18} strokeWidth={2} aria-hidden />
                  Add address
                </button>
              </div>
            </div>
            <div className="um_toolbar deal_inv_table_um_toolbar">
              <div className="um_search_wrap">
                <Search className="um_search_icon" size={18} aria-hidden />
                <input
                  type="search"
                  className="um_search_input"
                  placeholder="Search addresses…"
                  value={addrQuery}
                  onChange={(e) => setAddrQuery(e.target.value)}
                  aria-label="Search saved addresses"
                />
              </div>
              <div className="um_toolbar_actions deal_inv_table_toolbar_actions deals_list_toolbar_actions">
                <button
                  type="button"
                  className="um_toolbar_export_btn"
                  onClick={() => setExportAddrModalOpen(true)}
                >
                  <Download size={18} strokeWidth={2} aria-hidden />
                  <span>Export all addresses</span>
                </button>
              </div>
            </div>
            <DataTable<SavedAddress>
              visualVariant="members"
              membersTableClassName="um_table_members deal_inv_table"
              columns={addressColumns}
              rows={filteredAddresses}
              isLoading={bookLoading}
              getRowKey={(r) => r.id}
              emptyLabel={
                addrQuery.trim()
                  ? "No saved addresses match your search."
                  : addrStatusTab === "archived"
                    ? "No archived addresses. Use Archive in the row menu on the Active tab to move a row here."
                    : "You have not added an address yet. Use Add address to get started."
              }
              initialSort={{ columnId: "name", direction: "asc" }}
              pagination={
                filteredAddresses.length > 0 ? addressPagination : undefined
              }
            />
          </div>
        )}
      </div>

      {viewModalConfig ? (
        <InvestingEntityViewModal
          open
          onClose={() => setViewModal(null)}
          title={viewModalConfig.title}
          rows={viewModalConfig.rows}
        />
      ) : null}
      <ExportInvestorProfilesModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        profiles={profilesDisplay}
      />
      <ExportBeneficiariesModal
        open={exportBeneModalOpen}
        onClose={() => setExportBeneModalOpen(false)}
        beneficiaries={beneficiaries}
      />
      <ExportAddressesModal
        open={exportAddrModalOpen}
        onClose={() => setExportAddrModalOpen(false)}
        addresses={savedAddresses}
      />
      <AddBeneficiaryModal
        open={addBenOpen}
        onClose={() => {
          setAddBenOpen(false)
          setEditBeneficiary(null)
        }}
        onSave={addBeneficiary}
        initial={benInitialDraft}
        variant={editBeneficiary ? "edit" : "add"}
        savedAddresses={savedAddresses}
      />
      <AddAddressModal
        open={addAddressOpen}
        onClose={() => {
          setAddAddressOpen(false)
          setEditingAddress(null)
        }}
        onSave={addAddress}
        initialDraft={addressInitialDraft}
        isEdit={Boolean(editingAddress)}
      />
    </section>
  )
}
