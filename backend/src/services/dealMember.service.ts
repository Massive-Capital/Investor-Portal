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
  isLpInvestorRole,
  listDealInvestmentsByDealId,
  mapRowToInvestorApi,
  resolveUserDisplayNamesByIds,
  resolveUsersByContactIds,
} from "./dealInvestment.service.js";

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

function syntheticInvestmentFromDealMember(m: DealMemberRow): DealInvestmentRow {
  return {
    id: m.id,
    dealId: m.dealId,
    offeringId: "",
    contactId: m.contactMemberId,
    contactDisplayName: "",
    profileId: "",
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
 * financial fields from the latest matching `deal_investment` when present.
 */
export async function listDealMembersMappedToInvestorApi(
  dealId: string,
): Promise<ReturnType<typeof mapRowToInvestorApi>[]> {
  const members = await db
    .select()
    .from(dealMember)
    .where(eq(dealMember.dealId, dealId))
    .orderBy(desc(dealMember.updatedAt));

  const investments = await listDealInvestmentsByDealId(dealId);
  const byContact = new Map<string, DealInvestmentRow[]>();
  for (const inv of investments) {
    const k = normalizeContactKey(inv.contactId ?? "");
    if (!k) continue;
    const arr = byContact.get(k) ?? [];
    arr.push(inv);
    byContact.set(k, arr);
  }
  /** Prefer newest LP-role investment for commitment/profile display; else newest any. */
  const latestInv = new Map<string, DealInvestmentRow>();
  for (const [k, arr] of byContact) {
    const sorted = [...arr].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const lpFirst = sorted.filter((r) => isLpInvestorRole(r.investor_role));
    const picked = lpFirst.length > 0 ? lpFirst[0]! : sorted[0];
    if (picked) latestInv.set(k, picked);
  }

  const rowsForMap: DealInvestmentRow[] = [];
  for (const m of members) {
    const k = normalizeContactKey(m.contactMemberId);
    const inv = k ? latestInv.get(k) : undefined;
    rowsForMap.push(inv ?? syntheticInvestmentFromDealMember(m));
  }

  const resolved = await resolveUsersByContactIds(rowsForMap);
  const addedByNames = await resolveUserDisplayNamesByIds(
    members.map((m) => m.addedBy),
  );

  return rowsForMap.map((r, i) => {
    const base = mapRowToInvestorApi(r, resolved);
    const addedByRaw = members[i]?.addedBy;
    const key = addedByRaw ? String(addedByRaw).toLowerCase() : "";
    const addedByDisplayName =
      key && addedByNames.has(key) ? addedByNames.get(key)! : "—";
    return { ...base, addedByDisplayName };
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
