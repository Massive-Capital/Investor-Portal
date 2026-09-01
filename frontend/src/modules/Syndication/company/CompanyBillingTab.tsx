import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  BadgeDollarSign,
  Briefcase,
  Calendar,
  Check,
  CreditCard,
  ExternalLink,
  Plus,
  Minus,
  Receipt,
  RotateCcw,
  Search,
  ShieldCheck,
  WalletCards,
  CircleDot,
  ChevronDown,
} from "lucide-react";
import {
  DataTable,
  type DataTableColumn,
} from "../../../common/components/data-table/DataTable";
import { TabsScrollStrip } from "../../../common/components/tabs-scroll-strip/TabsScrollStrip";
import {
  fetchCompanyBillingDeals,
  fetchCompanyBillingInvoices,
  fetchCompanyBillingPaymentMethods,
  fetchCompanyBillingStatus,
  openCompanyBillingPortal,
  payCompanyBillingWithSavedMethod,
  startCompanyBillingCheckout,
  startCompanyBillingSetupIntent,
  releaseCompanyBillingPayment,
  syncCompanyBillingCheckout,
  syncCompanyBillingPayment,
  syncCompanyBillingPaymentMethods,
  updateCompanyDealBillingCycle,
  normalizeBillingDealId,
  type BillingSetupIntentSession,
  type CompanyBillingInvoice,
  type CompanyBillingPaymentMethod,
  type CompanyBillingStatus,
  type CompanyDealBillingRow,
} from "./companyBillingApi";
import { BillingPaymentElementModal } from "./BillingPaymentElementModal";
import { BillingPayMethodModal } from "./BillingPayMethodModal";
import { isCompanyAdmin, isPlatformAdmin } from "../../../common/auth/roleUtils";
import { dealStageLabel } from "../dealsDashboardUtils";
import { formatDealListDateDisplay } from "../Deals/dealsListDisplay";
import { dealStageChipCompactClassName } from "../Deals/utils/dealStageChip";
import { DealAvatarIconRing } from "../../../common/components/entity-avatar/EntityAvatarNameCell";
import { toast } from "../../../common/components/Toast";

type BillingSubTab = "pricing" | "deals" | "payment-methods" | "payment-history";
type InvoiceRow = CompanyBillingInvoice;
type SeatBand = "5" | "10" | "10plus";

type DealTier = {
  id: "starter" | "running" | "growth";
  name: string;
  dealSize: string;
  companyUsers: number;
  featured: boolean;
  enabled: boolean;
  prices: Record<SeatBand, { monthly: number; annual: number }>;
};

const PRICE_ENV_HINT: Record<
  DealTier["id"],
  Record<SeatBand, { monthly: string; annual: string }>
> = {
  starter: {
    "5": {
      monthly: "STARTER_5_MONTH_PRICING",
      annual: "STARTER_5_YEARLY_PRICING",
    },
    "10": {
      monthly: "STARTER_10_MONTH_PRICING",
      annual: "STARTER_10_YEARLY_PRICING",
    },
    "10plus": {
      monthly: "STARTER_10_PLUS_MONTH_PRICING",
      annual: "STARTER_10_PLUS_YEARLY_PRICING",
    },
  },
  running: {
    "5": {
      monthly: "RUNNING_5_MONTH_PRICING",
      annual: "RUNNING_5_YEARLY_PRICING",
    },
    "10": {
      monthly: "RUNNING_10_MONTH_PRICING",
      annual: "RUNNING_10_YEARLY_PRICING",
    },
    "10plus": {
      monthly: "RUNNING_10_PLUS_MONTH_PRICING",
      annual: "RUNNING_10_PLUS_YEARLY_PRICING",
    },
  },
  growth: {
    "5": {
      monthly: "GROWTH_5_MONTH_PRICING",
      annual: "GROWTH_5_YEARLY_PRICING",
    },
    "10": {
      monthly: "GROWTH_10_MONTH_PRICING",
      annual: "GROWTH_10_YEARLY_PRICING",
    },
    "10plus": {
      monthly: "GROWTH_10_PLUS_MONTH_PRICING",
      annual: "GROWTH_10_PLUS_YEARLY_PRICING",
    },
  },
};

const CUSTOM_PLAN_CONTACT_HREF =
  "mailto:support@syndicationx.com?subject=Custom%20plan%20inquiry%20%E2%80%93%20SyndicationX";

const EXTRA_COMPANY_USER_FEE_DOLLARS = 10;

const DEAL_TIERS: DealTier[] = [
  {
    id: "starter",
    name: "Starter",
    dealSize: "Up to $3M equity",
    companyUsers: 1,
    featured: true,
    enabled: true,
    prices: {
      "5": { monthly: 49, annual: 490 },
      "10": { monthly: 69, annual: 690 },
      "10plus": { monthly: 89, annual: 890 },
    },
  },
  {
    id: "running",
    name: "Running",
    dealSize: "Up to $5M deal",
    companyUsers: 2,
    featured: false,
    enabled: true,
    prices: {
      "5": { monthly: 99, annual: 990 },
      "10": { monthly: 129, annual: 1290 },
      "10plus": { monthly: 149, annual: 1490 },
    },
  },
  {
    id: "growth",
    name: "Growth",
    dealSize: "Up to $10M deal",
    companyUsers: 3,
    featured: false,
    enabled: true,
    prices: {
      "5": { monthly: 149, annual: 1490 },
      "10": { monthly: 169, annual: 1690 },
      "10plus": { monthly: 189, annual: 1890 },
    },
  },
];

const SEAT_OPTIONS: { id: SeatBand; label: string }[] = [
  { id: "5", label: "5 Co-GPs" },
  { id: "10", label: "10 Co-GPs" },
  { id: "10plus", label: "10+ Co-GPs" },
];

const DEFAULT_DATE_FROM = "";
const DEFAULT_DATE_TO = "";

function formatPaymentHistoryDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${m}-${d}-${y}`;
}

function parseIsoDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function invoiceStatusClassName(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === "paid") return "cp_billing_invoice_status cp_billing_invoice_status--paid";
  if (normalized === "open") return "cp_billing_invoice_status cp_billing_invoice_status--open";
  if (normalized === "overdue") {
    return "cp_billing_invoice_status cp_billing_invoice_status--overdue";
  }
  if (normalized === "void") return "cp_billing_invoice_status cp_billing_invoice_status--void";
  return "cp_billing_invoice_status";
}

function billingPlanLabel(planId: string | null | undefined): string {
  const id = String(planId ?? "").trim().toLowerCase();
  if (!id) return "—";
  const tier = DEAL_TIERS.find((t) => t.id === id);
  if (tier) return tier.name;
  return id.charAt(0).toUpperCase() + id.slice(1);
}

/** Paid Stripe plan if present; otherwise the plan that matches this deal’s raise. */
function dealPlanId(
  row: Pick<CompanyDealBillingRow, "planId" | "suggestedPlanId">,
): string | null {
  const paid = String(row.planId ?? "").trim();
  if (paid) return paid;
  const suggested = String(row.suggestedPlanId ?? "").trim();
  return suggested || null;
}

function suggestedPlanIdForDeal(
  row: Pick<CompanyDealBillingRow, "suggestedPlanId"> | undefined,
): DealTier["id"] {
  const raw = String(row?.suggestedPlanId ?? "")
    .trim()
    .toLowerCase();
  if (raw === "starter" || raw === "running" || raw === "growth") return raw;
  return "starter";
}

function billingCycleLabel(cycle: string | null | undefined): string {
  const c = String(cycle ?? "").trim().toLowerCase();
  if (c === "annual" || c === "annually" || c === "yearly") return "Annual";
  if (c === "monthly") return "Monthly";
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : "—";
}

function billingCycleSelectValue(
  cycle: string | null | undefined,
): "monthly" | "annually" | "" {
  const c = String(cycle ?? "").trim().toLowerCase();
  if (c === "annual" || c === "annually" || c === "yearly") return "annually";
  if (c === "monthly") return "monthly";
  return "";
}

function catalogPlanAmountLabel(row: CompanyDealBillingRow): string {
  const id = String(dealPlanId(row) ?? "").trim().toLowerCase();
  const tier = DEAL_TIERS.find((t) => t.id === id);
  if (!tier) return "—";
  const cycle = String(row.billingCycle ?? "").trim().toLowerCase();
  const annual =
    cycle === "annual" || cycle === "annually" || cycle === "yearly";
  const price = annual ? tier.prices["5"].annual : tier.prices["5"].monthly;
  return `$${price}`;
}

function latestInvoiceAmountForDeal(
  invoices: CompanyBillingInvoice[],
  dealId: string,
): string | null {
  const match = invoices
    .filter((inv) => inv.dealId === dealId && Boolean(inv.amount?.trim()))
    .sort((a, b) => String(b.invoiceDate).localeCompare(String(a.invoiceDate)));
  const amount = match[0]?.amount?.trim();
  return amount || null;
}

function dealAmountLabel(
  row: CompanyDealBillingRow,
  invoices: CompanyBillingInvoice[],
): string {
  return (
    latestInvoiceAmountForDeal(invoices, row.id) ?? catalogPlanAmountLabel(row)
  );
}

function dealBillingStatusLabel(row: CompanyDealBillingRow): string {
  const s = String(row.subscriptionStatus ?? "").trim().toLowerCase();
  const failed =
    s === "past_due" || s === "unpaid" || s === "incomplete";
  if (row.billed) {
    return failed ? "Failed for this month" : "Paid for this month";
  }
  if (failed) return "Failed for this month";
  const stage = (row.dealStage ?? "").trim().toLowerCase();
  const notBilled =
    row.archived || stage === "draft" || stage === "liquidated";
  if (notBilled) return "Not billed";
  if (row.nextBillingDate && Date.parse(row.nextBillingDate) > Date.now()) {
    return "Free for this month";
  }
  return "Pending for this month";
}

function dealBillingStatusClassName(row: CompanyDealBillingRow): string {
  const label = dealBillingStatusLabel(row);
  if (label === "Paid for this month") return invoiceStatusClassName("paid");
  if (label === "Failed for this month") return invoiceStatusClassName("overdue");
  if (label === "Pending for this month" || label === "Free for this month") {
    return invoiceStatusClassName("open");
  }
  return invoiceStatusClassName("void");
}

function invoiceMatchesFilters(
  row: InvoiceRow,
  status: string,
  from: string,
  to: string,
): boolean {
  if (status && row.status.toLowerCase() !== status.toLowerCase()) {
    return false;
  }
  const invoiceDate = parseIsoDate(row.invoiceDate);
  const fromDate = parseIsoDate(from);
  const toDate = parseIsoDate(to);
  if (invoiceDate && fromDate && invoiceDate < fromDate) return false;
  if (invoiceDate && toDate && invoiceDate > toDate) return false;
  return true;
}

function formatPaymentMethodLabel(pm: CompanyBillingPaymentMethod): string {
  const type = (pm.type || "").trim().toLowerCase();
  const isBank =
    type === "us_bank_account" || type === "bank_account" || type === "ach";
  const brand = (pm.brand || (isBank ? "Bank account" : pm.type) || "Card").trim();
  const titled = brand.charAt(0).toUpperCase() + brand.slice(1);
  const last4 = pm.last4 ? `···· ${pm.last4}` : pm.stripePaymentMethodId;
  const exp =
    !isBank && pm.expMonth && pm.expYear
      ? ` · Exp ${String(pm.expMonth).padStart(2, "0")}/${pm.expYear}`
      : "";
  return `${titled} ${last4}${exp}`;
}

function BillingPricingPanel({
  billingCycle,
  onBillingCycleChange,
  companyId,
  billingStatus,
  onStatusRefresh,
  initialDealId,
  initialDealName,
  allowPayment = true,
}: {
  billingCycle: "monthly" | "annually";
  onBillingCycleChange: (cycle: "monthly" | "annually") => void;
  companyId: string;
  billingStatus: CompanyBillingStatus | null;
  onStatusRefresh: () => void;
  initialDealId?: string;
  initialDealName?: string;
  allowPayment?: boolean;
}) {
  const navigate = useNavigate();
  const wizardMode =
    allowPayment && Boolean((initialDealId ?? "").trim());
  const [seatBand, setSeatBand] = useState<SeatBand | null>(
    wizardMode ? null : "5",
  );
  const [wizardCycle, setWizardCycle] = useState<"monthly" | "annually" | null>(
    null,
  );
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [payableDeals, setPayableDeals] = useState<CompanyDealBillingRow[]>([]);
  const [selectedDealId, setSelectedDealId] = useState(initialDealId ?? "");
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payModalPlanId, setPayModalPlanId] = useState<DealTier["id"] | null>(
    null,
  );
  const [payModalMethods, setPayModalMethods] = useState<
    CompanyBillingPaymentMethod[]
  >([]);
  const [payModalLoading, setPayModalLoading] = useState(false);
  const [payModalBusy, setPayModalBusy] = useState<"saved" | "stripe" | null>(
    null,
  );
  const [payModalError, setPayModalError] = useState("");
  const [extraCompanyUsers, setExtraCompanyUsers] = useState(0);
  const payOnceRef = useRef(false);

  useEffect(() => {
    if (!companyId) {
      setPayableDeals([]);
      setSelectedDealId("");
      return;
    }
    let cancelled = false;
    void fetchCompanyBillingDeals(companyId).then((result) => {
      if (cancelled || !result.ok) return;
      const preferred = (initialDealId ?? "").trim();
      const preferredLc = preferred.toLowerCase();
      let payable = result.deals.filter(
        (row) => row.billable === true && !row.billed,
      );
      if (preferredLc) {
        const focused = result.deals.find(
          (row) => row.id.trim().toLowerCase() === preferredLc,
        );
        if (
          focused?.billable &&
          !payable.some((row) => row.id === focused.id)
        ) {
          payable = [focused, ...payable];
        }
      }
      setPayableDeals(payable);
      setSelectedDealId((current) => {
        if (preferred) {
          const focused = payable.find(
            (row) => row.id.trim().toLowerCase() === preferredLc,
          );
          return focused?.id ?? preferred;
        }
        if (current && payable.some((row) => row.id === current)) return current;
        return payable[0]?.id ?? "";
      });
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, billingStatus?.billedDealCount, initialDealId]);

  const selectedDeal = payableDeals.find((row) => row.id === selectedDealId);
  const dealDisplayName =
    selectedDeal?.dealName.trim() ||
    (initialDealName ?? "").trim() ||
    (wizardMode ? "this deal" : "");
  const canManageBilling = billingStatus?.canManage === true;
  const cycleSelected = wizardMode ? wizardCycle != null : true;
  const seatsSelected = seatBand != null;
  const membersEnabled = wizardMode
    ? Boolean(selectedDealId) && cycleSelected
    : true;
  const planCardsEnabled = wizardMode
    ? membersEnabled && seatsSelected
    : true;
  const displayCycle: "monthly" | "annually" =
    (wizardMode ? wizardCycle : billingCycle) ?? "monthly";
  const displaySeat: SeatBand = seatBand ?? "5";
  const appropriatePlanId = suggestedPlanIdForDeal(selectedDeal);

  useEffect(() => {
    const due = Math.max(0, Number(selectedDeal?.extraCompanyUsersDue ?? 0) || 0);
    setExtraCompanyUsers(due);
  }, [selectedDeal?.id, selectedDeal?.extraCompanyUsersDue]);

  const activePlanId = billingStatus?.planId?.trim().toLowerCase() ?? "";
  const subStatus =
    billingStatus?.subscriptionStatus?.trim().toLowerCase() ?? "none";
  const isPaid =
    subStatus === "active" ||
    subStatus === "trialing";
  const hasPaymentIssue =
    Boolean(billingStatus?.lastPaymentError) ||
    subStatus === "past_due" ||
    subStatus === "unpaid" ||
    subStatus === "incomplete";

  const planKey = (tierId: string) => tierId;

  const planReady = (tierId: DealTier["id"]): boolean => {
    const row = billingStatus?.plansConfigured.find((p) => p.id === tierId);
    if (!row) return false;
    const seatRow = row.seats?.find((s) => s.seatBand === displaySeat);
    if (seatRow) {
      return displayCycle === "monthly"
        ? seatRow.monthlyReady
        : seatRow.annualReady;
    }
    return displayCycle === "monthly" ? row.monthlyReady : row.annualReady;
  };

  const handleChoosePlan = async (tierId: DealTier["id"]) => {
    setActionError("");
    if (!allowPayment) {
      setActionError(
        "Open pricing from a Capital Raising or Asset Managing deal to pay.",
      );
      return;
    }
    if (!companyId) {
      setActionError("No company workspace selected.");
      return;
    }
    if (!selectedDealId) {
      setActionError(
        "Select a deal to pay monthly SaaS for. Billing starts when the deal is raising capital or asset managing.",
      );
      return;
    }
    if (wizardMode && !wizardCycle) {
      setActionError("Choose monthly or yearly billing first.");
      return;
    }
    if (!seatBand) {
      setActionError("Choose how many Co-GPs you need first.");
      return;
    }
    if (wizardMode && tierId !== appropriatePlanId) {
      setActionError(
        `${billingPlanLabel(appropriatePlanId)} is the plan for this deal.`,
      );
      return;
    }
    if (!billingStatus?.configured) {
      setActionError(
        "Stripe is not configured. Set STRIPE_SECRET_KEY in backend/.env.local.",
      );
      return;
    }
    if (!planReady(tierId)) {
      const envHint =
        displayCycle === "monthly"
          ? PRICE_ENV_HINT[tierId][displaySeat].monthly
          : PRICE_ENV_HINT[tierId][displaySeat].annual;
      const tierName =
        DEAL_TIERS.find((t) => t.id === tierId)?.name ?? tierId;
      setActionError(
        `Stripe Price for ${tierName} / ${displaySeat} seats (${displayCycle}) is not set. Check ${envHint} in backend/.env.local.`,
      );
      return;
    }
    setBusyPlanId(null);
    setPayModalPlanId(tierId);
    setPayModalError("");
    setPayModalBusy(null);
    setPayModalOpen(true);
    setPayModalLoading(true);
    setPayModalMethods([]);
    payOnceRef.current = false;
    void fetchCompanyBillingPaymentMethods(companyId).then((result) => {
      setPayModalLoading(false);
      if (!result.ok) {
        setPayModalMethods([]);
        return;
      }
      setPayModalMethods(result.paymentMethods);
    });
  };

  const closePayModal = () => {
    if (payModalBusy) return;
    setPayModalOpen(false);
    setPayModalPlanId(null);
    setPayModalError("");
  };

  const handlePayInStripe = async () => {
    if (!payModalPlanId || payOnceRef.current) return;
    payOnceRef.current = true;
    setPayModalError("");
    setPayModalBusy("stripe");
    const result = await startCompanyBillingCheckout(
      companyId,
      payModalPlanId,
      displayCycle,
      displaySeat,
      selectedDealId,
      extraCompanyUsers,
    );
    if (!result.ok) {
      payOnceRef.current = false;
      setPayModalBusy(null);
      setPayModalError(result.message);
      return;
    }
    window.location.assign(result.url);
  };

  const handlePayWithSavedMethod = async (paymentMethodId: string) => {
    if (!payModalPlanId || payOnceRef.current) return;
    payOnceRef.current = true;
    setPayModalError("");
    setPayModalBusy("saved");
    const result = await payCompanyBillingWithSavedMethod(
      companyId,
      payModalPlanId,
      displayCycle,
      displaySeat,
      selectedDealId,
      paymentMethodId,
      extraCompanyUsers,
    );
    if (!result.ok) {
      payOnceRef.current = false;
      setPayModalBusy(null);
      setPayModalError(result.message);
      return;
    }
    const paidDealId = result.paidDealId || selectedDealId;
    if (paidDealId) {
      navigate(`/deals/${encodeURIComponent(paidDealId)}`, { replace: true });
      return;
    }
    setPayModalBusy(null);
    setPayModalOpen(false);
    onStatusRefresh();
  };

  const handleManageBilling = async () => {
    setActionError("");
    if (!companyId) {
      setActionError("No company workspace selected.");
      return;
    }
    setPortalBusy(true);
    const result = await openCompanyBillingPortal(companyId);
    setPortalBusy(false);
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    window.location.assign(result.url);
  };

  return (
    <>
      <div className="cp_billing_header">
        <h3 className="cp_settings_billing_tab_title">Billing</h3>
        <p className="cp_billing_subtitle">
          {allowPayment
            ? "Pay when the deal is raising capital or asset managing — Draft and Archived are free. Monthly or yearly by card or ACH. Extra company users beyond the plan count are $10 each; contact us for $11M+ deals or 25+ company users."
            : "Review plans here, then open a Capital Raising or Asset Managing deal to pay. Draft and Archived are free. Monthly or yearly by card or ACH. Extra company users beyond the plan count are $10 each; contact us for $11M+ deals or 25+ company users."}
        </p>
      </div>

      {billingStatus ? (
        <div
          className="cp_billing_outstanding_banner"
          role="status"
          aria-live="polite"
          style={{
            marginBottom: "1rem",
            display: "flex",
            gap: "0.75rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span className="cp_billing_outstanding_icon" aria-hidden="true">
            <Check size={14} strokeWidth={2.5} />
          </span>
          <p style={{ margin: 0, flex: 1 }}>
            {hasPaymentIssue ? (
              <>
                Payment issue
                {billingStatus.subscriptionStatus
                  ? ` (${billingStatus.subscriptionStatus})`
                  : ""}
                {": "}
                {billingStatus.lastPaymentError ||
                  "Update your payment method via Manage billing."}
                {billingStatus.lastPaymentFailedAt
                  ? ` · Failed ${new Date(billingStatus.lastPaymentFailedAt).toLocaleString()}`
                  : ""}
              </>
            ) : isPaid ? (
              <>
                Current plan: <strong>{activePlanId || "Paid"}</strong>
                {billingStatus.billingCycle
                  ? ` (${billingStatus.billingCycle})`
                  : ""}
                {" · "}
                Status: {billingStatus.subscriptionStatus}
                {billingStatus.currentPeriodEnd
                  ? ` · Renews ${new Date(billingStatus.currentPeriodEnd).toLocaleDateString()}`
                  : ""}
              </>
            ) : (
              <>
                No active subscription
                {billingStatus.configured
                  ? billingStatus.testMode
                    ? " (Stripe test mode)."
                    : "."
                  : " — Stripe is not configured yet."}
                {billingStatus.configured && !billingStatus.webhookConfigured
                  ? " Set STRIPE_WEBHOOK_SECRET (from stripe listen)."
                  : ""}
              </>
            )}
          </p>
          {isPaid || billingStatus.hasCustomer || hasPaymentIssue ? (
            canManageBilling ? (
            <button
              type="button"
              className="um_btn_secondary"
              style={{ flexShrink: 0 }}
              disabled={portalBusy}
              onClick={() => void handleManageBilling()}
            >
              <ExternalLink size={14} aria-hidden />
              {portalBusy ? "Opening…" : "Manage billing"}
            </button>
            ) : null
          ) : null}
        </div>
      ) : null}

      {actionError ? (
        <p
          className="cp_billing_subtitle"
          role="alert"
          style={{ color: "#b91c1c" }}
        >
          {actionError}
        </p>
      ) : null}

      <div className="cp_billing_filters">
        {wizardMode ? (
          <div className="cp_billing_filter_row">
            <span
              className="cp_billing_filter_heading"
              id="cp-billing-deal-label"
            >
              For this deal
            </span>
            <p className="cp_billing_deal_name" id="cp-billing-deal-name">
              {dealDisplayName || "this deal"}
            </p>
          </div>
        ) : null}

        <div className="cp_billing_filter_row">
          <span className="cp_billing_filter_heading" id="cp-billing-cycle-label">
            Billing cycle
          </span>
          <div
            className="cp_billing_cycle"
            role="radiogroup"
            aria-labelledby="cp-billing-cycle-label"
          >
            <label
              className={`cp_billing_cycle_option ${
                (wizardMode ? wizardCycle : billingCycle) === "monthly"
                  ? "cp_billing_cycle_option_active"
                  : ""
              }`}
            >
              <input
                type="radio"
                name="cp_billing_cycle"
                value="monthly"
                checked={
                  wizardMode
                    ? wizardCycle === "monthly"
                    : billingCycle === "monthly"
                }
                onChange={() => {
                  if (wizardMode) setWizardCycle("monthly");
                  onBillingCycleChange("monthly");
                }}
              />
              <span>Monthly</span>
            </label>
            <label
              className={`cp_billing_cycle_option ${
                (wizardMode ? wizardCycle : billingCycle) === "annually"
                  ? "cp_billing_cycle_option_active"
                  : ""
              }`}
            >
              <input
                type="radio"
                name="cp_billing_cycle"
                value="annually"
                checked={
                  wizardMode
                    ? wizardCycle === "annually"
                    : billingCycle === "annually"
                }
                onChange={() => {
                  if (wizardMode) setWizardCycle("annually");
                  onBillingCycleChange("annually");
                }}
              />
              <span>
                Yearly{" "}
                <span className="cp_billing_cycle_save">2 months free</span>
              </span>
            </label>
          </div>
          {wizardMode && !cycleSelected ? (
            <p className="cp_billing_filter_hint" style={{ margin: 0 }}>
              Choose monthly or yearly to continue.
            </p>
          ) : null}
        </div>

        <div
          className={`cp_billing_filter_row${
            membersEnabled ? "" : " cp_billing_filter_row_disabled"
          }`}
        >
          <span className="cp_billing_filter_heading" id="cp-billing-seats-label">
            Co-GPs
          </span>
          <div
            className="cp_billing_cycle"
            role="radiogroup"
            aria-labelledby="cp-billing-seats-label"
            aria-disabled={!membersEnabled}
          >
            {SEAT_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className={`cp_billing_cycle_option ${
                  seatBand === opt.id ? "cp_billing_cycle_option_active" : ""
                }`}
              >
                <input
                  type="radio"
                  name="cp_billing_seats"
                  value={opt.id}
                  checked={seatBand === opt.id}
                  disabled={!membersEnabled}
                  onChange={() => setSeatBand(opt.id)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
          {!membersEnabled ? (
            <p className="cp_billing_filter_hint" style={{ margin: 0 }}>
              Choose a billing cycle first to pick Co-GPs.
            </p>
          ) : !seatsSelected ? (
            <p className="cp_billing_filter_hint" style={{ margin: 0 }}>
              Choose how many Co-GPs you need to unlock the plan.
            </p>
          ) : null}
        </div>

        <div
          className={`cp_billing_filter_row${
            membersEnabled ? "" : " cp_billing_filter_row_disabled"
          }`}
        >
          <span
            className="cp_billing_filter_heading"
            id="cp-billing-extra-users-label"
          >
            Extra company users
          </span>
          <div
            className="cp_billing_extra_users"
            role="group"
            aria-labelledby="cp-billing-extra-users-label"
          >
            <button
              type="button"
              className="cp_billing_extra_users_btn"
              disabled={!membersEnabled || extraCompanyUsers <= 0}
              aria-label="Remove extra company user"
              onClick={() =>
                setExtraCompanyUsers((n) => Math.max(0, n - 1))
              }
            >
              <Minus size={16} aria-hidden="true" />
            </button>
            <span className="cp_billing_extra_users_count">{extraCompanyUsers}</span>
            <button
              type="button"
              className="cp_billing_extra_users_btn"
              disabled={!membersEnabled || extraCompanyUsers >= 23}
              aria-label="Add extra company user"
              onClick={() =>
                setExtraCompanyUsers((n) => Math.min(23, n + 1))
              }
            >
              <Plus size={16} aria-hidden="true" />
            </button>
            <span className="cp_billing_extra_users_fee">
              ${EXTRA_COMPANY_USER_FEE_DOLLARS} each
              {extraCompanyUsers > 0
                ? ` · +$${extraCompanyUsers * EXTRA_COMPANY_USER_FEE_DOLLARS}`
                : ""}
            </span>
          </div>
          <p className="cp_billing_filter_hint" style={{ margin: 0 }}>
            Plans include 1–3 company users. Each extra user on this deal is a
            one-time ${EXTRA_COMPANY_USER_FEE_DOLLARS} payment.
          </p>
        </div>
      </div>

      <div className="cp_billing_plans">
        {DEAL_TIERS.map((tier) => {
          const priceRow = tier.prices[displaySeat];
          const price =
            displayCycle === "monthly" ? priceRow.monthly : priceRow.annual;
          const priceSuffix = displayCycle === "monthly" ? "/mo" : "/yr";
          const id = planKey(tier.id);
          const isAppropriate = appropriatePlanId === tier.id;
          const isCurrent =
            Boolean(selectedDeal?.billed) &&
            (selectedDeal?.planId?.trim().toLowerCase() === id ||
              (selectedDeal?.planId ?? "").toLowerCase().startsWith(`${id}_`));
          const ctaBusy = busyPlanId === id;
          const otherPlanLocked =
            wizardMode && planCardsEnabled && !isAppropriate;
          const cardLocked =
            !tier.enabled ||
            (wizardMode && (!planCardsEnabled || otherPlanLocked));
          const payDisabled =
            !allowPayment || cardLocked || ctaBusy || isCurrent;
          const highlightForDeal =
            wizardMode &&
            isAppropriate &&
            (Boolean(selectedDeal) || Boolean(selectedDealId));
          return (
            <div
              key={tier.id}
              className={`cp_billing_plan_card${
                highlightForDeal || (!wizardMode && tier.featured)
                  ? " cp_billing_plan_card_featured"
                  : ""
              }${cardLocked ? " cp_billing_plan_card_locked" : ""}`}
              aria-disabled={cardLocked || undefined}
            >
              {tier.featured ? (
                <span className="cp_billing_plan_badge">Most popular</span>
              ) : (
                <span className="cp_billing_plan_badge">Available now</span>
              )}
              <h4 className="cp_billing_plan_name">{tier.name}</h4>
              <p className="cp_billing_plan_tagline">{tier.dealSize}</p>
              <div className="cp_billing_plan_price">
                <div className="cp_billing_plan_price_main">
                  <span className="cp_billing_plan_price_amount">${price}</span>
                  <span className="cp_billing_plan_price_suffix">
                    {priceSuffix}
                  </span>
                </div>
                {displayCycle === "annually" && seatsSelected ? (
                  <p className="cp_billing_plan_price_perk">2 months free</p>
                ) : null}
                <p className="cp_billing_plan_price_calc">
                  {seatsSelected
                    ? `${SEAT_OPTIONS.find((s) => s.id === displaySeat)?.label} · ACH or credit card`
                    : "Choose Co-GPs to see this price"}
                  {displayCycle === "annually" && seatsSelected
                    ? " · billed yearly"
                    : ""}
                  {extraCompanyUsers > 0
                    ? ` · +$${extraCompanyUsers * EXTRA_COMPANY_USER_FEE_DOLLARS} extra users`
                    : ""}
                </p>
              </div>
              <div className="cp_billing_plan_body">
                <ul className="cp_billing_plan_features">
                  <li>
                    <Check size={16} aria-hidden="true" />
                    <span>{tier.dealSize}</span>
                  </li>
                  <li>
                    <Check size={16} aria-hidden="true" />
                    <span>
                      {tier.companyUsers} company user
                      {tier.companyUsers === 1 ? "" : "s"}
                      {"; extra users $"}
                      {EXTRA_COMPANY_USER_FEE_DOLLARS} each
                    </span>
                  </li>
                  <li>
                    <Check size={16} aria-hidden="true" />
                    <span>
                      Recurring monthly or annual payments; ACH or credit card
                    </span>
                  </li>
                </ul>
              </div>
              {allowPayment ? (
              <span
                className={
                  payDisabled ? "cp_billing_plan_cta_disabled_wrap" : undefined
                }
              >
                <button
                  type="button"
                  className={`cp_billing_plan_cta ${
                    allowPayment && tier.enabled && !cardLocked
                      ? "cp_billing_plan_cta_pay"
                      : "cp_billing_plan_cta_secondary"
                  }`}
                  disabled={payDisabled}
                  title={
                    !tier.enabled
                      ? `${tier.name} checkout is not available yet`
                      : wizardMode && !planCardsEnabled
                        ? "Choose billing cycle and Co-GPs first"
                        : otherPlanLocked
                          ? `${billingPlanLabel(appropriatePlanId)} is the plan for this deal`
                          : undefined
                  }
                  onClick={() => {
                    if (cardLocked) return;
                    if (isCurrent) {
                      onStatusRefresh();
                      return;
                    }
                    void handleChoosePlan(tier.id);
                  }}
                >
                  {!tier.enabled
                    ? "Coming soon"
                    : isCurrent
                      ? "Current plan"
                      : ctaBusy
                        ? "Redirecting…"
                        : wizardMode && !planCardsEnabled
                          ? "Choose cycle and Co-GPs first"
                          : otherPlanLocked
                            ? "Not for this deal"
                            : "Proceed to pay"}
                </button>
              </span>
              ) : null}
            </div>
          );
        })}

        <div
          className={`cp_billing_plan_card${
            wizardMode && !planCardsEnabled ? " cp_billing_plan_card_locked" : ""
          }`}
        >
          <span className="cp_billing_plan_badge">Available now</span>
          <h4 className="cp_billing_plan_name">Custom</h4>
          <p className="cp_billing_plan_tagline">
            $11M+ deals or 25+ company users
          </p>
          <div className="cp_billing_plan_price">
            <span className="cp_billing_plan_price_custom">Let&apos;s talk</span>
          </div>
          <div className="cp_billing_plan_body">
            <ul className="cp_billing_plan_features">
              <li>
                <Check size={16} aria-hidden="true" />
                <span>Contact for pricing</span>
              </li>
              <li>
                <Check size={16} aria-hidden="true" />
                <span>Recurring monthly or annual payments; ACH or credit card</span>
              </li>
            </ul>
          </div>
          <a
            className="cp_billing_plan_cta um_btn_primary"
            href={CUSTOM_PLAN_CONTACT_HREF}
          >
            Contact sales
          </a>
        </div>
      </div>

      <BillingPayMethodModal
        open={payModalOpen}
        dealName={dealDisplayName}
        methods={payModalMethods}
        loading={payModalLoading}
        busy={payModalBusy}
        error={payModalError}
        onClose={closePayModal}
        onPaySaved={(paymentMethodId) => {
          void handlePayWithSavedMethod(paymentMethodId);
        }}
        onPayStripe={() => {
          void handlePayInStripe();
        }}
      />
    </>
  );
}

function BillingPaymentMethodsPanel({
  companyId,
  billingStatus,
  paymentMethods,
  onStatusRefresh,
}: {
  companyId: string;
  billingStatus: CompanyBillingStatus | null;
  paymentMethods: CompanyBillingPaymentMethod[];
  onStatusRefresh: () => void;
}) {
  const [setupBusy, setSetupBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [setupSession, setSetupSession] =
    useState<BillingSetupIntentSession | null>(null);

  const handleAddPaymentMethod = async () => {
    setActionError("");
    if (!companyId) {
      setActionError("No company workspace selected.");
      return;
    }
    setSetupBusy(true);
    const result = await startCompanyBillingSetupIntent(companyId);
    setSetupBusy(false);
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    setSetupSession(result.session);
  };

  return (
    <div className="cp_billing_payment_methods">
      <div className="cp_billing_payment_methods_head">
        <div>
          <h3 className="cp_billing_payment_methods_title">Payment methods</h3>
          <p className="cp_billing_payment_methods_lead">
            Add and manage the cards or US bank accounts used for your
            subscription.
          </p>
        </div>
        <div className="cp_billing_payment_methods_actions">
          {billingStatus?.configured &&
          companyId &&
          paymentMethods.length > 0 ? (
            <button
              type="button"
              className="um_btn_primary"
              disabled={setupBusy}
              onClick={() => void handleAddPaymentMethod()}
            >
              <Plus size={16} aria-hidden />
              {setupBusy ? "Loading…" : "Add payment method"}
            </button>
          ) : null}
        </div>
      </div>

      {actionError ? (
        <p className="cp_billing_payment_methods_error" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="cp_billing_payment_methods_panel">
        {paymentMethods.length > 0 ? (
          <ul className="cp_billing_payment_methods_list">
            {paymentMethods.map((pm) => (
              <li key={pm.id} className="cp_billing_payment_method_row">
                <span
                  className="cp_billing_payment_method_icon"
                  aria-hidden="true"
                >
                  <CreditCard size={20} />
                </span>
                <span className="cp_billing_payment_method_details">
                  <strong>{formatPaymentMethodLabel(pm)}</strong>
                  <small>Stored securely with Stripe</small>
                </span>
                {pm.isDefault ? (
                  <span className="cp_billing_invoice_status cp_billing_invoice_status--paid">
                    Default
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="cp_billing_payment_methods_empty">
            <span
              className="cp_billing_payment_methods_empty_icon"
              aria-hidden="true"
            >
              <WalletCards size={26} />
            </span>
            <h4>No payment methods yet</h4>
            <p>Add a card or US bank account for subscription billing.</p>
            {billingStatus?.configured && companyId ? (
              <button
                type="button"
                className="um_btn_primary"
                disabled={setupBusy}
                onClick={() => void handleAddPaymentMethod()}
              >
                <Plus size={16} aria-hidden />
                {setupBusy ? "Loading…" : "Add payment method"}
              </button>
            ) : null}
          </div>
        )}
        <div className="cp_billing_payment_security_note">
          <ShieldCheck size={17} aria-hidden="true" />
          <span>
            Payment details are encrypted and securely processed by Stripe.
          </span>
        </div>
      </div>

      {setupSession ? (
        <BillingPaymentElementModal
          open
          mode="setup"
          companyId={companyId}
          clientSecret={setupSession.clientSecret}
          publishableKeyHint={setupSession.publishableKey}
          title="Add payment method"
          subtitle="Save a card or US bank account for future billing."
          submitLabel="Save payment method"
          onClose={() => setSetupSession(null)}
          onSuccess={() => {
            setSetupSession(null);
            onStatusRefresh();
          }}
        />
      ) : null}
    </div>
  );
}

function DealMrrPaymentHistory({
  deal,
  invoices,
}: {
  deal: CompanyDealBillingRow;
  invoices: CompanyBillingInvoice[];
}) {
  const rows = invoices.map((inv) => ({
    id: inv.id,
    start: inv.periodStart || inv.invoiceDate,
    end: inv.periodEnd || inv.dueDate || inv.invoiceDate,
    plan: billingPlanLabel(inv.planId || dealPlanId(deal)),
    amount: inv.amount,
  }));

  return (
    <div className="cp_billing_deal_mrr_history">
      <p className="cp_billing_deal_mrr_history_title">Previous MRR payments</p>
      {rows.length === 0 ? (
        <p className="cp_billing_deal_mrr_history_empty">
          No previous MRR payments for this deal yet.
        </p>
      ) : (
        <table className="cp_billing_deal_mrr_table">
          <thead>
            <tr>
              <th scope="col">Start date</th>
              <th scope="col">End date</th>
              <th scope="col">Plan</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  {row.start ? formatDealListDateDisplay(row.start) : "—"}
                </td>
                <td>{row.end ? formatDealListDateDisplay(row.end) : "—"}</td>
                <td>{row.plan}</td>
                <td>{row.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function BillingDealDetailsPanel({
  companyId,
  viewerScope,
  canPay,
  onPaid,
}: {
  companyId: string;
  viewerScope: "all_deals" | "lead_sponsor" | undefined;
  canPay: boolean;
  onPaid?: () => void;
}) {
  const [deals, setDeals] = useState<CompanyDealBillingRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [query, setQuery] = useState("");
  const [resolvedScope, setResolvedScope] = useState<
    "all_deals" | "lead_sponsor" | undefined
  >(viewerScope);
  const [payBusyId, setPayBusyId] = useState<string | null>(null);
  const [payError, setPayError] = useState("");
  const [cycleBusyId, setCycleBusyId] = useState<string | null>(null);
  const payOnceRef = useRef(false);
  const [expandedDealId, setExpandedDealId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<CompanyBillingInvoice[]>([]);

  useEffect(() => {
    if (!companyId) {
      setDeals([]);
      setInvoices([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    void Promise.all([
      fetchCompanyBillingDeals(companyId),
      fetchCompanyBillingInvoices(companyId),
    ]).then(([dealResult, invoiceResult]) => {
      if (cancelled) return;
      setLoading(false);
      if (!dealResult.ok) {
        setLoadError(dealResult.message);
        setDeals([]);
        return;
      }
      setDeals(dealResult.deals);
      setResolvedScope(dealResult.viewerScope);
      setInvoices(invoiceResult.ok ? invoiceResult.invoices : []);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const filteredDeals = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return deals;
    return deals.filter((row) => {
      const name = row.dealName.toLowerCase();
      const plan = billingPlanLabel(dealPlanId(row)).toLowerCase();
      const amount = dealAmountLabel(row, invoices).toLowerCase();
      const status = dealBillingStatusLabel(row).toLowerCase();
      const stage = dealStageLabel(row.dealStage).toLowerCase();
      return (
        name.includes(q) ||
        plan.includes(q) ||
        amount.includes(q) ||
        status.includes(q) ||
        stage.includes(q)
      );
    });
  }, [deals, invoices, query]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredDeals.length / pageSize));
    if (page > totalPages) setPage(totalPages);
  }, [filteredDeals.length, pageSize, page]);

  const pagination = useMemo(
    () => ({
      page,
      pageSize,
      totalItems: filteredDeals.length,
      onPageChange: setPage,
      onPageSizeChange: setPageSize,
      ariaLabel: "Detailed billing table pagination",
    }),
    [page, pageSize, filteredDeals.length],
  );

  const billedCount = useMemo(
    () => deals.filter((row) => row.billed).length,
    [deals],
  );

  const handlePayDeal = async (row: CompanyDealBillingRow) => {
    setPayError("");
    if (!companyId) {
      setPayError("No company workspace selected.");
      return;
    }
    if (payOnceRef.current) return;
    const planId = (
      row.suggestedPlanId ||
      row.planId ||
      "starter"
    )
      .trim()
      .toLowerCase();
    const rowCycle = billingCycleSelectValue(row.billingCycle);
    if (!rowCycle) {
      setPayError("Choose monthly or yearly billing first.");
      return;
    }
    payOnceRef.current = true;
    setPayBusyId(row.id);
    const result = await startCompanyBillingCheckout(
      companyId,
      planId,
      rowCycle,
      "5",
      row.id,
    );
    if (!result.ok) {
      payOnceRef.current = false;
      setPayBusyId(null);
      setPayError(result.message);
      return;
    }
    onPaid?.();
    window.location.assign(result.url);
  };

  const handleCycleChange = useCallback(
    async (row: CompanyDealBillingRow, next: "monthly" | "annually") => {
      setPayError("");
      if (!companyId) {
        setPayError("No company workspace selected.");
        toast.error(
          "Could not update payment cycle",
          "No company workspace selected.",
        );
        return;
      }
      if (billingCycleSelectValue(row.billingCycle) === next) return;
      setCycleBusyId(row.id);
      const result = await updateCompanyDealBillingCycle(
        companyId,
        row.id,
        next,
      );
      setCycleBusyId(null);
      if (!result.ok) {
        setPayError(result.message);
        toast.error("Could not update payment cycle", result.message);
        return;
      }
      setDeals((current) =>
        current.map((deal) =>
          deal.id === row.id ? { ...deal, ...result.deal } : deal,
        ),
      );
      const cycleLabel = next === "annually" ? "yearly" : "monthly";
      const dealName = row.dealName.trim() || "this deal";
      toast.success(
        "Payment cycle updated",
        `${dealName} is now billed ${cycleLabel}.`,
      );
    },
    [companyId],
  );

  const columns: DataTableColumn<CompanyDealBillingRow>[] = useMemo(
    () => [
      {
        id: "dealName",
        header: "Deal",
        sortValue: (row) => row.dealName.toLowerCase(),
        thClassName: "deals_col_deal_name",
        tdClassName: "um_td_user deals_col_deal_name cp_billing_invoice_number_td",
        cell: (row) => {
          const open = expandedDealId === row.id;
          return (
            <div className="deals_list_name_cell cp_billing_deal_name_cell">
              <DealAvatarIconRing />
              <div className="deals_list_name_text">
                <button
                  type="button"
                  className={`cp_billing_deal_name_toggle${
                    open ? " cp_billing_deal_name_toggle--open" : ""
                  }`}
                  aria-expanded={open}
                  aria-label={
                    open
                      ? `Hide previous MRR payments for ${row.dealName.trim() || "this deal"}`
                      : `Show previous MRR payments for ${row.dealName.trim() || "this deal"}`
                  }
                  onClick={() =>
                    setExpandedDealId((current) =>
                      current === row.id ? null : row.id,
                    )
                  }
                >
                  <span className="cp_billing_invoice_number">
                    {row.dealName.trim() || "Untitled deal"}
                  </span>
                  <ChevronDown size={16} aria-hidden />
                </button>
              </div>
            </div>
          );
        },
      },
      {
        id: "dealStage",
        header: "Stage",
        sortValue: (row) => dealStageLabel(row.dealStage).toLowerCase(),
        cell: (row) => {
          const label = dealStageLabel(row.dealStage).trim() || "—";
          return (
            <span
              className={dealStageChipCompactClassName(row.dealStage)}
              title={`Stage: ${label}`}
            >
              <span className="deals_list_stage_badge_icon" aria-hidden>
                <CircleDot size={12} strokeWidth={2} />
              </span>
              <span>{label}</span>
            </span>
          );
        },
      },
      {
        id: "plan",
        header: "Plan",
        sortValue: (row) => billingPlanLabel(dealPlanId(row)).toLowerCase(),
        cell: (row) => billingPlanLabel(dealPlanId(row)),
      },
      {
        id: "amount",
        header: "Amount",
        align: "right" as const,
        thClassName: "deals_th_align_right",
        tdClassName: "um_td_numeric cp_billing_amount_td",
        sortValue: (row) => dealAmountLabel(row, invoices).toLowerCase(),
        cell: (row) => dealAmountLabel(row, invoices),
      },
      {
        id: "cycle",
        header: "Payment cycle",
        sortValue: (row) => billingCycleLabel(row.billingCycle).toLowerCase(),
        cell: (row) => {
          const canEditCycle = canPay && row.billable === true;
          if (!canEditCycle) {
            return billingCycleLabel(row.billingCycle);
          }
          const value = billingCycleSelectValue(row.billingCycle);
          const busy = cycleBusyId === row.id;
          return (
            <select
              className="cp_billing_filter_input cp_billing_status_select cp_billing_cycle_select"
              value={value}
              disabled={busy}
              aria-label={`Payment cycle for ${row.dealName.trim() || "this deal"}`}
              onChange={(e) => {
                const next = e.target.value;
                if (next !== "monthly" && next !== "annually") return;
                void handleCycleChange(row, next);
              }}
            >
              {value ? null : (
                <option value="" disabled>
                  Choose
                </option>
              )}
              <option value="monthly">Monthly</option>
              <option value="annually">Yearly</option>
            </select>
          );
        },
      },
      {
        id: "status",
        header: "Payment",
        sortValue: (row) => dealBillingStatusLabel(row).toLowerCase(),
        cell: (row) => (
          <span className={dealBillingStatusClassName(row)}>
            {dealBillingStatusLabel(row)}
          </span>
        ),
      },
      {
        id: "nextBilling",
        header: "Next billing",
        sortValue: (row) => row.nextBillingDate ?? "",
        cell: (row) =>
          row.nextBillingDate
            ? formatDealListDateDisplay(row.nextBillingDate)
            : "—",
      },
      ...(canPay
        ? ([
            {
              id: "pay",
              header: "",
              align: "center" as const,
              thClassName: "deals_th_align_center um_th_actions",
              tdClassName: "um_td_actions",
              cell: (row: CompanyDealBillingRow) => {
                const canPayRow = row.billable === true && !row.billed;
                if (!canPayRow) {
                  return <span className="um_status_muted">—</span>;
                }
                const busy = payBusyId === row.id;
                return (
                  <button
                    type="button"
                    className="um_btn_primary cp_billing_pay_btn"
                    disabled={busy}
                    onClick={() => void handlePayDeal(row)}
                  >
                    {busy ? "Redirecting…" : "Pay"}
                  </button>
                );
              },
            },
          ] satisfies DataTableColumn<CompanyDealBillingRow>[])
        : []),
    ],
    [canPay, companyId, cycleBusyId, expandedDealId, handleCycleChange, onPaid, payBusyId],
  );

  const isLeadSponsorScope =
    (resolvedScope ?? viewerScope) === "lead_sponsor";

  return (
    <div className="cp_billing_payment_history">
      <header className="cp_billing_payment_history_head">
        <h3 className="cp_billing_payment_history_title">Detailed billing</h3>
        <p className="cp_billing_payment_history_lead cp_billing_deal_lead">
          {isLeadSponsorScope
            ? "You pay for deals you lead when they are raising capital or asset managing. Draft and Archived are free."
            : "Lead sponsors pay per deal when it is raising capital or asset managing. Draft and Archived are free."}
        </p>
      </header>

      {loadError ? (
        <p role="alert" style={{ color: "#b91c1c", marginBottom: "0.75rem" }}>
          {loadError}
        </p>
      ) : null}
      {payError ? (
        <p role="alert" style={{ color: "#b91c1c", marginBottom: "0.75rem" }}>
          {payError}
        </p>
      ) : null}

      <div
        className="um_toolbar um_toolbar_export_then_search cp_billing_deal_search_toolbar"
        role="search"
        aria-label="Search deals"
      >
        <div className="um_search_wrap">
          <Search className="um_search_icon" size={18} aria-hidden />
          <input
            id="cp-billing-deal-search"
            type="search"
            className="um_search_input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search deals…"
            aria-label="Search deals"
          />
        </div>
      </div>

      <div
        className="cp_billing_outstanding_banner cp_billing_outstanding_banner--center"
        role="status"
        aria-live="polite"
      >
        <span className="cp_billing_outstanding_icon" aria-hidden="true">
          <Check size={14} strokeWidth={2.5} />
        </span>
        <p>
          {loading
            ? "Loading deal billing…"
            : billedCount === 0
              ? isLeadSponsorScope
                ? "None of your deals have an active SaaS subscription yet."
                : "No deals currently have an active SaaS subscription."
              : `${billedCount} deal${billedCount === 1 ? "" : "s"} currently billed.`}
        </p>
      </div>

      <div className="cp_billing_invoices_table_wrap deal_inv_table_panel">
        <DataTable
          columns={columns}
          rows={filteredDeals}
          getRowKey={(row) => row.id}
          emptyLabel={
            loading ? "Loading deal billing…" : "No deals found for billing."
          }
          isLoading={loading}
          visualVariant="members"
          membersTableClassName="um_table_members deal_inv_table"
          membersShell="default"
          initialSort={{ columnId: "dealName", direction: "asc" }}
          pagination={pagination}
          getRowClassName={(row) =>
            expandedDealId === row.id ? "cp_billing_deal_row_expanded" : ""
          }
          renderExpandedContent={(row) =>
            expandedDealId === row.id ? (
              <DealMrrPaymentHistory
                deal={row}
                invoices={invoices.filter((inv) => inv.dealId === row.id)}
              />
            ) : null
          }
        />
      </div>
    </div>
  );
}

export function BillingPaymentHistoryPanel({ companyId }: { companyId: string }) {
  const [dateFrom, setDateFrom] = useState(DEFAULT_DATE_FROM);
  const [dateTo, setDateTo] = useState(DEFAULT_DATE_TO);
  const [statusFilter, setStatusFilter] = useState("");
  const [appliedFrom, setAppliedFrom] = useState(DEFAULT_DATE_FROM);
  const [appliedTo, setAppliedTo] = useState(DEFAULT_DATE_TO);
  const [appliedStatus, setAppliedStatus] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setInvoices([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    void fetchCompanyBillingInvoices(companyId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        setInvoices([]);
        return;
      }
      setInvoices(result.invoices);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const filteredInvoices = useMemo(
    () =>
      invoices.filter((row) =>
        invoiceMatchesFilters(row, appliedStatus, appliedFrom, appliedTo),
      ),
    [invoices, appliedFrom, appliedTo, appliedStatus],
  );

  useEffect(() => {
    setPage(1);
  }, [appliedFrom, appliedTo, appliedStatus]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
    if (page > totalPages) setPage(totalPages);
  }, [filteredInvoices.length, pageSize, page]);

  const invoicePagination = useMemo(
    () => ({
      page,
      pageSize,
      totalItems: filteredInvoices.length,
      onPageChange: setPage,
      onPageSizeChange: setPageSize,
      ariaLabel: "Payment history table pagination",
    }),
    [page, pageSize, filteredInvoices.length],
  );

  const allSelected =
    filteredInvoices.length > 0 &&
    filteredInvoices.every((row) => selectedIds.has(row.id));

  const outstandingCount = useMemo(
    () =>
      invoices.filter((row) => {
        const s = row.status.toLowerCase();
        return (
          s === "open" ||
          s === "uncollectible" ||
          Boolean(row.paymentFailureMessage)
        );
      }).length,
    [invoices],
  );

  const columns: DataTableColumn<InvoiceRow>[] = useMemo(
    () => [
      {
        id: "select",
        header: (
          <input
            type="checkbox"
            className="um_table_header_select_cb"
            checked={allSelected}
            disabled={filteredInvoices.length === 0}
            onChange={() => {
              if (allSelected) {
                setSelectedIds(new Set());
                return;
              }
              setSelectedIds(new Set(filteredInvoices.map((r) => r.id)));
            }}
            aria-label="Select all invoices"
          />
        ),
        align: "center",
        thClassName: "um_th_checkbox",
        tdClassName: "um_td_checkbox",
        cell: (row) => (
          <input
            type="checkbox"
            className="um_table_row_select_cb"
            checked={selectedIds.has(row.id)}
            onChange={() => {
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(row.id)) next.delete(row.id);
                else next.add(row.id);
                return next;
              });
            }}
            aria-label={`Select invoice ${row.invoiceNumber}`}
          />
        ),
      },
      {
        id: "invoiceNumber",
        header: "Invoice number",
        sortValue: (row) => row.invoiceNumber.toLowerCase(),
        tdClassName: "cp_billing_invoice_number_td",
        cell: (row) => (
          <span className="cp_billing_invoice_number">{row.invoiceNumber}</span>
        ),
      },
      {
        id: "dealName",
        header: "Deal",
        sortValue: (row) => (row.dealName ?? "").toLowerCase(),
        cell: (row) =>
          row.dealName?.trim() ? (
            <span className="cp_billing_invoice_number">{row.dealName}</span>
          ) : (
            <span className="um_status_muted">—</span>
          ),
      },
      {
        id: "invoiceDate",
        header: "Invoice Date",
        sortValue: (row) => row.invoiceDate,
        cell: (row) => formatPaymentHistoryDate(row.invoiceDate),
      },
      {
        id: "dueDate",
        header: "Due Date",
        sortValue: (row) => row.dueDate,
        cell: (row) => formatPaymentHistoryDate(row.dueDate),
      },
      {
        id: "status",
        header: "Status",
        sortValue: (row) => row.status.toLowerCase(),
        cell: (row) => (
          <span className={invoiceStatusClassName(row.status)}>
            {row.status}
            {row.paymentFailureMessage ? (
              <span
                title={row.paymentFailureMessage}
                style={{ display: "block", fontSize: 12, color: "#b91c1c" }}
              >
                Payment failed
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        align: "right",
        thClassName: "deals_th_align_right",
        tdClassName: "um_td_numeric cp_billing_amount_td",
        sortValue: (row) => row.amount,
        cell: (row) => row.amount,
      },
      {
        id: "receipt",
        header: "Receipt",
        align: "center",
        thClassName: "deals_th_align_center um_th_actions",
        tdClassName: "um_td_actions cp_billing_receipt_td",
        cell: (row) => {
          const href = row.invoicePdf || row.hostedInvoiceUrl;
          if (!href) {
            return (
              <button
                type="button"
                className="cp_billing_receipt_btn"
                disabled
                aria-label="Download receipt (unavailable)"
                title="Receipt unavailable"
              >
                <Receipt size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            );
          }
          return (
            <a
              className="cp_billing_receipt_btn"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open receipt for ${row.invoiceNumber}`}
              title="Open receipt"
            >
              <Receipt size={16} strokeWidth={2} aria-hidden="true" />
            </a>
          );
        },
      },
    ],
    [allSelected, filteredInvoices, selectedIds],
  );

  const handleSearch = () => {
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
    setAppliedStatus(statusFilter);
    setSelectedIds(new Set());
    setPage(1);
  };

  const handleReset = () => {
    setDateFrom(DEFAULT_DATE_FROM);
    setDateTo(DEFAULT_DATE_TO);
    setStatusFilter("");
    setAppliedFrom(DEFAULT_DATE_FROM);
    setAppliedTo(DEFAULT_DATE_TO);
    setAppliedStatus("");
    setSelectedIds(new Set());
    setPage(1);
  };

  return (
    <div className="cp_billing_payment_history">
      <header className="cp_billing_payment_history_head">
        <h3 className="cp_billing_payment_history_title">Payment history</h3>
        <p className="cp_billing_payment_history_lead">
          Filter invoices by date, status, and deal. Download receipts when
          available.
        </p>
      </header>

      {loadError ? (
        <p role="alert" style={{ color: "#b91c1c", marginBottom: "0.75rem" }}>
          {loadError}
        </p>
      ) : null}

      <section
        className="cp_billing_payment_filters_panel"
        role="search"
        aria-label="Invoice filters"
      >
        <div className="cp_billing_payment_filters_grid">
          <div className="cp_billing_filter_field cp_billing_filter_field--date">
            <label className="cp_billing_filter_label" htmlFor="cp-billing-date-from">
              <Calendar size={14} strokeWidth={2} aria-hidden />
              Invoice date
            </label>
            <div className="cp_billing_date_range">
              <input
                id="cp-billing-date-from"
                type="date"
                className="cp_billing_filter_input cp_billing_date_input"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="Invoice date from"
              />
              <span className="cp_billing_date_range_sep">to</span>
              <input
                type="date"
                className="cp_billing_filter_input cp_billing_date_input"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="Invoice date to"
              />
            </div>
          </div>

          <div className="cp_billing_filter_field">
            <label className="cp_billing_filter_label" htmlFor="cp-billing-status">
              Status
            </label>
            <select
              id="cp-billing-status"
              className="cp_billing_filter_input cp_billing_status_select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Invoice status"
            >
              <option value="">All statuses</option>
              <option value="paid">Paid</option>
              <option value="open">Open</option>
              <option value="overdue">Overdue</option>
              <option value="void">Void</option>
            </select>
          </div>
        </div>

        <div className="cp_billing_payment_filters_actions">
          <button
            type="button"
            className="um_btn_secondary cp_billing_reset_btn"
            onClick={handleReset}
          >
            <RotateCcw size={16} strokeWidth={2} aria-hidden />
            Reset filters
          </button>
          <button
            type="button"
            className="um_btn_primary cp_billing_search_btn"
            onClick={handleSearch}
          >
            <Search size={16} strokeWidth={2} aria-hidden />
            Search
          </button>
        </div>
      </section>

      <div
        className="cp_billing_outstanding_banner"
        role="status"
        aria-live="polite"
      >
        <span className="cp_billing_outstanding_icon" aria-hidden="true">
          <Check size={14} strokeWidth={2.5} />
        </span>
        <p>
          {loading
            ? "Loading invoices…"
            : outstandingCount === 0
              ? "Your account has no outstanding invoices at this time."
              : `You have ${outstandingCount} outstanding invoice${outstandingCount === 1 ? "" : "s"}.`}
        </p>
      </div>

      <div className="cp_billing_invoices_table_wrap deal_inv_table_panel">
        <DataTable
          columns={columns}
          rows={filteredInvoices}
          getRowKey={(row) => row.id}
          emptyLabel="No invoices found for the selected filters."
          visualVariant="members"
          membersTableClassName="um_table_members deal_inv_table"
          membersShell="default"
          initialSort={{ columnId: "invoiceDate", direction: "desc" }}
          pagination={invoicePagination}
        />
      </div>
    </div>
  );
}

export function CompanyBillingTab({
  workspaceCompanyId,
  focusDealId,
  focusDealName,
}: {
  workspaceCompanyId?: string;
  focusDealId?: string;
  focusDealName?: string;
} = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const likelyManager = isCompanyAdmin() || isPlatformAdmin();
  const billingQuery = new URLSearchParams(location.search).get("billing");
  const fromDealPayFlow =
    billingQuery === "pay" && Boolean((focusDealId ?? "").trim());
  const canCheckout = fromDealPayFlow;
  const [billingSubTab, setBillingSubTab] = useState<BillingSubTab>(() => {
    if (typeof window !== "undefined") {
      const billing = new URLSearchParams(window.location.search).get(
        "billing",
      );
      if (billing === "pay") return "pricing";
    }
    return "deals";
  });
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annually">(
    "monthly",
  );
  const [billingStatus, setBillingStatus] =
    useState<CompanyBillingStatus | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<
    CompanyBillingPaymentMethod[]
  >([]);
  const [statusError, setStatusError] = useState("");
  const companyId = (workspaceCompanyId ?? "").trim();

  const canManageBilling = billingStatus?.canManage ?? likelyManager;
  const canPayBilling = billingStatus?.canPay ?? canManageBilling;

  const refreshPaymentMethods = useCallback(() => {
    if (!companyId) {
      setPaymentMethods([]);
      return;
    }
    void fetchCompanyBillingPaymentMethods(companyId).then((result) => {
      if (result.ok) setPaymentMethods(result.paymentMethods);
    });
  }, [companyId]);

  const refreshStatus = useCallback(() => {
    if (!companyId) {
      setBillingStatus(null);
      setPaymentMethods([]);
      return;
    }
    void fetchCompanyBillingStatus(companyId).then((result) => {
      if (!result.ok) {
        setStatusError(result.message);
        setBillingStatus(null);
        return;
      }
      setStatusError("");
      setBillingStatus(result.status);
      if (result.status.canManage === false) {
        setBillingSubTab((current) =>
          current === "payment-methods" ? "deals" : current,
        );
        setPaymentMethods([]);
      } else {
        refreshPaymentMethods();
      }
      if (
        result.status.billingCycle === "annual" ||
        result.status.billingCycle === "annually"
      ) {
        setBillingCycle("annually");
      } else if (result.status.billingCycle === "monthly") {
        setBillingCycle("monthly");
      }
    });
  }, [companyId, refreshPaymentMethods]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!fromDealPayFlow || !companyId || !focusDealId?.trim()) return;
    void releaseCompanyBillingPayment(companyId, focusDealId.trim());
  }, [fromDealPayFlow, companyId, focusDealId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") !== "pay") return;
    if (canPayBilling) {
      setBillingSubTab("pricing");
      return;
    }
    if (billingStatus && !canPayBilling) {
      setBillingSubTab("deals");
    }
  }, [billingStatus, canPayBilling]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billing = params.get("billing");
    if (
      billing === "success" ||
      billing === "portal_return" ||
      billing === "payment_return" ||
      billing === "setup_return"
    ) {
      const sessionId = (params.get("session_id") ?? "").trim();
      const subscriptionId = (params.get("subscription_id") ?? "").trim();
      const paymentIntentId = (
        params.get("payment_intent") ??
        params.get("payment_intent_id") ??
        ""
      ).trim();
      setBillingSubTab(
        billing === "setup_return"
          ? "payment-methods"
          : billing === "success" ||
              billing === "portal_return" ||
              billing === "payment_return"
            ? canCheckout
              ? "pricing"
              : "deals"
            : "deals",
      );

      const finish = () => {
        params.delete("billing");
        params.delete("session_id");
        params.delete("subscription_id");
        params.delete("payment_intent");
        params.delete("payment_intent_client_secret");
        params.delete("setup_intent");
        params.delete("setup_intent_client_secret");
        params.delete("redirect_status");
        const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
        window.history.replaceState({}, "", next);
      };

      if (billing === "success" && companyId && sessionId.startsWith("cs_")) {
        const dealIdFromUrl = normalizeBillingDealId(params.get("dealId"));
        if (dealIdFromUrl) {
          void releaseCompanyBillingPayment(companyId, dealIdFromUrl);
        }
        void syncCompanyBillingCheckout(companyId, sessionId, dealIdFromUrl).then((result) => {
          if (result.ok) {
            setStatusError("");
            setBillingStatus(result.status);
          } else {
            setStatusError(result.message);
            refreshStatus();
          }
          if (result.ok ? result.status.canManage !== false : likelyManager) {
            refreshPaymentMethods();
          }
          const paidDealId =
            (result.ok ? result.paidDealId : null) || dealIdFromUrl;
          if (result.ok && paidDealId) {
            navigate(`/deals/${encodeURIComponent(paidDealId)}`, {
              replace: true,
            });
            return;
          }
          finish();
        });
        return;
      }

      if (billing === "payment_return" && companyId) {
        const dealIdFromUrl = normalizeBillingDealId(params.get("dealId"));
        void syncCompanyBillingPayment(companyId, {
          subscriptionId: subscriptionId || undefined,
          paymentIntentId: paymentIntentId || undefined,
        }).then((result) => {
          if (result.ok) {
            setStatusError("");
            setBillingStatus(result.status);
          } else {
            setStatusError(result.message);
            refreshStatus();
          }
          if (result.ok ? result.status.canManage !== false : likelyManager) {
            refreshPaymentMethods();
          }
          if (result.ok && dealIdFromUrl) {
            navigate(`/deals/${encodeURIComponent(dealIdFromUrl)}`, {
              replace: true,
            });
            return;
          }
          finish();
        });
        return;
      }

      if (
        (billing === "portal_return" || billing === "setup_return") &&
        companyId
      ) {
        void syncCompanyBillingPaymentMethods(companyId).then((result) => {
          if (result.ok) {
            setPaymentMethods(result.paymentMethods);
          } else {
            refreshPaymentMethods();
          }
          refreshStatus();
          finish();
        });
        return;
      }

      refreshStatus();
      finish();
    } else if (billing === "cancel") {
      const dealIdFromUrl = normalizeBillingDealId(params.get("dealId"));
      if (companyId && dealIdFromUrl) {
        void releaseCompanyBillingPayment(companyId, dealIdFromUrl);
      }
      params.set("billing", "pay");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
      navigate(next, { replace: true });
    }
  }, [companyId, likelyManager, navigate, refreshPaymentMethods, refreshStatus]);

  return (
    <div className="cp_settings_billing_tab">
      {!companyId ? (
        <p className="cp_billing_subtitle" role="status">
          Select a company workspace to manage billing.
        </p>
      ) : null}
      {statusError ? (
        <p
          className="cp_billing_subtitle"
          role="alert"
          style={{ color: "#b91c1c" }}
        >
          {statusError}
        </p>
      ) : null}

      <div className="um_members_tabs_outer deals_tabs_outer um_segmented_tabs_outer cp_billing_subtabs_outer">
        <TabsScrollStrip scrollClassName="deals_tabs_scroll um_segmented_tabs_scroll">
          <div
            className="um_members_tabs_row deals_tabs_row um_segmented_tabs_row"
            role="tablist"
            aria-label="Billing sections"
          >
            {canPayBilling ? (
              <button
                type="button"
                id="cp-billing-subtab-pricing"
                role="tab"
                aria-selected={billingSubTab === "pricing"}
                aria-controls="cp-billing-panel-pricing"
                className={`um_members_tab deals_tabs_tab um_segmented_tab${
                  billingSubTab === "pricing" ? " um_members_tab_active" : ""
                }`}
                onClick={() => {
                  if (billingSubTab !== "pricing") {
                    const params = new URLSearchParams(location.search);
                    if (
                      params.get("billing") === "pay" ||
                      params.get("dealId") ||
                      params.get("dealName")
                    ) {
                      params.delete("billing");
                      params.delete("dealId");
                      params.delete("dealName");
                      const search = params.toString();
                      navigate(
                        `${location.pathname}${search ? `?${search}` : ""}${location.hash}`,
                        { replace: true },
                      );
                    }
                  }
                  setBillingSubTab("pricing");
                }}
              >
                <BadgeDollarSign
                  className="deals_tabs_icon um_segmented_tab_icon"
                  size={16}
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="deals_tabs_label um_segmented_tab_label">
                  Pricing
                </span>
              </button>
            ) : null}
            <button
              type="button"
              id="cp-billing-subtab-deals"
              role="tab"
              aria-selected={billingSubTab === "deals"}
              aria-controls="cp-billing-panel-deals"
              className={`um_members_tab deals_tabs_tab um_segmented_tab${
                billingSubTab === "deals" ? " um_members_tab_active" : ""
              }`}
              onClick={() => setBillingSubTab("deals")}
            >
              <Briefcase
                className="deals_tabs_icon um_segmented_tab_icon"
                size={16}
                strokeWidth={2}
                aria-hidden
              />
              <span className="deals_tabs_label um_segmented_tab_label">
                Detailed billing
              </span>
            </button>
            {canManageBilling ? (
              <button
                type="button"
                id="cp-billing-subtab-payment-methods"
                role="tab"
                aria-selected={billingSubTab === "payment-methods"}
                aria-controls="cp-billing-panel-payment-methods"
                className={`um_members_tab deals_tabs_tab um_segmented_tab${
                  billingSubTab === "payment-methods"
                    ? " um_members_tab_active"
                    : ""
                }`}
                onClick={() => setBillingSubTab("payment-methods")}
              >
                <WalletCards
                  className="deals_tabs_icon um_segmented_tab_icon"
                  size={16}
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="deals_tabs_label um_segmented_tab_label">
                  Payment Methods
                </span>
              </button>
            ) : null}
            {/*
            <button
              type="button"
              id="cp-billing-subtab-payment-history"
              role="tab"
              aria-selected={billingSubTab === "payment-history"}
              aria-controls="cp-billing-panel-payment-history"
              className={`um_members_tab deals_tabs_tab um_segmented_tab${
                billingSubTab === "payment-history"
                  ? " um_members_tab_active"
                  : ""
              }`}
              onClick={() => setBillingSubTab("payment-history")}
            >
              <Receipt
                className="deals_tabs_icon um_segmented_tab_icon"
                size={16}
                strokeWidth={2}
                aria-hidden
              />
              <span className="deals_tabs_label um_segmented_tab_label">
                Payment History
              </span>
            </button>
            */}
          </div>
        </TabsScrollStrip>
      </div>

      {canPayBilling ? (
        <div
          id="cp-billing-panel-pricing"
          role="tabpanel"
          aria-labelledby="cp-billing-subtab-pricing"
          hidden={billingSubTab !== "pricing"}
          className="cp_billing_subtab_panel cp_billing_subtab_panel_pricing"
        >
          {billingSubTab === "pricing" ? (
            <BillingPricingPanel
              key={fromDealPayFlow ? `deal-${focusDealId}` : "browse"}
              billingCycle={billingCycle}
              onBillingCycleChange={setBillingCycle}
              companyId={companyId}
              billingStatus={billingStatus}
              onStatusRefresh={refreshStatus}
              initialDealId={fromDealPayFlow ? focusDealId : undefined}
              initialDealName={fromDealPayFlow ? focusDealName : undefined}
              allowPayment={canCheckout}
            />
          ) : null}
        </div>
      ) : null}

      <div
        id="cp-billing-panel-deals"
        role="tabpanel"
        aria-labelledby="cp-billing-subtab-deals"
        hidden={billingSubTab !== "deals"}
        className="cp_billing_subtab_panel"
      >
        {billingSubTab === "deals" ? (
          <BillingDealDetailsPanel
            companyId={companyId}
            viewerScope={billingStatus?.viewerScope}
            canPay={canPayBilling}
            onPaid={refreshStatus}
          />
        ) : null}
      </div>

      {canManageBilling ? (
        <div
          id="cp-billing-panel-payment-methods"
          role="tabpanel"
          aria-labelledby="cp-billing-subtab-payment-methods"
          hidden={billingSubTab !== "payment-methods"}
          className="cp_billing_subtab_panel cp_billing_subtab_panel_payment_methods"
        >
          {billingSubTab === "payment-methods" ? (
            <BillingPaymentMethodsPanel
              companyId={companyId}
              billingStatus={billingStatus}
              paymentMethods={paymentMethods}
              onStatusRefresh={refreshStatus}
            />
          ) : null}
        </div>
      ) : null}

      {/*
      <div
        id="cp-billing-panel-payment-history"
        role="tabpanel"
        aria-labelledby="cp-billing-subtab-payment-history"
        hidden={billingSubTab !== "payment-history"}
        className="cp_billing_subtab_panel"
      >
        {billingSubTab === "payment-history" ? (
          <BillingPaymentHistoryPanel companyId={companyId} />
        ) : null}
      </div>
      */}
    </div>
  );
}
