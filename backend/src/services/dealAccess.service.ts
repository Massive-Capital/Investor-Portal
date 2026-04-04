import { eq } from "drizzle-orm";
import {
  isPlatformAdminRole,
  PLATFORM_USER,
} from "../constants/roles.js";
import { db } from "../database/db.js";
import type { AddDealFormRow } from "../schema/deal.schema/add-deal-form.schema.js";
import { users } from "../schema/schema.js";
import {
  getAddDealFormById,
  isAddDealFormInOrganizationScope,
  listAddDealFormsForViewer,
  type DealViewerScope,
} from "./dealForm.service.js";

export type { DealViewerScope } from "./dealForm.service.js";

export async function resolveDealViewerScope(
  userId: string,
  jwtUserRole: string | undefined,
): Promise<DealViewerScope> {
  const [row] = await db
    .select({ organizationId: users.organizationId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const organizationId = row?.organizationId ?? null;
  const role = String(jwtUserRole ?? "").trim();
  const isPlatformAdmin = isPlatformAdminRole(jwtUserRole);
  const seesAllDeals =
    isPlatformAdmin ||
    (role === PLATFORM_USER && organizationId == null);
  return {
    organizationId,
    isPlatformAdmin,
    seesAllDeals,
  };
}

export async function dealAccessibleToViewerScope(
  deal: AddDealFormRow | undefined | null,
  scope: DealViewerScope,
): Promise<boolean> {
  if (!deal) return false;
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

export async function listDealsForViewer(
  scope: DealViewerScope,
): Promise<AddDealFormRow[]> {
  return listAddDealFormsForViewer(scope);
}
