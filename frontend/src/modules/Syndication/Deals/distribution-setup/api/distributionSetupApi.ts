import { portalAuthHeaders } from "../../../../../common/auth/portalAuthHeaders"
import { getApiV1Base } from "../../../../../common/utils/apiBaseUrl"
import { blurFormatMoneyInput } from "../../utils/offeringMoneyFormat"
import type {
  DistributionPaymentRow,
  DistributionSetupBundle,
  DistributionWaterfalls,
  DistributionWfKind,
} from "../types/distribution-setup.types"

function authHeaders(): HeadersInit {
  return portalAuthHeaders()
}

function asRecord(v: unknown): Record<string, unknown> {
  if (v != null && typeof v === "object" && !Array.isArray(v))
    return v as Record<string, unknown>
  return {}
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v != null ? String(v).trim() : ""
}

function moneyField(raw: unknown, fallback = "0"): string {
  const t = str(raw) || fallback
  return blurFormatMoneyInput(t) || blurFormatMoneyInput(fallback) || "$0"
}

function parseRow(raw: unknown, i: number): DistributionPaymentRow {
  const o = asRecord(raw)
  const catchup = asRecord(o.catchup)
  const payTo = Array.isArray(o.payTo)
    ? o.payTo
    : Array.isArray(o.pay_to)
      ? o.pay_to
      : []
  return {
    id: str(o.id) || `row_${i + 1}`,
    kind: (str(o.kind) || "LP_PREF") as DistributionWfKind,
    name: str(o.name) || "Payment row",
    payTo: payTo.map((id) => str(id)).filter(Boolean),
    amountMode: str(o.amountMode ?? o.amount_mode) === "input" ? "input" : "calc",
    inputAmount: moneyField(o.inputAmount ?? o.input_amount),
    catchupPct: str(catchup.pct ?? o.catchupPct ?? o.catchup_pct) || "20",
  }
}

function normalizeBundle(raw: Record<string, unknown>): DistributionSetupBundle {
  const wf = asRecord(raw.waterfalls)
  const classesRaw = Array.isArray(raw.classes) ? raw.classes : []
  const promote = asRecord(raw.promote)
  const hurdlesRaw = Array.isArray(promote.hurdles) ? promote.hurdles : []
  const sharesRaw = asRecord(promote.shares)

  return {
    dealId: str(raw.dealId ?? raw.deal_id),
    dealName: str(raw.dealName ?? raw.deal_name),
    targetRaise: moneyField(raw.targetRaise ?? raw.target_raise),
    waterfalls: {
      operating: (Array.isArray(wf.operating) ? wf.operating : []).map(parseRow),
      capital: (Array.isArray(wf.capital) ? wf.capital : []).map(parseRow),
    },
    classes: classesRaw.map((c, i) => {
      const row = asRecord(c)
      const pref = asRecord(row.preferredReturn ?? row.preferred_return)
      const prefEq = asRecord(row.prefEquity ?? row.pref_equity)
      const mezz = asRecord(row.mezz)
      return {
        id: str(row.id) || `cls_${i}`,
        name: str(row.name) || `Class ${i + 1}`,
        classType: str(row.classType ?? row.class_type) || "lp",
        actuallyFunded: moneyField(
          row.actuallyFunded ?? row.actually_funded,
        ),
        equityPct: str(row.equityPct ?? row.equity_pct) || "0",
        preferredReturn: {
          enabled: Boolean(pref.enabled),
          rate: str(pref.rate) || "0",
        },
        prefEquity: {
          totalRate: str(prefEq.totalRate ?? prefEq.total_rate) || "0",
          currentRate: str(prefEq.currentRate ?? prefEq.current_rate) || "0",
          accrualRate: str(prefEq.accrualRate ?? prefEq.accrual_rate) || "0",
        },
        mezz: {
          rate: str(mezz.rate) || "0",
          pay: str(mezz.pay) || "Current pay",
        },
      }
    }),
    promote: {
      hurdles: hurdlesRaw.map((h, i) => {
        const row = asRecord(h)
        return {
          id: str(row.id) || `h${i + 1}`,
          rate: str(row.rate) || "0",
          basis: str(row.basis) || "Cumulative return",
          measuredOn: str(row.measuredOn ?? row.measured_on) || "LP classes",
        }
      }),
      shares: Object.fromEntries(
        Object.entries(sharesRaw).map(([k, v]) => [
          k,
          Array.isArray(v) ? v.map((x) => str(x) || "0") : [],
        ]),
      ),
    },
  }
}

export async function fetchDistributionSetup(
  dealId: string,
): Promise<DistributionSetupBundle> {
  const base = getApiV1Base()
  if (!base) throw new Error("API is not configured (VITE_BASE_URL).")
  const res = await fetch(
    `${base}/deals/${encodeURIComponent(dealId)}/distribution-setup`,
    { headers: { ...authHeaders() }, credentials: "include" },
  )
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok)
    throw new Error(
      data.message != null ? String(data.message) : `Error ${res.status}`,
    )
  return normalizeBundle(
    asRecord(data.distributionSetup ?? data.distribution_setup),
  )
}

export async function saveDistributionSetup(
  dealId: string,
  waterfalls: DistributionWaterfalls,
): Promise<DistributionSetupBundle> {
  const base = getApiV1Base()
  if (!base) throw new Error("API is not configured (VITE_BASE_URL).")
  const res = await fetch(
    `${base}/deals/${encodeURIComponent(dealId)}/distribution-setup`,
    {
      method: "PUT",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ waterfalls }),
    },
  )
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok)
    throw new Error(
      data.message != null ? String(data.message) : `Error ${res.status}`,
    )
  return normalizeBundle(
    asRecord(data.distributionSetup ?? data.distribution_setup),
  )
}

export function newPaymentRowId(): string {
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}
