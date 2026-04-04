import { MoreHorizontal, Plus, Search } from "lucide-react"
import {
  useCallback,
  useMemo,
  useState,
} from "react"
import type { DealDetailApi } from "../api/dealsApi"

interface DealAssetRow {
  id: string
  name: string
  address: string
  assetType: string
  imageCount: number
}

type SortKey = "name" | "address" | "assetType" | "images"
type SortDir = "asc" | "desc"

function buildRowsFromDetail(detail: DealDetailApi): DealAssetRow[] {
  const name = detail.propertyName?.trim() || "—"
  const address =
    [detail.city, detail.country].filter((x) => x?.trim()).join(", ") || "—"
  const imageCount = detail.assetImagePath?.trim() ? 1 : 0
  return [
    {
      id: `primary-${detail.id}`,
      name,
      address,
      assetType: "—",
      imageCount,
    },
  ]
}

function compareRows(a: DealAssetRow, b: DealAssetRow, key: SortKey, dir: SortDir): number {
  const mult = dir === "asc" ? 1 : -1
  if (key === "images") return (a.imageCount - b.imageCount) * mult
  const va =
    key === "name"
      ? a.name.toLowerCase()
      : key === "address"
        ? a.address.toLowerCase()
        : a.assetType.toLowerCase()
  const vb =
    key === "name"
      ? b.name.toLowerCase()
      : key === "address"
        ? b.address.toLowerCase()
        : b.assetType.toLowerCase()
  if (va < vb) return -1 * mult
  if (va > vb) return 1 * mult
  return 0
}

interface AssetsSectionProps {
  detail: DealDetailApi
}

export function AssetsSection({ detail }: AssetsSectionProps) {
  const [rows, setRows] = useState<DealAssetRow[]>(() =>
    buildRowsFromDetail(detail),
  )
  const [query, setQuery] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = rows
    if (q) {
      list = rows.filter((r) => {
        const blob = `${r.name} ${r.address} ${r.assetType}`.toLowerCase()
        return blob.includes(q)
      })
    }
    return [...list].sort((a, b) => compareRows(a, b, sortKey, sortDir))
  }, [rows, query, sortKey, sortDir])

  const onHeaderClick = useCallback(
    (key: SortKey) => {
      if (sortKey === key)
        setSortDir((d) => (d === "asc" ? "desc" : "asc"))
      else {
        setSortKey(key)
        setSortDir("asc")
      }
    },
    [sortKey],
  )

  const addAsset = useCallback(() => {
    setRows((prev) => [
      ...prev,
      {
        id: `asset-${Date.now()}`,
        name: "New asset",
        address: "—",
        assetType: "—",
        imageCount: 0,
      },
    ])
  }, [])

  return (
    <div className="deal_assets">
      <div className="deal_assets_toolbar">
        <label className="deal_assets_search_wrap">
          <span className="deal_assets_visually_hidden">Search assets</span>
          <input
            type="search"
            className="deal_assets_search"
            placeholder="Search assets..."
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            autoComplete="off"
          />
          <Search
            className="deal_assets_search_icon"
            size={18}
            strokeWidth={2}
            aria-hidden
          />
        </label>
        <button
          type="button"
          className="deal_assets_add_btn"
          onClick={addAsset}
        >
          <Plus size={18} strokeWidth={2} aria-hidden />
          Add asset
        </button>
      </div>

      <div className="deal_assets_table_wrap" role="region" aria-label="Assets list">
        <div className="deal_assets_table" role="table">
          <div className="deal_assets_thead" role="rowgroup">
            <div className="deal_assets_tr deal_assets_tr_head" role="row">
              <SortableHeader
                label="Name"
                sortKey="name"
                activeKey={sortKey}
                sortDir={sortDir}
                onSort={onHeaderClick}
              />
              <SortableHeader
                label="Address"
                sortKey="address"
                activeKey={sortKey}
                sortDir={sortDir}
                onSort={onHeaderClick}
              />
              <SortableHeader
                label="Asset type"
                sortKey="assetType"
                activeKey={sortKey}
                sortDir={sortDir}
                onSort={onHeaderClick}
              />
              <SortableHeader
                label="Images"
                sortKey="images"
                activeKey={sortKey}
                sortDir={sortDir}
                onSort={onHeaderClick}
              />
              <div
                className="deal_assets_th deal_assets_th_actions"
                role="columnheader"
              >
                Actions
              </div>
            </div>
          </div>
          <div className="deal_assets_tbody" role="rowgroup">
            {filteredSorted.length === 0 ? (
              <p className="deal_assets_empty" role="status">
                No assets match your search.
              </p>
            ) : (
              filteredSorted.map((row) => (
                <div key={row.id} className="deal_assets_tr deal_assets_tr_body" role="row">
                  <div className="deal_assets_td" role="cell">
                    <button type="button" className="deal_assets_name_link">
                      {row.name}
                    </button>
                  </div>
                  <div className="deal_assets_td" role="cell">
                    {row.address}
                  </div>
                  <div className="deal_assets_td" role="cell">
                    {row.assetType}
                  </div>
                  <div className="deal_assets_td" role="cell">
                    {row.imageCount}{" "}
                    {row.imageCount === 1 ? "image" : "images"}
                  </div>
                  <div
                    className="deal_assets_td deal_assets_td_actions"
                    role="cell"
                  >
                    <button
                      type="button"
                      className="deal_assets_row_menu"
                      aria-label={`Actions for ${row.name}`}
                    >
                      <MoreHorizontal size={18} strokeWidth={2} aria-hidden />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface SortableHeaderProps {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  sortDir,
  onSort,
}: SortableHeaderProps) {
  const active = activeKey === sortKey
  return (
    <div className="deal_assets_th" role="columnheader">
      <button
        type="button"
        className={`deal_assets_th_btn${active ? " deal_assets_th_btn_active" : ""}`}
        onClick={() => onSort(sortKey)}
      >
        <span>{label}</span>
        <span className="deal_assets_sort_arrows" aria-hidden>
          <span
            className={`deal_assets_sort_up${active && sortDir === "asc" ? " deal_assets_sort_lit" : ""}`}
          />
          <span
            className={`deal_assets_sort_dn${active && sortDir === "desc" ? " deal_assets_sort_lit" : ""}`}
          />
        </span>
      </button>
    </div>
  )
}
