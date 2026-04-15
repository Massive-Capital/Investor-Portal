import { pool } from "../database/db.js";

/**
 * Distinct deal ids where this user appears on `deal_member` as Co-sponsor
 * (portal user id or contact email match).
 */
export async function listDealIdsWhereViewerIsCoSponsor(
  userId: string,
): Promise<string[]> {
  const res = await pool.query<{ deal_id: string }>(
    `SELECT DISTINCT dm.deal_id::text AS deal_id
     FROM deal_member dm
     INNER JOIN users u ON u.id = $1::uuid
     WHERE lower(trim(dm.deal_member_role)) IN ('co-sponsor', 'co sponsor')
       AND (
         trim(dm.contact_member_id) = u.id::text
         OR EXISTS (
           SELECT 1 FROM contact c
           WHERE c.id::text = trim(both from dm.contact_member_id)
             AND lower(trim(c.email)) = lower(trim(u.email))
         )
       )`,
    [userId],
  );
  return [
    ...new Set(
      res.rows
        .map((r) => String(r.deal_id ?? "").trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * True if this user has any `deal_member` row with a non-empty role that is
 * **not** Co-sponsor (e.g. Lead Sponsor, admin sponsor, LP investors).
 * Used to avoid narrowing the syndication dashboard to co-sponsor-only deals
 * when they also hold another roster role somewhere.
 */
export async function viewerHasNonCoSponsorDealMemberRole(
  userId: string,
): Promise<boolean> {
  const res = await pool.query<{ ok: number }>(
    `SELECT 1 AS ok
     FROM deal_member dm
     INNER JOIN users u ON u.id = $1::uuid
     WHERE trim(dm.deal_member_role) <> ''
       AND lower(trim(dm.deal_member_role)) NOT IN ('co-sponsor', 'co sponsor')
       AND (
         trim(dm.contact_member_id) = u.id::text
         OR EXISTS (
           SELECT 1 FROM contact c
           WHERE c.id::text = trim(both from dm.contact_member_id)
             AND lower(trim(c.email)) = lower(trim(u.email))
         )
       )
     LIMIT 1`,
    [userId],
  );
  return res.rows.length > 0;
}

/**
 * True when the viewer appears on any deal as Lead Sponsor or Admin sponsor
 * (portal user id or contact email match). Used so sponsor team sees full-company
 * CRM contacts (including portal/member rows), same as company admin.
 */
export async function viewerIsLeadOrAdminSponsorOnAnyDeal(
  userId: string,
): Promise<boolean> {
  const res = await pool.query<{ ok: number }>(
    `SELECT 1 AS ok
     FROM deal_member dm
     INNER JOIN users u ON u.id = $1::uuid
     WHERE lower(trim(dm.deal_member_role)) IN ('lead sponsor', 'admin sponsor')
       AND (
         trim(dm.contact_member_id) = u.id::text
         OR EXISTS (
           SELECT 1 FROM contact c
           WHERE c.id::text = trim(both from dm.contact_member_id)
             AND lower(trim(c.email)) = lower(trim(u.email))
         )
       )
     LIMIT 1`,
    [userId],
  );
  return res.rows.length > 0;
}
