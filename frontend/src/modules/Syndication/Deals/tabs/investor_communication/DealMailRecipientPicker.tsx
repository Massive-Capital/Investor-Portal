import {
  ArrowDown,
  ChevronDown,
  Info,
  ListChecks,
  ListX,
  Search,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react"
import { EMAIL_UNAVAILABLE_LABEL } from "../../../../../common/utils/displayEmail"
import { investorRoleLabel } from "../../constants/investor-profile"
import {
  groupDealMailRecipients,
  type DealMailRecipient,
} from "./dealMailRecipients"

type RecipientTab = "all" | "lp" | "gp"

const LIST_NEAR_BOTTOM_PX = 24

function isListAwayFromBottom(el: HTMLElement): boolean {
  const overflow = el.scrollHeight - el.clientHeight
  if (overflow <= 8) return false
  return overflow - el.scrollTop > LIST_NEAR_BOTTOM_PX
}

interface DealMailRecipientPickerProps {
  recipients: DealMailRecipient[]
  selectedIds: Set<string>
  onChangeSelectedIds: (next: Set<string>) => void
  viewerIsCosponsor?: boolean
}

function TriCheckbox({
  checked,
  indeterminate,
  onChange,
  ariaLabel,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  ariaLabel: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (el) el.indeterminate = Boolean(indeterminate) && !checked
  }, [checked, indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      className="deal_inv_comm_recipient_cb"
      checked={checked}
      onChange={onChange}
      aria-label={ariaLabel}
    />
  )
}

function selectionState(ids: string[], selected: Set<string>) {
  const n = ids.length
  const count = ids.filter((id) => selected.has(id)).length
  return {
    all: n > 0 && count === n,
    some: count > 0 && count < n,
    count,
    n,
  }
}

function toggleIds(
  prev: Set<string>,
  ids: string[],
  selectAll: boolean,
): Set<string> {
  const next = new Set(prev)
  if (selectAll) {
    for (const id of ids) next.add(id)
    return next
  }
  for (const id of ids) next.delete(id)
  return next
}

function emailLine(
  recipient: DealMailRecipient,
  hideCoSponsorLpEmail: boolean,
): string {
  if (hideCoSponsorLpEmail && recipient.addedByIsCoSponsor && recipient.classKind !== "gp") {
    return EMAIL_UNAVAILABLE_LABEL
  }
  if (recipient.email.includes("@")) return recipient.email
  return EMAIL_UNAVAILABLE_LABEL
}

function lpGroupTitle(group: {
  sponsorName: string
  intercept: "yes" | "no" | null
  isCosponsor: boolean
}): string {
  if (group.intercept === "yes") return `${group.sponsorName} · Yes intercept`
  if (group.intercept === "no") return `${group.sponsorName} · No intercept`
  return group.sponsorName
}

function filterRecipientsByQuery(
  rows: DealMailRecipient[],
  query: string,
  hideCoSponsorLpEmail: boolean,
): DealMailRecipient[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((recipient) => {
    const hideEmail =
      hideCoSponsorLpEmail &&
      recipient.addedByIsCoSponsor &&
      recipient.classKind !== "gp"
    const haystack = [
      recipient.displayName,
      hideEmail ? "" : recipient.email,
      recipient.className,
      recipient.roleLabel,
      recipient.sponsorName,
      recipient.sponsorEmail,
    ]
      .join(" ")
      .toLowerCase()
    return haystack.includes(q)
  })
}

function InvestorRow({
  recipient,
  checked,
  onToggle,
  hideCoSponsorLpEmail,
}: {
  recipient: DealMailRecipient
  checked: boolean
  onToggle: () => void
  hideCoSponsorLpEmail: boolean
}) {
  const email = emailLine(recipient, hideCoSponsorLpEmail)
  const hasEmail =
    recipient.email.includes("@") &&
    !(
      hideCoSponsorLpEmail &&
      recipient.addedByIsCoSponsor &&
      recipient.classKind !== "gp"
    )
  return (
    <li className="deal_inv_comm_recipient_item">
      <label className="deal_inv_comm_recipient_row">
        <input
          type="checkbox"
          className="deal_inv_comm_recipient_cb"
          checked={checked}
          onChange={onToggle}
          aria-label={`Select ${recipient.displayName}`}
        />
        <span className="deal_inv_comm_recipient_content">
          <span className="deal_inv_comm_recipient_line">
            <span
              className="deal_inv_comm_recipient_name"
              title={recipient.displayName}
            >
              {recipient.displayName}
            </span>
          </span>
          <span className="deal_inv_comm_recipient_subline">
            <span
              className={`deal_inv_comm_recipient_email${
                hasEmail ? "" : " deal_inv_comm_recipient_email_muted"
              }`}
              title={email}
            >
              {email}
            </span>
            {recipient.className ? (
              <span className="deal_inv_comm_recipient_role">
                {recipient.className}
              </span>
            ) : recipient.roleLabel !== "—" ? (
              <span className="deal_inv_comm_recipient_role">
                {investorRoleLabel(recipient.roleLabel)}
              </span>
            ) : null}
          </span>
        </span>
      </label>
    </li>
  )
}

function GroupBlock({
  title,
  countLabel,
  ids,
  selectedIds,
  onChangeSelectedIds,
  hint,
  children,
}: {
  title: string
  countLabel: string
  ids: string[]
  selectedIds: Set<string>
  onChangeSelectedIds: (next: Set<string>) => void
  hint?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(true)
  const state = selectionState(ids, selectedIds)
  return (
    <div className="deal_inv_comm_recip_group">
      <div className="deal_inv_comm_recip_group_head">
        <TriCheckbox
          checked={state.all}
          indeterminate={state.some}
          onChange={() =>
            onChangeSelectedIds(toggleIds(selectedIds, ids, !state.all))
          }
          ariaLabel={`Select all ${title}`}
        />
        <button
          type="button"
          className="deal_inv_comm_recip_group_toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown
            size={16}
            strokeWidth={2}
            aria-hidden
            className={`deal_inv_comm_recip_group_chevron${
              open ? " deal_inv_comm_recip_group_chevron_open" : ""
            }`}
          />
          <span className="deal_inv_comm_recip_group_title">{title}</span>
          <span className="deal_inv_comm_recip_group_count">{countLabel}</span>
        </button>
      </div>
      {open && hint ? (
        <p className="deal_inv_comm_recip_group_hint" role="note">
          {hint}
        </p>
      ) : null}
      {open ? (
        <ul className="deal_inv_comm_recipient_list deal_inv_comm_recip_group_list">
          {children}
        </ul>
      ) : null}
    </div>
  )
}

function TabButton({
  id,
  label,
  count,
  active,
  onSelect,
}: {
  id: RecipientTab
  label: string
  count: number
  active: boolean
  onSelect: (id: RecipientTab) => void
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`deal-inv-comm-tab-${id}`}
      aria-selected={active}
      aria-controls="deal-inv-comm-tab-panel"
      className={`deal_inv_comm_recip_tab${active ? " deal_inv_comm_recip_tab_active" : ""}`}
      onClick={() => onSelect(id)}
    >
      <span className="deal_inv_comm_recip_tab_label">{label}</span>
      <span className="deal_inv_comm_recip_tab_count">{count}</span>
    </button>
  )
}

export function DealMailRecipientPicker({
  recipients,
  selectedIds,
  onChangeSelectedIds,
  viewerIsCosponsor = false,
}: DealMailRecipientPickerProps) {
  const [tab, setTab] = useState<RecipientTab>("all")
  const [query, setQuery] = useState("")
  const listScrollRef = useRef<HTMLDivElement>(null)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)

  useEffect(() => {
    if (viewerIsCosponsor) setTab("lp")
  }, [viewerIsCosponsor])
  const hideCoSponsorLpEmail = !viewerIsCosponsor
  const tree = useMemo(() => groupDealMailRecipients(recipients), [recipients])
  const filteredLps = useMemo(
    () => filterRecipientsByQuery(tree.lps, query, hideCoSponsorLpEmail),
    [tree.lps, query, hideCoSponsorLpEmail],
  )
  const filteredLpGroups = useMemo(
    () =>
      tree.lpGroups
        .map((group) => ({
          ...group,
          recipients: filterRecipientsByQuery(
            group.recipients,
            query,
            hideCoSponsorLpEmail,
          ),
        }))
        .filter((group) => group.recipients.length > 0),
    [tree.lpGroups, query, hideCoSponsorLpEmail],
  )
  const filteredGps = useMemo(
    () => filterRecipientsByQuery(tree.gps, query, hideCoSponsorLpEmail),
    [tree.gps, query, hideCoSponsorLpEmail],
  )
  const visibleIds = useMemo(() => {
    if (viewerIsCosponsor) return filteredLps.map((r) => r.id)
    if (tab === "lp") return filteredLps.map((r) => r.id)
    if (tab === "gp") return filteredGps.map((r) => r.id)
    return [...filteredLps, ...filteredGps].map((r) => r.id)
  }, [tab, filteredLps, filteredGps, viewerIsCosponsor])
  const visibleState = selectionState(visibleIds, selectedIds)
  const selectedCount = recipients.filter((r) => selectedIds.has(r.id)).length
  const releaseCount = recipients.filter(
    (r) => selectedIds.has(r.id) && r.requiresCosponsorRelease,
  ).length
  const holdLpCount = tree.lps.filter((r) => r.requiresCosponsorRelease).length
  const directLpCount = tree.lps.filter((r) => r.includeCoSponsorOnSend).length
  const ownLpCount = tree.lps.filter((r) => !r.requiresCosponsorRelease).length

  const syncScrollToBottomButton = useCallback(() => {
    const el = listScrollRef.current
    setShowScrollToBottom(el ? isListAwayFromBottom(el) : false)
  }, [])

  useLayoutEffect(() => {
    const el = listScrollRef.current
    if (!el) return
    syncScrollToBottomButton()
    el.addEventListener("scroll", syncScrollToBottomButton, { passive: true })
    const observer = new ResizeObserver(syncScrollToBottomButton)
    observer.observe(el)
    for (const child of el.children) observer.observe(child)
    return () => {
      el.removeEventListener("scroll", syncScrollToBottomButton)
      observer.disconnect()
    }
  }, [
    syncScrollToBottomButton,
    tab,
    query,
    recipients.length,
    filteredLps.length,
    filteredGps.length,
  ])

  function scrollListToBottom() {
    const el = listScrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }

  if (recipients.length === 0) {
    return (
      <p className="deal_inv_comm_recipient_empty" role="status">
        No investors on this deal.
      </p>
    )
  }

  return (
    <div className="deal_inv_comm_recipient_panel">
      <div className="deal_inv_comm_recip_tabs" role="tablist" aria-label="Investor type">
        {viewerIsCosponsor ? (
          <TabButton
            id="lp"
            label="Your investors"
            count={filteredLps.length}
            active
            onSelect={() => setTab("lp")}
          />
        ) : (
          <>
        <TabButton
          id="all"
          label="All"
          count={filteredLps.length + filteredGps.length}
          active={tab === "all"}
          onSelect={setTab}
        />
        <TabButton
          id="lp"
          label="Limited Partners"
          count={filteredLps.length}
          active={tab === "lp"}
          onSelect={setTab}
        />
        <TabButton
          id="gp"
          label="General Partners"
          count={filteredGps.length}
          active={tab === "gp"}
          onSelect={setTab}
        />
          </>
        )}
      </div>

      <div className="deal_inv_comm_recip_toolbar">
        <div className="deal_inv_comm_recip_search">
          <Search className="um_search_icon" size={16} aria-hidden />
          <input
            type="search"
            className="um_search_input deal_inv_comm_recip_search_input"
            placeholder={
              viewerIsCosponsor ? "Search your investors…" : "Search LP or GP…"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={
              viewerIsCosponsor
                ? "Search your investors"
                : "Search limited partners or general partners"
            }
          />
        </div>
        <div className="deal_inv_comm_recip_bulk">
          <button
            type="button"
            className="deal_inv_comm_recip_bulk_btn"
            onClick={() =>
              onChangeSelectedIds(toggleIds(selectedIds, visibleIds, true))
            }
            disabled={visibleIds.length === 0 || visibleState.all}
          >
            <ListChecks size={14} strokeWidth={2} aria-hidden />
            Select all
          </button>
          <button
            type="button"
            className="deal_inv_comm_recip_bulk_btn"
            onClick={() =>
              onChangeSelectedIds(toggleIds(selectedIds, visibleIds, false))
            }
            disabled={visibleState.count === 0}
          >
            <ListX size={14} strokeWidth={2} aria-hidden />
            Deselect all
          </button>
        </div>
      </div>

        {viewerIsCosponsor && ownLpCount > 0 ? (
        <p className="deal_inv_comm_recip_release_banner" role="note">
          <Info size={16} strokeWidth={2} aria-hidden />
          <span>
            Only your investors are listed. Lead, admin, and their investors
            are not included.
          </span>
        </p>
      ) : null}

      {!viewerIsCosponsor &&
      (holdLpCount > 0 || directLpCount > 0) &&
      (tab === "all" || tab === "lp") ? (
        <p className="deal_inv_comm_recip_release_banner" role="note">
          <Info size={16} strokeWidth={2} aria-hidden />
          <span>
            {holdLpCount > 0 && directLpCount > 0
              ? "Yes intercept: co-sponsor and their LPs. No intercept: co-sponsor only."
              : holdLpCount > 0
                ? "No intercept: co-sponsor only."
                : "Yes intercept: co-sponsor and their LPs."}
          </span>
        </p>
      ) : null}

      <div className="deal_inv_comm_recip_list_shell">
        <div
          ref={listScrollRef}
          id="deal-inv-comm-tab-panel"
          className="deal_inv_comm_recip_groups"
          role="tabpanel"
        >
          {tab !== "gp" && filteredLps.length > 0 ? (
            <div className={tab === "all" ? "deal_inv_comm_recip_section" : undefined}>
              {tab === "all" ? (
                <p className="deal_inv_comm_recip_section_label">Limited Partners</p>
              ) : null}
              {filteredLpGroups.map((group) => (
                <GroupBlock
                  key={group.key}
                  title={
                    viewerIsCosponsor ? "Your investors" : lpGroupTitle(group)
                  }
                  countLabel={`${group.recipients.length}`}
                  ids={group.recipients.map((r) => r.id)}
                  selectedIds={selectedIds}
                  onChangeSelectedIds={onChangeSelectedIds}
                >
                  {group.recipients.map((r) => (
                    <InvestorRow
                      key={r.id}
                      recipient={r}
                      hideCoSponsorLpEmail={hideCoSponsorLpEmail}
                      checked={selectedIds.has(r.id)}
                      onToggle={() =>
                        onChangeSelectedIds(
                          toggleIds(selectedIds, [r.id], !selectedIds.has(r.id)),
                        )
                      }
                    />
                  ))}
                </GroupBlock>
              ))}
            </div>
          ) : null}

          {!viewerIsCosponsor && tab !== "lp" && filteredGps.length > 0 ? (
            <div className={tab === "all" ? "deal_inv_comm_recip_section" : undefined}>
              {tab === "all" ? (
                <p className="deal_inv_comm_recip_section_label">General Partners</p>
              ) : null}
              <GroupBlock
                title="General Partners"
                countLabel={`${filteredGps.length}`}
                ids={filteredGps.map((r) => r.id)}
                selectedIds={selectedIds}
                onChangeSelectedIds={onChangeSelectedIds}
              >
                {filteredGps.map((r) => (
                  <InvestorRow
                    key={r.id}
                    recipient={r}
                    hideCoSponsorLpEmail={hideCoSponsorLpEmail}
                    checked={selectedIds.has(r.id)}
                    onToggle={() =>
                      onChangeSelectedIds(
                        toggleIds(selectedIds, [r.id], !selectedIds.has(r.id)),
                      )
                    }
                  />
                ))}
              </GroupBlock>
            </div>
          ) : null}

          {tab === "all" &&
          filteredLps.length === 0 &&
          filteredGps.length === 0 ? (
            <p className="deal_inv_comm_recipient_empty deal_inv_comm_recipient_empty_inset">
              No investors match your search.
            </p>
          ) : null}
          {tab === "lp" && filteredLps.length === 0 ? (
            <p className="deal_inv_comm_recipient_empty deal_inv_comm_recipient_empty_inset">
              {query.trim()
                ? viewerIsCosponsor
                  ? "No investors match your search."
                  : "No limited partners match your search."
                : viewerIsCosponsor
                  ? "You have no investors on this deal."
                  : "No limited partners on this deal."}
            </p>
          ) : null}
          {!viewerIsCosponsor && tab === "gp" && filteredGps.length === 0 ? (
            <p className="deal_inv_comm_recipient_empty deal_inv_comm_recipient_empty_inset">
              {query.trim()
                ? "No general partners match your search."
                : "No general partners on this deal."}
            </p>
          ) : null}
        </div>
        {showScrollToBottom ? (
          <button
            type="button"
            className="deal_inv_comm_recip_scroll_bottom"
            aria-label="Scroll to bottom"
            title="Scroll to bottom"
            onClick={scrollListToBottom}
          >
            <ArrowDown size={18} strokeWidth={2.25} aria-hidden />
          </button>
        ) : null}
      </div>

      <p className="deal_inv_comm_recip_summary" role="status">
        <strong>{selectedCount} selected</strong>
        {releaseCount > 0
          ? ` · ${releaseCount} held for co-sponsor (No intercept).`
          : "."}
      </p>
    </div>
  )
}
