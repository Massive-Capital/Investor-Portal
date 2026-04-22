import { pool } from "../database/db.js";
import { formatDealMemberRoleForDisplay } from "./dealParticipantProfile.service.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface UserMembershipPair {
  company: string;
  role: string;
}

function pairKey(a: UserMembershipPair): string {
  return `${a.company.trim().toLowerCase()}|${a.role.trim().toLowerCase()}`;
}

/** Aligns with frontend `memberRoleDisplayName` for portal `users.role`. */
function displayPortalRole(role: string): string {
  const r = String(role ?? "").trim().toLowerCase();
  if (!r) return "—";
  const byCode: Record<string, string> = {
    platform_admin: "Platform Admin",
    platform_user: "Platform user",
    user: "Platform user",
    company_admin: "Company Admin",
    company_user: "Company Member",
    deal_participant: "Deal Participant",
  };
  if (byCode[r]) return byCode[r];
  const raw = String(role ?? "").trim();
  return (
    raw
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ") || "—"
  );
}

function companyLabelFromRow(row: Record<string, unknown>): string {
  const raw = row.companyName ?? row.company_name;
  const s = String(raw ?? "").trim();
  return s || "—";
}

async function fetchDealCompanyRolePairsForUserIds(
  userIds: string[],
): Promise<Map<string, UserMembershipPair[]>> {
  const map = new Map<string, UserMembershipPair[]>();
  if (userIds.length === 0) return map;

  const res = await pool.query<{
    user_id: string;
    company_name: string | null;
    deal_member_role: string | null;
  }>(
    `SELECT DISTINCT
       lower(u.id::text) AS user_id,
       COALESCE(NULLIF(trim(c.name), ''), '—') AS company_name,
       trim(dm.deal_member_role) AS deal_member_role
     FROM users u
     INNER JOIN deal_member dm ON (
       u.id::text = trim(both from dm.contact_member_id)
       OR EXISTS (
         SELECT 1 FROM contact c2
         WHERE c2.id::text = trim(both from dm.contact_member_id)
           AND lower(trim(c2.email)) = lower(trim(u.email))
       )
     )
     INNER JOIN add_deal_form adf ON adf.id = dm.deal_id
     LEFT JOIN companies c ON c.id = adf.organization_id
     WHERE u.id = ANY($1::uuid[])
       AND trim(dm.deal_member_role) <> ''`,
    [userIds],
  );

  for (const row of res.rows) {
    const uid = String(row.user_id ?? "").trim().toLowerCase();
    const company = String(row.company_name ?? "").trim() || "—";
    const rawRole = String(row.deal_member_role ?? "").trim();
    if (!uid || !rawRole) continue;
    const role = formatDealMemberRoleForDisplay(rawRole);
    if (!role) continue;
    const pair: UserMembershipPair = { company, role };
    const list = map.get(uid) ?? [];
    if (!list.some((x) => pairKey(x) === pairKey(pair))) list.push(pair);
    map.set(uid, list);
  }

  for (const [uid, list] of map) {
    list.sort((a, b) => {
      const c = a.company.localeCompare(b.company, undefined, {
        sensitivity: "base",
      });
      if (c !== 0) return c;
      return a.role.localeCompare(b.role, undefined, { sensitivity: "base" });
    });
    map.set(uid, list);
  }

  return map;
}

/**
 * Adds `memberships: { company, role }[]` to each user row: portal org role plus distinct
 * deal-level roles per company from `deal_member` (when applicable).
 */
export async function enrichUserRowsWithMemberships(
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const ids = [
    ...new Set(
      rows
        .map((r) => String(r.id ?? "").trim().toLowerCase())
        .filter((id) => UUID_RE.test(id)),
    ),
  ];
  const dealPairsByUser =
    ids.length > 0 ? await fetchDealCompanyRolePairsForUserIds(ids) : new Map();

  return rows.map((row) => {
    const id = String(row.id ?? "").trim().toLowerCase();
    const portalCompany = companyLabelFromRow(row);
    const portalRole = displayPortalRole(String(row.role ?? ""));
    const list: UserMembershipPair[] = [];
    const seen = new Set<string>();

    if (portalRole && portalRole !== "—") {
      const p: UserMembershipPair = { company: portalCompany, role: portalRole };
      list.push(p);
      seen.add(pairKey(p));
    }

    for (const p of dealPairsByUser.get(id) ?? []) {
      const k = pairKey(p);
      if (seen.has(k)) continue;
      seen.add(k);
      list.push(p);
    }

    return { ...row, memberships: list };
  });
}
