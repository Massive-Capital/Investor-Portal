import { and, eq } from "drizzle-orm";
import { db } from "../database/db.js";
import {
  companies,
  companyWorkspaceTabSettings,
  users,
} from "../schema/schema.js";
import {
  COMPANY_USER,
  isCompanyAdminRole,
  isPlatformAdminRole,
  PLATFORM_USER,
} from "../constants/roles.js";

const WORKSPACE_COMPANY_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Canonical form for path + DB comparisons (avoids session lowercase vs PG camel mismatch). */
function normalizeWorkspaceCompanyId(raw: string): string | null {
  const s = String(raw ?? "").trim().toLowerCase();
  return WORKSPACE_COMPANY_UUID_RE.test(s) ? s : null;
}

function sameWorkspaceCompany(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeWorkspaceCompanyId(String(a ?? ""));
  const nb = normalizeWorkspaceCompanyId(String(b ?? ""));
  return na != null && nb != null && na === nb;
}

export const WORKSPACE_TAB_KEYS = [
  "settings",
  "email",
  "contact",
  "offerings",
] as const;
export type WorkspaceTabKey = (typeof WORKSPACE_TAB_KEYS)[number];

export function isWorkspaceTabKey(s: string): s is WorkspaceTabKey {
  return (WORKSPACE_TAB_KEYS as readonly string[]).includes(s);
}

export async function userCanAccessCompanyWorkspace(
  userId: string,
  userRole: string | undefined,
  companyId: string,
): Promise<boolean> {
  const cid = normalizeWorkspaceCompanyId(companyId);
  if (!cid) return false;
  const [co] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.id, cid))
    .limit(1);
  if (!co) return false;
  if (isPlatformAdminRole(userRole)) return true;
  const [u] = await db
    .select({ organizationId: users.organizationId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return sameWorkspaceCompany(u?.organizationId ?? null, cid);
}

export async function userCanEditCompanyWorkspace(
  userId: string,
  userRole: string | undefined,
  companyId: string,
): Promise<boolean> {
  const canSee = await userCanAccessCompanyWorkspace(
    userId,
    userRole,
    companyId,
  );
  if (!canSee) return false;
  if (isPlatformAdminRole(userRole)) return true;

  const cid = normalizeWorkspaceCompanyId(companyId);
  if (!cid) return false;

  const [u] = await db
    .select({ organizationId: users.organizationId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!sameWorkspaceCompany(u?.organizationId ?? null, cid)) return false;

  const r = String(userRole ?? "").trim();
  if (isCompanyAdminRole(r)) return true;
  if (r === PLATFORM_USER || r === COMPANY_USER) return true;
  return false;
}

export async function getWorkspaceTabPayload(
  companyId: string,
  tabKey: WorkspaceTabKey,
): Promise<Record<string, unknown>> {
  const cid = normalizeWorkspaceCompanyId(companyId);
  if (!cid) return {};
  const [row] = await db
    .select({ payload: companyWorkspaceTabSettings.payload })
    .from(companyWorkspaceTabSettings)
    .where(
      and(
        eq(companyWorkspaceTabSettings.companyId, cid),
        eq(companyWorkspaceTabSettings.tabKey, tabKey),
      ),
    )
    .limit(1);
  const p = row?.payload;
  if (!p || typeof p !== "object" || Array.isArray(p)) {
    return {};
  }
  return { ...(p as Record<string, unknown>) };
}

export async function upsertWorkspaceTabPayload(
  companyId: string,
  tabKey: WorkspaceTabKey,
  payload: Record<string, unknown>,
): Promise<void> {
  const cid = normalizeWorkspaceCompanyId(companyId);
  if (!cid) return;
  const now = new Date();
  await db
    .insert(companyWorkspaceTabSettings)
    .values({
      companyId: cid,
      tabKey,
      payload,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        companyWorkspaceTabSettings.companyId,
        companyWorkspaceTabSettings.tabKey,
      ],
      set: { payload, updatedAt: now },
    });
}
