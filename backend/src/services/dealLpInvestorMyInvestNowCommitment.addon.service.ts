/**
 * copy_code parity: sets `deal_investment.commitment_amount` to the posted amount (not additive),
 * with optional `status` and `doc_signed_date`. Prod's `updateMyCommittedAmountForLpDeal` uses
 * cumulative increment semantics — kept separate to avoid changing existing behavior.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../database/db.js";
import { contact, dealMember, users } from "../schema/schema.js";
import {
  dealLpInvestor,
  type DealLpInvestorRow,
} from "../schema/deal.schema/deal-lp-investor.schema.js";
import {
  dealInvestment,
  type DealInvestmentRow,
} from "../schema/deal.schema/deal-investment.schema.js";
import {
  insertDealInvestment,
  isLpInvestorRole,
  LP_INVESTOR_ROLE_STORED,
  resolveFirstInvestorClassForDeal,
  resolveInvestorClassForDealInvestment,
} from "./dealInvestment.service.js";
import { upsertDealLpInvestor } from "./dealLpInvestor.service.js";

const LP_INVESTOR_TABLE_ROLE = "LP Investor";

function normalizeCommittedAmountStored(raw: string): string {
  const t = String(raw ?? "")
    .trim()
    .replace(/[$,\s]/g, "");
  if (!t) return "";
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(n);
}

const LP_COMMITMENT_PROFILE_IDS = new Set([
  "individual",
  "custodian_ira_401k",
  "joint_tenancy",
  "llc_corp_trust_etc",
]);

function normalizeLpCommitmentProfileId(raw: string | undefined): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  return LP_COMMITMENT_PROFILE_IDS.has(t) ? t : null;
}

const DOC_SIGNED_ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDocSignedDateParam(
  raw: string | null | undefined,
):
  | { ok: true; value: string | null | undefined }
  | { ok: false; message: string } {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null) return { ok: true, value: null };
  const s = String(raw ?? "").trim();
  if (!s) return { ok: true, value: null };
  if (DOC_SIGNED_ISO_DAY_RE.test(s)) return { ok: true, value: s };
  return {
    ok: false,
    message:
      "Document signed date must be empty or a valid calendar date (YYYY-MM-DD).",
  };
}

function normalizeInvestmentStatusParam(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const s = String(raw ?? "").trim();
  if (s.length > 400) return s.slice(0, 400);
  return s;
}

async function resolveEmailForContactMemberId(rawCid: string): Promise<string> {
  const cid = String(rawCid ?? "").trim();
  if (!cid) return "";
  const [uRow] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, cid))
    .limit(1);
  const fromUser = String(uRow?.email ?? "").trim().toLowerCase();
  if (fromUser) return fromUser;
  const [cRow] = await db
    .select({ email: contact.email })
    .from(contact)
    .where(sql`${contact.id}::text = ${cid}`)
    .limit(1);
  return String(cRow?.email ?? "").trim().toLowerCase();
}

export async function applyMyInvestNowCommitmentAddon(params: {
  dealId: string;
  viewerEmailNorm: string;
  viewerUserId?: string;
  committedAmount: string;
  profileId?: string;
  status?: string;
  docSignedDate?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const e = String(params.viewerEmailNorm ?? "").trim().toLowerCase();
  if (!e.includes("@"))
    return { ok: false, message: "Invalid viewer email" };

  const stored = normalizeCommittedAmountStored(params.committedAmount);
  if (!stored) {
    return {
      ok: false,
      message: "Committed amount must be a number greater than 0",
    };
  }

  const rawProfile = String(params.profileId ?? "").trim();
  const profileOpt = normalizeLpCommitmentProfileId(
    rawProfile ? rawProfile : undefined,
  );
  if (rawProfile && !profileOpt) {
    return { ok: false, message: "Invalid investor profile." };
  }

  const statusOpt = normalizeInvestmentStatusParam(params.status);
  const docNorm = normalizeDocSignedDateParam(params.docSignedDate);
  if (!docNorm.ok) return docNorm;

  const viewerUserId = String(params.viewerUserId ?? "").trim();
  const matchRows = await db
    .select()
    .from(dealLpInvestor)
    .where(eq(dealLpInvestor.dealId, params.dealId));

  let target: DealLpInvestorRow | undefined;
  for (const row of matchRows) {
    const em = await resolveEmailForContactMemberId(row.contactMemberId);
    if (em === e) {
      target = row;
      break;
    }
  }

  let fallbackContactMemberId = "";
  if (!target && viewerUserId) {
    const memberRows = await db
      .select({ contactMemberId: dealMember.contactMemberId })
      .from(dealMember)
      .where(eq(dealMember.dealId, params.dealId));

    let contactMemberId = "";
    const preferred = new Set<string>([viewerUserId]);
    const byEmail = await db
      .select({ id: contact.id })
      .from(contact)
      .where(sql`lower(trim(${contact.email})) = ${e}`);
    for (const row of byEmail) {
      const cid = String(row.id ?? "").trim();
      if (cid) preferred.add(cid);
    }

    for (const row of memberRows) {
      const cid = String(row.contactMemberId ?? "").trim();
      if (!cid) continue;
      if (preferred.has(cid)) {
        contactMemberId = cid;
        break;
      }
    }
    if (!contactMemberId) {
      for (const row of memberRows) {
        const cid = String(row.contactMemberId ?? "").trim();
        if (!cid) continue;
        const em = await resolveEmailForContactMemberId(cid);
        if (em === e) {
          contactMemberId = cid;
          break;
        }
      }
    }
    if (contactMemberId) fallbackContactMemberId = contactMemberId;
  }

  const targetContactMemberId =
    target?.contactMemberId || fallbackContactMemberId;
  if (!targetContactMemberId) {
    return {
      ok: false,
      message:
        "No LP investor record for your account on this deal. Ask your sponsor to add you.",
    };
  }

  const invCandidates = await db
    .select()
    .from(dealInvestment)
    .where(
      and(
        eq(dealInvestment.dealId, params.dealId),
        eq(dealInvestment.contactId, targetContactMemberId),
      ),
    )
    .orderBy(desc(dealInvestment.createdAt));

  let inv: DealInvestmentRow | undefined;
  for (const row of invCandidates) {
    if (isLpInvestorRole(row.investor_role)) {
      inv = row;
      break;
    }
  }
  const now = new Date();

  if (!inv) {
    if (!profileOpt) {
      return {
        ok: false,
        message:
          "Investor profile is required to record your first commitment on this deal.",
      };
    }
    const icRaw = target?.investorClass?.trim() ?? "";
    const classRes = icRaw
      ? await resolveInvestorClassForDealInvestment(params.dealId, icRaw)
      : await resolveFirstInvestorClassForDeal(params.dealId);
    if (!classRes.ok) return { ok: false, message: classRes.message };

    await insertDealInvestment({
      dealId: params.dealId,
      input: {
        offeringId: "",
        contactId: targetContactMemberId,
        contactDisplayName: "",
        profileId: profileOpt,
        investor_role: LP_INVESTOR_ROLE_STORED,
        status: statusOpt !== undefined ? statusOpt : "",
        investorClass: classRes.storedInvestorClass,
        docSignedDate: docNorm.value === undefined ? null : docNorm.value,
        commitmentAmount: stored,
        extraContributionAmounts: [],
        documentStoragePath: null,
      },
    });

    if (!target) {
      if (!viewerUserId) {
        return {
          ok: false,
          message: "Could not determine your account id for LP roster linking.",
        };
      }
      target = await upsertDealLpInvestor(params.dealId, {
        contactMemberId: targetContactMemberId,
        contactDisplayName: "",
        profileId: profileOpt,
        investorClass: classRes.storedInvestorClass,
        sendInvitationMail: "no",
        addedByUserId: viewerUserId,
        emailFromClient: e,
        roleFromClient: LP_INVESTOR_TABLE_ROLE,
      });
    }

    await db
      .update(dealLpInvestor)
      .set({ profileId: profileOpt, updatedAt: now })
      .where(eq(dealLpInvestor.id, target.id));

    return { ok: true };
  }

  const invPatch: {
    commitmentAmount: string;
    profileId?: string;
    status?: string;
    docSignedDate?: string | null;
  } = {
    commitmentAmount: stored,
  };
  if (profileOpt) invPatch.profileId = profileOpt;
  if (statusOpt !== undefined) invPatch.status = statusOpt;
  if (docNorm.value !== undefined) invPatch.docSignedDate = docNorm.value;

  await db
    .update(dealInvestment)
    .set(invPatch)
    .where(eq(dealInvestment.id, inv.id));

  if (!target) {
    if (!viewerUserId) {
      return {
        ok: false,
        message: "Could not determine your account id for LP roster linking.",
      };
    }
    const icRaw = inv.investorClass?.trim() ?? "";
    const classRes = icRaw
      ? await resolveInvestorClassForDealInvestment(params.dealId, icRaw)
      : await resolveFirstInvestorClassForDeal(params.dealId);
    if (!classRes.ok) return { ok: false, message: classRes.message };
    target = await upsertDealLpInvestor(params.dealId, {
      contactMemberId: targetContactMemberId,
      contactDisplayName: "",
      profileId: profileOpt ?? "",
      investorClass: classRes.storedInvestorClass,
      sendInvitationMail: "no",
      addedByUserId: viewerUserId,
      emailFromClient: e,
      roleFromClient: LP_INVESTOR_TABLE_ROLE,
    });
  }

  if (profileOpt) {
    await db
      .update(dealLpInvestor)
      .set({ profileId: profileOpt, updatedAt: now })
      .where(eq(dealLpInvestor.id, target.id));
  }

  return { ok: true };
}
