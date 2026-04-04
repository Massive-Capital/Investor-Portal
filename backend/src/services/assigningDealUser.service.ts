import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db, pool } from "../database/db.js";
import { assigningDealUser, contact, users } from "../schema/schema.js";
import { dealInvestment } from "../schema/deal.schema/deal-investment.schema.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Canonical map key for portal user ids (avoids PG lowercase vs JSON uppercase mismatch). */
function normalizeUserUuidKey(raw: string): string | null {
  const id = String(raw ?? "").trim().toLowerCase();
  return UUID_RE.test(id) ? id : null;
}

function contactIdAsUserUuid(raw: string): string | null {
  const t = raw?.trim();
  if (!t || !UUID_RE.test(t)) return null;
  return t;
}

/**
 * Keeps `assigning_deal_user` in sync with distinct UUID `contact_id` values on
 * `deal_investment` for this deal. Only ids that exist in `users` are stored
 * (`contact_id` may be a CRM contact uuid or other non-portal id).
 */
export async function reconcileAssigningDealUsersForDeal(
  dealId: string,
  actorUserId: string,
): Promise<void> {
  const invRows = await db
    .select({ contactId: dealInvestment.contactId })
    .from(dealInvestment)
    .where(eq(dealInvestment.dealId, dealId));

  const uuidCandidates = [
    ...new Set(
      invRows
        .map((r) => contactIdAsUserUuid(r.contactId ?? ""))
        .filter((id): id is string => id != null),
    ),
  ];

  const portalUserIdSet = new Set<string>();
  if (uuidCandidates.length > 0) {
    const directUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, uuidCandidates));
    for (const r of directUsers) portalUserIdSet.add(String(r.id));

    const unresolvedForUserTable = uuidCandidates.filter(
      (id) => !portalUserIdSet.has(id),
    );
    if (unresolvedForUserTable.length > 0) {
      const contactRows = await db
        .select({ id: contact.id, email: contact.email })
        .from(contact)
        .where(inArray(contact.id, unresolvedForUserTable));

      const uniqueNormEmails = [
        ...new Set(
          contactRows
            .map((c) => c.email.trim().toLowerCase())
            .filter((e) => e.length > 0),
        ),
      ];
      const emailToUserId = new Map<string, string>();
      for (const normEmail of uniqueNormEmails) {
        const [u] = await db
          .select({ id: users.id })
          .from(users)
          .where(sql`lower(trim(${users.email})) = ${normEmail}`)
          .limit(1);
        if (u) emailToUserId.set(normEmail, String(u.id));
      }
      for (const c of contactRows) {
        const uid = emailToUserId.get(c.email.trim().toLowerCase());
        if (uid) portalUserIdSet.add(uid);
      }
    }
  }

  const portalUserIds = [...portalUserIdSet];

  if (portalUserIds.length === 0) {
    await db
      .delete(assigningDealUser)
      .where(eq(assigningDealUser.dealId, dealId));
    return;
  }

  await db
    .delete(assigningDealUser)
    .where(
      and(
        eq(assigningDealUser.dealId, dealId),
        notInArray(assigningDealUser.userId, portalUserIds),
      ),
    );

  for (const userId of portalUserIds) {
    await db
      .insert(assigningDealUser)
      .values({
        dealId,
        userId,
        userAddedDeal: actorUserId,
      })
      .onConflictDoNothing({
        target: [assigningDealUser.dealId, assigningDealUser.userId],
      });
  }
}

/**
 * Per-user count of distinct deals in `assigning_deal_user`.
 * When `restrictToOrganizationId` is set, only deals visible to that company (org id or legacy name match).
 */
export async function countAssignedDealsByUserIdsForViewer(params: {
  userIds: string[];
  restrictToOrganizationId: string | null;
}): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const ids: string[] = [];
  for (const raw of params.userIds) {
    const k = normalizeUserUuidKey(raw);
    if (!k) continue;
    if (!map.has(k)) {
      map.set(k, 0);
      ids.push(k);
    }
  }
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return map;

  if (!params.restrictToOrganizationId) {
    const res = await pool.query<{ user_id: string; cnt: string }>(
      `SELECT user_id::text, COUNT(DISTINCT deal_id)::int AS cnt
       FROM assigning_deal_user
       WHERE user_id = ANY($1::uuid[])
       GROUP BY user_id`,
      [uniqueIds],
    );
    for (const r of res.rows) {
      const k = normalizeUserUuidKey(String(r.user_id ?? ""));
      if (k) map.set(k, Number(r.cnt));
    }
    return map;
  }

  const orgId = params.restrictToOrganizationId;
  /**
   * Distinct deals per user for this customer org: `assigning_deal_user` plus
   * `deal_investment` rows on org deals (portal user id or contact→user email),
   * so counts match actual participation even if assigning rows lag reconcile.
   */
  const res = await pool.query<{ user_id: string; cnt: string }>(
    `WITH org_deals AS (
       SELECT af.id AS deal_id
       FROM add_deal_form af
       LEFT JOIN LATERAL (
         SELECT lower(trim(name)) AS cn FROM companies WHERE id = $2::uuid LIMIT 1
       ) co ON true
       WHERE (
         af.organization_id = $2::uuid
         OR (
           af.organization_id IS NULL
           AND co.cn IS NOT NULL
           AND lower(trim(COALESCE(af.owning_entity_name, ''))) = co.cn
         )
       )
     ),
     assigning AS (
       SELECT adu.user_id, adu.deal_id
       FROM assigning_deal_user adu
       INNER JOIN org_deals od ON od.deal_id = adu.deal_id
       WHERE adu.user_id = ANY($1::uuid[])
     ),
     inv_user AS (
       SELECT u.id AS user_id, di.deal_id
       FROM deal_investment di
       INNER JOIN org_deals od ON od.deal_id = di.deal_id
       INNER JOIN users u ON u.id::text = trim(both from di.contact_id)
       WHERE u.id = ANY($1::uuid[])
     ),
     inv_contact AS (
       SELECT u.id AS user_id, di.deal_id
       FROM deal_investment di
       INNER JOIN org_deals od ON od.deal_id = di.deal_id
       INNER JOIN contact c ON c.id::text = trim(both from di.contact_id)
       INNER JOIN users u ON lower(trim(u.email)) = lower(trim(c.email))
       WHERE u.id = ANY($1::uuid[])
     ),
     all_links AS (
       SELECT user_id, deal_id FROM assigning
       UNION ALL
       SELECT user_id, deal_id FROM inv_user
       UNION ALL
       SELECT user_id, deal_id FROM inv_contact
     )
     SELECT user_id::text, COUNT(DISTINCT deal_id)::int AS cnt
     FROM all_links
     GROUP BY user_id`,
    [uniqueIds, orgId],
  );
  for (const r of res.rows) {
    const k = normalizeUserUuidKey(String(r.user_id ?? ""));
    if (k) map.set(k, Number(r.cnt));
  }
  return map;
}
