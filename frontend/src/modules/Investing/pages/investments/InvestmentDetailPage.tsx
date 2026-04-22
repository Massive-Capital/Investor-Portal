import { ArrowLeft, Calendar } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { setAppDocumentTitle } from "@/common/utils/appDocumentTitle"
import "@/modules/usermanagement/user_management.css"
import "@/modules/Syndication/InvestorPortal/Deals/deals-list.css"
import { loadInvestmentDetailFromDeal } from "./investmentsListFromDeals"
import { getInvestmentDetail } from "./investmentsRuntimeData"
import type { InvestmentDetailRecord } from "./investments.types"
import "./investment-detail.css"

const PROPERTY_TYPES = [
  "Multifamily",
  "Industrial",
  "Office",
  "Retail",
  "Mixed-use",
  "Other",
] as const

const PROPERTY_STATUSES = [
  "Stabilized",
  "Leased",
  "Renovation",
  "Lease-up",
  "Other",
] as const

const INVESTED_AS = [
  "Limited partner",
  "Co-investor",
  "GP",
  "Other",
] as const

const LOAN_TYPES = [
  "Senior mortgage",
  "CMBS",
  "Bridge",
  "Mezzanine",
  "Other",
] as const

const IO_AMORT = ["Interest-only", "Amortizing", "Split"] as const

function formatMoneyDigits(raw: string): string {
  const n = Number.parseFloat(String(raw ?? "").replace(/[^0-9.-]/g, ""))
  if (!Number.isFinite(n)) return raw || ""
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function FieldText({
  label,
  value,
  required,
}: {
  label: string
  value: string
  required?: boolean
}) {
  return (
    <div className="investment_detail_field">
      <label className="investment_detail_label">
        {label}
        {required ? (
          <span className="investment_detail_req" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      <input
        type="text"
        className="investment_detail_input"
        readOnly
        value={value}
        aria-required={required}
      />
    </div>
  )
}

function FieldCurrency({ label, value }: { label: string; value: string }) {
  const display = value ? formatMoneyDigits(value) : "—"
  return (
    <div className="investment_detail_field">
      <label className="investment_detail_label">{label}</label>
      <input
        type="text"
        className="investment_detail_input"
        readOnly
        value={display}
      />
    </div>
  )
}

function FieldPct({ label, value }: { label: string; value: string }) {
  return (
    <div className="investment_detail_field">
      <label className="investment_detail_label">{label}</label>
      <div className="investment_detail_input_wrap">
        <input
          type="text"
          className="investment_detail_input investment_detail_input--pct"
          readOnly
          value={value}
        />
        <span className="investment_detail_suffix" aria-hidden>
          %
        </span>
      </div>
    </div>
  )
}

function FieldDate({ label, value }: { label: string; value: string }) {
  return (
    <div className="investment_detail_field">
      <label className="investment_detail_label">{label}</label>
      <div className="investment_detail_input_wrap">
        <input
          type="text"
          className="investment_detail_input"
          readOnly
          value={value}
        />
        <Calendar
          className="investment_detail_date_icon"
          size={18}
          strokeWidth={1.75}
          aria-hidden
        />
      </div>
    </div>
  )
}

function FieldSelect({
  label,
  value,
  options,
}: {
  label: string
  value: string
  options: readonly string[]
}) {
  return (
    <div className="investment_detail_field">
      <label className="investment_detail_label">{label}</label>
      <select
        className="investment_detail_select"
        disabled
        value={value}
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

function DetailForm({ d }: { d: InvestmentDetailRecord }) {
  const list = d.list
  const investedDisplay = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(list.investedAmount)

  return (
    <>
      <section
        className="investment_detail_section"
        aria-labelledby="inv-sec-property"
      >
        <h2 id="inv-sec-property" className="investment_detail_section_title">
          Property information
        </h2>
        <div className="investment_detail_grid">
          <FieldText label="Name" value={d.propertyName} required />
          <FieldSelect
            label="Property type"
            value={d.propertyType}
            options={PROPERTY_TYPES}
          />
          <FieldSelect
            label="Status"
            value={d.propertyStatus}
            options={PROPERTY_STATUSES}
          />
          <FieldText label="City" value={d.city} />
          <FieldText label="State" value={d.state} />
          <FieldText label="Number of units" value={d.numberOfUnits} />
          <FieldPct label="Occupancy" value={d.occupancyPct} />
          <FieldDate label="Owned since" value={d.ownedSince} />
          <FieldText label="Year built" value={d.yearBuilt} />
        </div>
      </section>

      <section className="investment_detail_section" aria-labelledby="inv-sec-general">
        <h2 id="inv-sec-general" className="investment_detail_section_title">
          General
        </h2>
        <div className="investment_detail_grid">
          <div className="investment_detail_field">
            <label className="investment_detail_label">Invested amount</label>
            <input
              type="text"
              className="investment_detail_input"
              readOnly
              value={investedDisplay}
            />
          </div>
          <FieldSelect
            label="Invested as"
            value={d.investedAs}
            options={INVESTED_AS}
          />
          <FieldPct label="Ownership percentage" value={d.ownershipPct} />
          <div className="investment_detail_field investment_detail_field--full">
            <label className="investment_detail_label">General comments</label>
            <input
              type="text"
              className="investment_detail_input"
              readOnly
              value={d.generalComments}
            />
          </div>
        </div>
      </section>

      <section
        className="investment_detail_section"
        aria-labelledby="inv-sec-cashflow"
      >
        <h2 id="inv-sec-cashflow" className="investment_detail_section_title">
          Cash flow and valuation
        </h2>
        <div className="investment_detail_grid">
          <FieldCurrency
            label="Overall asset value"
            value={d.overallAssetValue}
          />
          <FieldCurrency
            label="Net operating income"
            value={d.netOperatingIncome}
          />
        </div>
      </section>

      <section className="investment_detail_section" aria-labelledby="inv-sec-debt">
        <h2 id="inv-sec-debt" className="investment_detail_section_title">
          Debt info
        </h2>
        <div className="investment_detail_grid">
          <FieldCurrency
            label="Outstanding loans"
            value={d.outstandingLoans}
          />
          <FieldCurrency label="Debt service" value={d.debtService} />
          <FieldSelect label="Loan type" value={d.loanType} options={LOAN_TYPES} />
          <FieldSelect
            label="IO or Amortizing"
            value={d.ioOrAmortizing}
            options={IO_AMORT}
          />
          <FieldDate label="Maturity date" value={d.maturityDate} />
          <FieldText label="Lender" value={d.lender} />
          <FieldPct label="Interest rate" value={d.interestRatePct} />
        </div>
      </section>
    </>
  )
}

export default function InvestmentDetailPage() {
  const { investmentId = "" } = useParams<{ investmentId: string }>()
  const decodedId = useMemo(
    () => decodeURIComponent(investmentId.trim()),
    [investmentId],
  )
  const fromLocal = useMemo(
    () => (decodedId ? getInvestmentDetail(decodedId) : undefined),
    [decodedId],
  )
  const [fromApi, setFromApi] = useState<InvestmentDetailRecord | null | undefined>(
    undefined,
  )
  const [loadPending, setLoadPending] = useState(false)

  useEffect(() => {
    if (fromLocal) {
      setFromApi(null)
      return
    }
    if (!decodedId) {
      setFromApi(null)
      return
    }
    let cancelled = false
    setLoadPending(true)
    void (async () => {
      try {
        const d = await loadInvestmentDetailFromDeal(decodedId)
        if (!cancelled) setFromApi(d ?? null)
      } catch {
        if (!cancelled) setFromApi(null)
      } finally {
        if (!cancelled) setLoadPending(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [decodedId, fromLocal])

  const detail = fromLocal ?? fromApi ?? null

  useEffect(() => {
    if (loadPending && !fromLocal) {
      setAppDocumentTitle("Investment")
      return
    }
    if (!detail) {
      setAppDocumentTitle(
        decodedId ? "Investment not found" : "Investment",
      )
      return
    }
    const t =
      detail.list.investmentName?.trim() ||
      detail.propertyName?.trim() ||
      "Investment"
    setAppDocumentTitle(t)
  }, [detail, decodedId, loadPending, fromLocal])

  if (!decodedId) {
    return (
      <div className="um_page deals_list_page deals_detail_page investment_detail_page">
        <p className="deals_list_not_found">Missing investment.</p>
      </div>
    )
  }

  if (loadPending && !fromLocal) {
    return (
      <div className="um_page deals_list_page deals_detail_page investment_detail_page">
        <p className="deals_list_not_found" role="status">
          Loading investment…
        </p>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="um_page deals_list_page deals_detail_page investment_detail_page">
        <p className="deals_list_not_found">
          Investment not found.{" "}
          <Link to="/investing/investments" className="deals_list_inline_back">
            <ArrowLeft size={18} strokeWidth={2} aria-hidden />
            Back to investments
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="um_page deals_list_page deals_detail_page investment_detail_page">
      <Link to="/investing/investments" className="investment_detail_back">
        <ArrowLeft size={18} strokeWidth={2} aria-hidden />
        Back to investments
      </Link>
      <h1 className="investment_detail_title">
        {detail.list.investmentName || detail.propertyName}
      </h1>
      <DetailForm d={detail} />
    </div>
  )
}
