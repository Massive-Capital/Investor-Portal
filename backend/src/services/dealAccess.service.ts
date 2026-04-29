import { eq } from "drizzle-orm";
import {
  DEAL_PARTICIPANT,
  isCompanyAdminRole,
  isPlatformAdminRole,
  PLATFORM_USER,
} from "../constants/roles.js";
import { db } from "../database/db.js";
import type { AddDealFormRow } from "../schema/deal.schema/add-deal-form.schema.js";
import { users } from "../schema/schema.js";
import {
  isUserAssignedToDeal,
  listDealIdsAssignedToUser,
} from "./assigningDealUser.service.js";
import { resolveOrganizationIdForUserId } from "./orgResolution.service.js";
import {
  getAddDealFormById,
  isAddDealFormInOrganizationScope,
  listAddDealFormsByIds,
  listAddDealFormsForViewer,
  type DealViewerScope,
} from "./dealForm.service.js";
import {
  listDealIdsWhereViewerIsCoSponsor,
  viewerHasNonCoSponsorDealMemberRole,
} from "./dealMemberScope.service.js";
import { listLpInvestorDealIdsForUserEmail } from "./lpInvestorAccess.service.js";

export type { DealViewerScope } from "./dealForm.service.js";

export async function resolveDealViewerScope(
  userId: string,
  jwtUserRole: string | undefined,
): Promise<DealViewerScope> {
  const [row] = await db
    .select({
      organizationId: users.organizationId,
      role: users.role,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const organizationId = await resolveOrganizationIdForUserId(
    userId,
    row
      ? {
          organizationId: row.organizationId,
          role: row.role,
        }
      : null,
  );
  const dbRole = String(row?.role ?? "").trim();
  const jwtRole = String(jwtUserRole ?? "").trim();
  const role = dbRole || jwtRole;
  const isPlatformAdmin = isPlatformAdminRole(role);
  const assignedParticipationOnly = role === DEAL_PARTICIPANT;
  const seesAllDeals =
    !assignedParticipationOnly &&
    (isPlatformAdmin || (role === PLATFORM_USER && organizationId == null));

  const emailNorm = String(row?.email ?? "").trim().toLowerCase();
  const lpDealIds = await listLpInvestorDealIdsForUserEmail(emailNorm);
  const applyLpEmailScope =
    lpDealIds.length > 0 &&
    !isPlatformAdminRole(role) &&
    !isCompanyAdminRole(role);

  let coSponsorDashboardDealIds: string[] | null = null;
  if (
    !applyLpEmailScope &&
    !assignedParticipationOnly &&
    !isPlatformAdmin &&
    !isCompanyAdminRole(role)
  ) {
    const [coOnlyDealIds, hasOtherRosterRole] = await Promise.all([
      listDealIdsWhereViewerIsCoSponsor(userId),
      viewerHasNonCoSponsorDealMemberRole(userId),
    ]);
    if (coOnlyDealIds.length > 0 && !hasOtherRosterRole) {
      coSponsorDashboardDealIds = coOnlyDealIds;
    }
  }

  return {
    userId,
    organizationId,
    isPlatformAdmin,
    seesAllDeals,
    assignedParticipationOnly,
    lpInvestorEmailScopedDealIds: applyLpEmailScope ? lpDealIds : null,
    coSponsorDashboardDealIds,
  };
}

export async function dealAccessibleToViewerScope(
  deal: AddDealFormRow | undefined | null,
  scope: DealViewerScope,
): Promise<boolean> {
  if (!deal) return false;
  if (scope.lpInvestorEmailScopedDealIds?.length) {
    return scope.lpInvestorEmailScopedDealIds.includes(String(deal.id));
  }
  if (scope.coSponsorDashboardDealIds?.length) {
    return scope.coSponsorDashboardDealIds.includes(String(deal.id));
  }
  if (scope.assignedParticipationOnly) {
    return isUserAssignedToDeal(scope.userId, String(deal.id));
  }
  if (scope.seesAllDeals) return true;
  if (!scope.organizationId) return false;
  return isAddDealFormInOrganizationScope(deal, scope.organizationId);
}

export async function getAddDealFormForViewer(
  dealId: string,
  scope: DealViewerScope,
): Promise<AddDealFormRow | undefined> {
  const row = await getAddDealFormById(dealId);
  if (!(await dealAccessibleToViewerScope(row, scope))) return undefined;
  return row;
}

export async function assertDealIdInViewerScope(
  dealId: string,
  scope: DealViewerScope,
): Promise<boolean> {
  const row = await getAddDealFormById(dealId);
  return dealAccessibleToViewerScope(row, scope);
}

/**
 * Read access: company-scoped deals **or** deals where the user is linked on the
 * roster / investments (`assigning_deal_user`).
 */
export async function assertDealIdReadableOrAssignedParticipant(
  dealId: string,
  scope: DealViewerScope,
): Promise<boolean> {
  const row = await getAddDealFormById(dealId);
  if (!row) return false;
  if (scope.lpInvestorEmailScopedDealIds?.length) {
    return dealAccessibleToViewerScope(row, scope);
  }
  if (scope.coSponsorDashboardDealIds?.length) {
    return dealAccessibleToViewerScope(row, scope);
  }
  if (await dealAccessibleToViewerScope(row, scope)) return true;
  return isUserAssignedToDeal(scope.userId, dealId);
}

/** Same as {@link getAddDealFormForViewer} plus portal users assigned to the deal as investors. */
export async function getAddDealFormForViewerOrAssignedParticipant(
  dealId: string,
  scope: DealViewerScope,
): Promise<AddDealFormRow | undefined> {
  if (scope.lpInvestorEmailScopedDealIds?.length) {
    return getAddDealFormForViewer(dealId, scope);
  }
  if (scope.coSponsorDashboardDealIds?.length) {
    return getAddDealFormForViewer(dealId, scope);
  }
  const row = await getAddDealFormById(dealId);
  if (!row) return undefined;
  if (await dealAccessibleToViewerScope(row, scope)) return row;
  if (await isUserAssignedToDeal(scope.userId, dealId)) return row;
  return undefined;
}

export async function listDealsForViewer(
  scope: DealViewerScope,
): Promise<AddDealFormRow[]> {
  return listAddDealFormsForViewer(scope);
}

/**
 * Deals the viewer’s company syndicates **plus** any deal where they appear as
 * a portal participant (`assigning_deal_user`).
 */
export async function listDealsForViewerIncludingAssignedParticipation(
  scope: DealViewerScope,
): Promise<AddDealFormRow[]> {
  if (scope.lpInvestorEmailScopedDealIds?.length) {
    return listAddDealFormsForViewer(scope);
  }
  if (scope.coSponsorDashboardDealIds?.length) {
    return listAddDealFormsForViewer(scope);
  }
  const orgDeals = await listAddDealFormsForViewer(scope);
  const orgIds = new Set(orgDeals.map((r) => String(r.id)));
  const assignedIds = await listDealIdsAssignedToUser(scope.userId);
  const missing = assignedIds.filter((id) => !orgIds.has(id));
  if (missing.length === 0) return orgDeals;
  const extraRows = await listAddDealFormsByIds(missing);
  const byId = new Map<string, AddDealFormRow>();
  for (const r of orgDeals) byId.set(String(r.id), r);
  for (const r of extraRows) byId.set(String(r.id), r);
  return [...byId.values()].sort((a, b) =>
    String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
  );
}
