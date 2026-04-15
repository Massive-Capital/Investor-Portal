/**
 * LP investing-mode nav, session flags, and deal allowlists are **only** from `deal_lp_investor`
 * (email via `contact_member_id` → `contact.email`). `deal_member` / sponsors never grant
 * investing shell — matches “only LP investors on the LP roster table get the investing portal.”
 */
import { and, inArray, sql } from "drizzle-orm";
import { isCompanyAdminRole, isPlatformAdminRole } from "../constants/roles.js";
import { db } from "../database/db.js";
import { dealLpInvestor } from "../schema/deal.schema/deal-lp-investor.schema.js";
import { contact } from "../schema/schema.js";

/** Stored `deal_lp_investor.role` values treated as LP Investor for nav + deal scope. */
export function isLpInvestorRoleInLpTable(role: string | null | undefined): boolean {
  const t = String(role ?? "").trim().toLowerCase();
  if (!t) return false;
  return (
    t === "lp investor" ||
    t === "lp investors" ||
    t === "lp_investors" ||
    t === "lp_investor"
  );
}

/**
 * Distinct `deal_id`s where this email matches the LP investor row's contact (`contact_member_id` → `contact.email`).
 * Rows on `deal_lp_investor` are LP investor entries; email is resolved from `contact`, not a column on `deal_lp_investor`.
 */
/** `deal_id`s where this email appears on `deal_lp_investor` (contact match). */
async function listDealIdsFromLpInvestorTableForEmail(
  emailNorm: string,
): Promise<string[]> {
  const e = String(emailNorm ?? "").trim().toLowerCase();
  if (!e || !e.includes("@")) return [];

  const rows = await db
    .selectDistinct({ dealId: dealLpInvestor.dealId })
    .from(dealLpInvestor)
    .innerJoin(
      contact,
      sql`${contact.id}::text = trim(both from ${dealLpInvestor.contactMemberId})`,
    )
    .where(
      sql`(nullif(trim(${contact.email}), '') IS NOT NULL AND lower(trim(${contact.email})) = ${e})`,
    );

  return [...new Set(rows.map((r) => String(r.dealId ?? "").trim()).filter(Boolean))];
}

/** Distinct deal ids for LP investing portal: `deal_lp_investor` only (no `deal_member`). */
export async function listLpInvestorDealIdsForUserEmail(
  emailNorm: string,
): Promise<string[]> {
  return listDealIdsFromLpInvestorTableForEmail(emailNorm);
}

/**
 * For each deal id, the `deal_lp_investor.role` for this portal user (contact email match).
 * Used by GET /deals list when the viewer is LP email–scoped.
 */
export async function mapLpInvestorRoleDisplayByDealIdForUserEmail(
  emailNorm: string,
  dealIds: string[],
): Promise<Map<string, string>> {
  const e = String(emailNorm ?? "").trim().toLowerCase();
  const ids = [...new Set(dealIds.map((x) => String(x ?? "").trim()).filter(Boolean))];
  if (!e || !e.includes("@") || ids.length === 0) return new Map();

  const rows = await db
    .select({
      dealId: dealLpInvestor.dealId,
      role: dealLpInvestor.role,
    })
    .from(dealLpInvestor)
    .innerJoin(
      contact,
      sql`${contact.id}::text = trim(both from ${dealLpInvestor.contactMemberId})`,
    )
    .where(
      and(
        inArray(dealLpInvestor.dealId, ids),
        sql`(nullif(trim(${contact.email}), '') IS NOT NULL AND lower(trim(${contact.email})) = ${e})`,
      ),
    );

  const map = new Map<string, string>();
  for (const r of rows) {
    const id = String(r.dealId ?? "").trim();
    const role = String(r.role ?? "").trim();
    if (!id || map.has(id)) continue;
    map.set(id, role || "LP Investor");
  }
  return map;
}

/**
 * Session flags for sign-in / account: investing nav + deal id allowlist (see
 * {@link listLpInvestorDealIdsForUserEmail}).
 */
export async function resolveLpInvestorSessionFlags(emailNorm: string): Promise<{
  lp_investor_nav: boolean;
  lp_investor_deal_ids: string[];
  lp_investor_role_display: string | null;
}> {
  const dealIds = await listLpInvestorDealIdsForUserEmail(emailNorm);
  if (dealIds.length === 0) {
    return {
      lp_investor_nav: false,
      lp_investor_deal_ids: [],
      lp_investor_role_display: null,
    };
  }

  const lp_investor_role_display = "LP Investor";

  return {
    lp_investor_nav: true,
    lp_investor_deal_ids: dealIds,
    lp_investor_role_display,
  };
}

/**
 * Single writer for `is_lp_investor`, `lp_investor_nav`, and `lp_investor_deal_ids` on sign-in / account.
 * Platform/company admins keep syndication shell (`lp_investor_nav` false) even if listed as LP.
 */
export async function mergeLpInvestorFlagsIntoUserPayload(
  base: Record<string, unknown>,
  opts: { email: string | null | undefined; portalRole: string | null | undefined },
): Promise<Record<string, unknown>> {
  const emailNorm = String(opts.email ?? "").trim().toLowerCase();
  const portalRole = String(opts.portalRole ?? "").trim();
  const adminShell =
    isPlatformAdminRole(portalRole) || isCompanyAdminRole(portalRole);

  if (!emailNorm || !emailNorm.includes("@")) {
    return {
      ...base,
      lp_investor_nav: false,
      lp_investor_deal_ids: [],
      lp_investor_role_display: null,
      is_lp_investor: false,
    };
  }

  const lp = await resolveLpInvestorSessionFlags(emailNorm);
  const lpNav = lp.lp_investor_nav && !adminShell;
  return {
    ...base,
    lp_investor_nav: lpNav,
    lp_investor_deal_ids: lpNav ? lp.lp_investor_deal_ids : [],
    lp_investor_role_display: lpNav ? lp.lp_investor_role_display : null,
    /** Alias for clients; same as `lp_investor_nav` when LP email scope applies. */
    is_lp_investor: lpNav,
  };
}
