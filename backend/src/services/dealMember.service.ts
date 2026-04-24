import { and, desc, eq } from "drizzle-orm";
import { db } from "../database/db.js";
import {
  dealMember,
  type DealMemberRow,
} from "../schema/deal.schema/deal-member.schema.js";
import {
  dealInvestment,
  type DealInvestmentRow,
} from "../schema/deal.schema/deal-investment.schema.js";
import {
  applyTotalCommittedToDealInvestmentRowForCanonical,
  enrichInvestorRolesForDealRows,
  formatCommittedUsdWhole,
  groupDealInvestmentsByCanonicalKey,
  listDealInvestmentsByDealId,
  mapContactIdsToCanonicalCommitmentKeys,
  mapRowToInvestorApi,
  resolveUserDisplayNamesByIds,
  resolveUsersByContactIds,
  sumCommittedFromInvestorsAddedByMemberContacts,
  totalCommittedByCanonicalKeyFromRows,
} from "./dealInvestment.service.js";
import { isViewerCoSponsorOnDeal } from "./dealLpInvestor.service.js";

export type UpsertDealMemberInput = {
  contactMemberId: string;
  dealMemberRole: string;
  sendInvitationMail: string;
  /** Set on insert only; not overwritten on conflict update. */
  addedByUserId: string;
};

function normalizeContactKey(raw: string): string {
  return String(raw ?? "").trim().toLowerCase();
}

/** Canonical row for labels / ids when a contact has multiple investments (newest wins). */
function pickLatestInvestmentForDealMember(
  arr: DealInvestmentRow[],
): DealInvestmentRow | undefined {
  if (arr.length === 0) return undefined;
  return [...arr].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
}

function syntheticInvestmentFromDealMember(m: DealMemberRow): DealInvestmentRow {
  return {
    id: m.id,
    dealId: m.dealId,
    offeringId: "",
    contactId: m.contactMemberId,
    contactDisplayName: "",
    profileId: "",
    userInvestorProfileId: null,
    investor_role: m.dealMemberRole,
    status: "",
    investorClass: "",
    docSignedDate: null,
    commitmentAmount: "",
    extraContributionAmounts: [],
    documentStoragePath: null,
    createdAt: m.createdAt,
  };
}

/**
 * Upserts `(deal_id, contact_member_id)` when an investment is saved.
 * `added_by` is set on first insert only.
 */
export async function upsertDealMemberForDeal(
  dealId: string,
  input: UpsertDealMemberInput,
): Promise<void> {
  const cid = input.contactMemberId.trim();
  if (!cid) return;

  const send =
    String(input.sendInvitationMail ?? "").toLowerCase() === "yes"
      ? "yes"
      : "no";
  const now = new Date();
  const role = input.dealMemberRole?.trim() ?? "";

  await db
    .insert(dealMember)
    .values({
      dealId,
      addedBy: input.addedByUserId,
      contactMemberId: cid,
      dealMemberRole: role,
      sendInvitationMail: send,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [dealMember.dealId, dealMember.contactMemberId],
      set: {
        dealMemberRole: role,
        sendInvitationMail: send,
        updatedAt: now,
      },
    });
}

/**
 * Lists deal members for the Deal Members tab: one row per `deal_member`, with
 * commitment = **sum** of all `deal_investment` rows for that contact on this deal,
 * and other fields from the **newest** matching investment when present.
 *
 * When `viewerUserId` is a Co-sponsor on this deal, only roster rows they added
 * (`deal_member.added_by`) are returned.
 */
export async function listDealMembersMappedToInvestorApi(
  dealId: string,
  viewerUserId?: string | null,
): Promise<ReturnType<typeof mapRowToInvestorApi>[]> {
  let members = await db
    .select()
    .from(dealMember)
    .where(eq(dealMember.dealId, dealId))
    .orderBy(desc(dealMember.updatedAt));

  const uid = viewerUserId?.trim();
  if (uid && (await isViewerCoSponsorOnDeal(dealId, uid))) {
    const v = uid.toLowerCase();
    members = members.filter(
      (m) => m.addedBy && String(m.addedBy).toLowerCase() === v,
    );
  }

  const investments = await listDealInvestmentsByDealId(dealId);
  const allContactIdsForCanonical = [
    ...members.map((m) => m.contactMemberId),
    ...investments.map((inv) => inv.contactId),
  ];
  const rawToCanonical =
    await mapContactIdsToCanonicalCommitmentKeys(allContactIdsForCanonical);
  const totalByCanonical = totalCommittedByCanonicalKeyFromRows(
    investments,
    rawToCanonical,
  );
  const byCanonical = groupDealInvestmentsByCanonicalKey(
    investments,
    rawToCanonical,
  );

  const rowsForMap: DealInvestmentRow[] = [];
  for (const m of members) {
    const k = normalizeContactKey(m.contactMemberId);
    const canonicalKey = k
      ? rawToCanonical.get(k) ?? `id:${k}`
      : "id:__empty__";
    const arr = byCanonical.get(canonicalKey) ?? [];
    const rosterRole = m.dealMemberRole?.trim() ?? "";
    const picked = pickLatestInvestmentForDealMember(arr);
    if (picked) {
      /** Roster role wins over `deal_investment.investor_role` (e.g. portal `deal_participant`). */
      const merged = applyTotalCommittedToDealInvestmentRowForCanonical(
        {
          ...picked,
          investor_role: rosterRole || picked.investor_role,
        },
        totalByCanonical,
        canonicalKey,
      );
      rowsForMap.push(merged);
    } else {
      rowsForMap.push(
        applyTotalCommittedToDealInvestmentRowForCanonical(
          syntheticInvestmentFromDealMember(m),
          totalByCanonical,
          canonicalKey,
        ),
      );
    }
  }

  const patched = await enrichInvestorRolesForDealRows(dealId, rowsForMap);
  const resolved = await resolveUsersByContactIds(patched);
  const addedByNames = await resolveUserDisplayNamesByIds(
    members.map((m) => m.addedBy),
  );

  const memberContactKeys = new Set<string>();
  for (const m of members) {
    const k = normalizeContactKey(m.contactMemberId);
    if (k) memberContactKeys.add(k);
  }
  const committedFromAddedInvestors =
    await sumCommittedFromInvestorsAddedByMemberContacts(
      dealId,
      memberContactKeys,
    );

  return patched.map((r, i) => {
    const m = members[i];
    const invitationMailSent =
      String(m?.sendInvitationMail ?? "").toLowerCase().trim() === "yes";
    const base = mapRowToInvestorApi(r, resolved, { invitationMailSent });
    const addedByRaw = m?.addedBy;
    const key = addedByRaw ? String(addedByRaw).toLowerCase() : "";
    const addedByDisplayName =
      key && addedByNames.has(key) ? addedByNames.get(key)! : "—";
    const memberCk = normalizeContactKey(m?.contactMemberId ?? "");
    const fromAdded = memberCk
      ? (committedFromAddedInvestors.get(memberCk) ?? 0)
      : 0;
    return {
      ...base,
      addedByDisplayName,
      addedInvestorsCommitted: formatCommittedUsdWhole(fromAdded),
    };
  });
}

/**
 * Removes a member from the deal roster. `rowId` is either `deal_investment.id`
 * (row merged with latest investment) or `deal_member.id` (member-only row).
 * When an investment id is passed, deletes all investments for that contact on
 * this deal, then the `deal_member` row.
 */
export async function deleteDealMemberRosterEntry(
  dealId: string,
  rowId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const invRows = await db
    .select()
    .from(dealInvestment)
    .where(
      and(eq(dealInvestment.id, rowId), eq(dealInvestment.dealId, dealId)),
    )
    .limit(1);

  if (invRows.length > 0) {
    const contactId = invRows[0]!.contactId.trim();
    if (!contactId) {
      await db
        .delete(dealInvestment)
        .where(
          and(eq(dealInvestment.id, rowId), eq(dealInvestment.dealId, dealId)),
        );
      return { ok: true };
    }
    await db
      .delete(dealInvestment)
      .where(
        and(eq(dealInvestment.dealId, dealId), eq(dealInvestment.contactId, contactId)),
      );
    await db
      .delete(dealMember)
      .where(
        and(eq(dealMember.dealId, dealId), eq(dealMember.contactMemberId, contactId)),
      );
    return { ok: true };
  }

  const deleted = await db
    .delete(dealMember)
    .where(and(eq(dealMember.id, rowId), eq(dealMember.dealId, dealId)))
    .returning({ id: dealMember.id });

  if (deleted.length > 0) return { ok: true };
  return { ok: false, message: "Member or investment not found" };
}
