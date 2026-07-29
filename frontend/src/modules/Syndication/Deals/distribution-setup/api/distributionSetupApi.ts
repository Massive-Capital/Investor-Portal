import { portalAuthHeaders } from "../../../../../common/auth/portalAuthHeaders"
import { getApiV1Base } from "../../../../../common/utils/apiBaseUrl"
import { blurFormatMoneyInput } from "../../utils/offeringMoneyFormat"
import type {
  DistributionPaymentRow,
  DistributionSetupBundle,
  DistributionWaterfalls,
  DistributionWfKind,
  PriorDistributionRecord,
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
  const operatingRaw = Array.isArray(wf.operating) ? wf.operating : []
  const capitalRaw = Array.isArray(wf.capital)
    ? wf.capital
    : Array.isArray(wf.capital_event)
      ? wf.capital_event
      : []
  const priorRaw = Array.isArray(raw.priorDistributions)
    ? raw.priorDistributions
    : Array.isArray(raw.prior_distributions)
      ? raw.prior_distributions
      : []
  const priorDistributions: PriorDistributionRecord[] = priorRaw
    .map((item, i) => {
      const row = asRecord(item)
      const amount = moneyField(row.amount, "")
      const date = str(row.date).slice(0, 10)
      if (!amount || amount === "$0" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
        return null
      const sourceRaw = str(row.source ?? row.waterfall ?? row.wf).toLowerCase()
      const source =
        sourceRaw === "capital" || sourceRaw === "capital_event"
          ? "capital"
          : sourceRaw === "operating"
            ? "operating"
            : str(row.source) || undefined
      const periodRaw = str(row.period).toLowerCase()
      const period =
        periodRaw === "monthly" ||
        periodRaw === "quarterly" ||
        periodRaw === "annual"
          ? (periodRaw as PriorDistributionRecord["period"])
          : undefined
      const paymentsRaw = Array.isArray(row.investorPayments)
        ? row.investorPayments
        : Array.isArray(row.investor_payments)
          ? row.investor_payments
          : []
      const investorPayments = paymentsRaw
        .map((p) => {
          const pay = asRecord(p)
          const payment = moneyField(pay.payment, "")
          const investorId = str(pay.investorId ?? pay.investor_id)
          if (!investorId || !payment) return null
          return {
            investorId,
            ...(str(pay.contactId ?? pay.contact_id)
              ? { contactId: str(pay.contactId ?? pay.contact_id) }
              : {}),
            ...(str(pay.userEmail ?? pay.user_email)
              ? {
                  userEmail: str(pay.userEmail ?? pay.user_email).toLowerCase(),
                }
              : {}),
            investorName:
              str(pay.investorName ?? pay.investor_name) || "—",
            classId: str(pay.classId ?? pay.class_id),
            className: str(pay.className ?? pay.class_name) || "—",
            capital: moneyField(pay.capital, "0"),
            percentOfClass: str(
              pay.percentOfClass ?? pay.percent_of_class,
            ) || "0",
            payment,
          }
        })
        .filter(
          (p): p is NonNullable<typeof p> => p != null,
        )
      return {
        id: str(row.id) || `dist_${date}_${i + 1}`,
        amount,
        date,
        ...(source ? { source } : {}),
        ...(str(row.name) ? { name: str(row.name) } : {}),
        ...(str(row.notes ?? row.note)
          ? { notes: str(row.notes ?? row.note) }
          : {}),
        ...(period ? { period } : {}),
        ...(investorPayments.length ? { investorPayments } : {}),
      }
    })
    .filter((p): p is PriorDistributionRecord => p != null)
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    dealId: str(raw.dealId ?? raw.deal_id),
    dealName: str(raw.dealName ?? raw.deal_name),
    targetRaise: moneyField(raw.targetRaise ?? raw.target_raise),
    waterfalls: {
      operating: operatingRaw.map(parseRow),
      capital: capitalRaw.map(parseRow),
    },
    priorDistributions,
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

export async function completeDistributionSetup(
  dealId: string,
  waterfalls: DistributionWaterfalls,
  input: {
    source: "operating" | "capital"
    amount: number
    date?: string
    name?: string
    notes?: string
    period?: "monthly" | "quarterly" | "annual"
    investorPayments?: Array<{
      investorId: string
      contactId?: string
      userEmail?: string
      investorName: string
      classId: string
      className: string
      capital: number
      percentOfClass: number
      payment: number
    }>
  },
): Promise<DistributionSetupBundle> {
  const base = getApiV1Base()
  if (!base) throw new Error("API is not configured (VITE_BASE_URL).")

  // Save + complete on PUT (same path that already works for waterfall save).
  const putRes = await fetch(
    `${base}/deals/${encodeURIComponent(dealId)}/distribution-setup`,
    {
      method: "PUT",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ waterfalls, complete: input }),
    },
  )
  const putData = (await putRes.json().catch(() => ({}))) as Record<
    string,
    unknown
  >
  // New API returns `record` when the completed run was persisted on PUT.
  if (putRes.ok && putData.record != null) {
    return normalizeBundle(
      asRecord(putData.distributionSetup ?? putData.distribution_setup),
    )
  }
  // PUT rejected complete validation (after save) — do not mask as success.
  if (
    !putRes.ok &&
    putRes.status >= 400 &&
    putRes.status < 500 &&
    putRes.status !== 404 &&
    putData.message != null
  ) {
    throw new Error(String(putData.message))
  }

  const postRes = await fetch(
    `${base}/deals/${encodeURIComponent(dealId)}/distribution-setup/complete`,
    {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(input),
    },
  )
  const postData = (await postRes.json().catch(() => ({}))) as Record<
    string,
    unknown
  >
  if (postRes.ok) {
    return normalizeBundle(
      asRecord(postData.distributionSetup ?? postData.distribution_setup),
    )
  }

  const msg =
    postData.message != null
      ? String(postData.message)
      : putData.message != null
        ? String(putData.message)
        : `Error ${postRes.status}`
  if (/not found/i.test(msg) || postRes.status === 404) {
    throw new Error(
      "Complete API not available. Restart the backend (npm run dev in backend) and try again.",
    )
  }
  throw new Error(msg)
}

/** PATCH investor % / payment on a completed distribution (co-dependent; syncs add-investor %). */
export async function patchDistributionInvestorPercent(
  dealId: string,
  distributionId: string,
  input: {
    investorId: string
    percentOfClass?: number
    payment?: number
  },
): Promise<DistributionSetupBundle> {
  const base = getApiV1Base()
  if (!base) throw new Error("API is not configured (VITE_BASE_URL).")

  const body: Record<string, unknown> = { investorId: input.investorId }
  if (input.percentOfClass != null && Number.isFinite(input.percentOfClass)) {
    body.percentOfClass = input.percentOfClass
  }
  if (input.payment != null && Number.isFinite(input.payment)) {
    body.payment = input.payment
  }

  const res = await fetch(
    `${base}/deals/${encodeURIComponent(dealId)}/distributions/${encodeURIComponent(distributionId)}/investor-percent`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(body),
    },
  )
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(
      data.message != null
        ? String(data.message)
        : "Could not update investor payment share",
    )
  }
  return normalizeBundle(
    asRecord(data.distributionSetup ?? data.distribution_setup),
  )
}

export function newPaymentRowId(): string {
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}
