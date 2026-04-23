/**
 * LP “Invest now”: **adds** the posted amount to the existing committed total on the latest LP
 * `deal_investment` for this deal + contact (locked row), with optional `status` and
 * `doc_signed_date`. First commitment (no LP investment row yet) stores the amount as-is.
 * Syncs `deal_lp_investor.committed_amount` from the investment row so the Investors tab matches.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../database/db.js";
import { contact, dealMember, users } from "../schema/schema.js";
import { dealLpInvestor, } from "../schema/deal.schema/deal-lp-investor.schema.js";
import { dealInvestment, type DealInvestmentInsert, } from "../schema/deal.schema/deal-investment.schema.js";
import { committedNumericFromDealInvestmentRow, insertDealInvestment, isLpInvestorRole, LP_INVESTOR_ROLE_STORED, resolveFirstInvestorClassForDeal, resolveInvestorClassForDealInvestment, } from "./dealInvestment.service.js";
import { upsertDealLpInvestor } from "./dealLpInvestor.service.js";
const LP_INVESTOR_TABLE_ROLE = "LP Investor";

export type ApplyMyInvestNowCommitmentResult =
  | { ok: true }
  | { ok: false; message: string };

export type ApplyMyInvestNowCommitmentInput = {
  dealId: string;
  viewerEmailNorm: string;
  viewerUserId: string;
  committedAmount: unknown;
  profileId?: unknown;
  status?: string;
  docSignedDate?: unknown;
};

function normalizeCommittedAmountStored(raw: unknown) {
    const t = String(raw ?? "")
        .trim()
        .replace(/[$,\s]/g, "");
    if (!t)
        return "";
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0)
        return "";
    return String(n);
}
/** Persist cumulative commitment as a plain numeric string (avoids float noise). */
function formatCumulativeCommitmentStored(total: number) {
    if (!Number.isFinite(total) || total < 0)
        return "0";
    const rounded = Math.round(total * 100) / 100;
    return String(rounded);
}
const LP_COMMITMENT_PROFILE_IDS = new Set([
    "individual",
    "custodian_ira_401k",
    "joint_tenancy",
    "llc_corp_trust_etc",
]);
function normalizeLpCommitmentProfileId(raw: unknown) {
    const t = String(raw ?? "").trim();
    if (!t)
        return null;
    return LP_COMMITMENT_PROFILE_IDS.has(t) ? t : null;
}
const DOC_SIGNED_ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
function normalizeDocSignedDateParam(raw: unknown) {
    if (raw === undefined)
        return { ok: true, value: undefined };
    if (raw === null)
        return { ok: true, value: null };
    const s = String(raw ?? "").trim();
    if (!s)
        return { ok: true, value: null };
    if (DOC_SIGNED_ISO_DAY_RE.test(s))
        return { ok: true, value: s };
    return {
        ok: false,
        message: "Document signed date must be empty or a valid calendar date (YYYY-MM-DD).",
    };
}
function normalizeInvestmentStatusParam(raw: unknown) {
    if (raw === undefined)
        return undefined;
    const s = String(raw ?? "").trim();
    if (s.length > 400)
        return s.slice(0, 400);
    return s;
}
async function resolveEmailForContactMemberId(rawCid: unknown) {
    const cid = String(rawCid ?? "").trim();
    if (!cid)
        return "";
    const [uRow] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, cid))
        .limit(1);
    const fromUser = String(uRow?.email ?? "").trim().toLowerCase();
    if (fromUser)
        return fromUser;
    const [cRow] = await db
        .select({ email: contact.email })
        .from(contact)
        .where(sql `${contact.id}::text = ${cid}`)
        .limit(1);
    return String(cRow?.email ?? "").trim().toLowerCase();
}
export async function applyMyInvestNowCommitmentAddon(
  params: ApplyMyInvestNowCommitmentInput
): Promise<ApplyMyInvestNowCommitmentResult> {
    const e = String(params.viewerEmailNorm ?? "").trim().toLowerCase();
    if (!e.includes("@"))
        return { ok: false, message: "Invalid viewer email" };
    const incrementStr = normalizeCommittedAmountStored(params.committedAmount);
    if (!incrementStr) {
        return {
            ok: false,
            message: "Committed amount must be a number greater than 0",
        };
    }
    const increment = Number(incrementStr);
    if (!Number.isFinite(increment) || increment <= 0) {
        return {
            ok: false,
            message: "Committed amount must be a number greater than 0",
        };
    }
    const rawProfile = String(params.profileId ?? "").trim();
    const profileOpt = normalizeLpCommitmentProfileId(rawProfile ? rawProfile : undefined);
    if (rawProfile && !profileOpt) {
        return { ok: false, message: "Invalid investor profile." };
    }
    const statusOpt = normalizeInvestmentStatusParam(params.status);
    const docNorm = normalizeDocSignedDateParam(params.docSignedDate);
    if (!docNorm.ok) {
        return {
            ok: false,
            message: docNorm.message ?? "Document signed date is invalid.",
        };
    }
    const viewerUserId = String(params.viewerUserId ?? "").trim();
    const matchRows = await db
        .select()
        .from(dealLpInvestor)
        .where(eq(dealLpInvestor.dealId, params.dealId));
    let target;
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
        const preferred = new Set([viewerUserId]);
        const byEmail = await db
            .select({ id: contact.id })
            .from(contact)
            .where(sql `lower(trim(${contact.email})) = ${e}`);
        for (const row of byEmail) {
            const cid = String(row.id ?? "").trim();
            if (cid)
                preferred.add(cid);
        }
        for (const row of memberRows) {
            const cid = String(row.contactMemberId ?? "").trim();
            if (!cid)
                continue;
            if (preferred.has(cid)) {
                contactMemberId = cid;
                break;
            }
        }
        if (!contactMemberId) {
            for (const row of memberRows) {
                const cid = String(row.contactMemberId ?? "").trim();
                if (!cid)
                    continue;
                const em = await resolveEmailForContactMemberId(cid);
                if (em === e) {
                    contactMemberId = cid;
                    break;
                }
            }
        }
        if (contactMemberId)
            fallbackContactMemberId = contactMemberId;
    }
    const targetContactMemberId = target?.contactMemberId || fallbackContactMemberId;
    if (!targetContactMemberId) {
        return {
            ok: false,
            message: "No LP investor record for your account on this deal. Ask your sponsor to add you.",
        };
    }
    const invCandidates = await db
        .select()
        .from(dealInvestment)
        .where(and(eq(dealInvestment.dealId, params.dealId), eq(dealInvestment.contactId, targetContactMemberId)))
        .orderBy(desc(dealInvestment.createdAt));
    let inv;
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
                message: "Investor profile is required to record your first commitment on this deal.",
            };
        }
        const icRaw = target?.investorClass?.trim() ?? "";
        const classRes = icRaw
            ? await resolveInvestorClassForDealInvestment(params.dealId, icRaw)
            : await resolveFirstInvestorClassForDeal(params.dealId);
        if (!classRes.ok)
            return {
                ok: false,
                message: classRes.message ?? "Could not resolve investor class.",
            };
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
                commitmentAmount: incrementStr,
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
            .set({
            profileId: profileOpt,
            committed_amount: incrementStr,
            updatedAt: now,
        })
            .where(eq(dealLpInvestor.id, target.id));
        return { ok: true };
    }
    try {
        await db.transaction(async (tx) => {
            await tx.execute(sql `SELECT 1 FROM deal_investment WHERE id = ${inv.id}::uuid FOR UPDATE`);
            const [fresh] = await tx
                .select()
                .from(dealInvestment)
                .where(eq(dealInvestment.id, inv.id))
                .limit(1);
            if (!fresh)
                throw new Error("LP_COMMITMENT_ROW_MISSING");
            const previous = committedNumericFromDealInvestmentRow(fresh);
            const newTotal = previous + increment;
            const invPatch: Pick<
                DealInvestmentInsert,
                "commitmentAmount" | "extraContributionAmounts"
            > & {
                profileId?: string;
                status?: string;
                docSignedDate?: string | null;
            } = {
                commitmentAmount: formatCumulativeCommitmentStored(newTotal),
                extraContributionAmounts: [],
            };
            if (profileOpt)
                invPatch.profileId = profileOpt;
            if (statusOpt !== undefined)
                invPatch.status = statusOpt;
            if (docNorm.value !== undefined)
                invPatch.docSignedDate = docNorm.value;
            await tx
                .update(dealInvestment)
                .set(invPatch)
                .where(eq(dealInvestment.id, inv.id));
        });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "LP_COMMITMENT_ROW_MISSING") {
            return {
                ok: false,
                message: "Could not update commitment (investment row missing).",
            };
        }
        throw e;
    }
    const [invAfterCommit] = await db
        .select({ commitmentAmount: dealInvestment.commitmentAmount })
        .from(dealInvestment)
        .where(eq(dealInvestment.id, inv.id))
        .limit(1);
    const syncedCommittedFromInvestment = String(invAfterCommit?.commitmentAmount ?? "").trim();
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
        if (!classRes.ok)
            return {
                ok: false,
                message: classRes.message ?? "Could not resolve investor class.",
            };
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
    await db
        .update(dealLpInvestor)
        .set({
        committed_amount: syncedCommittedFromInvestment,
        updatedAt: now,
        ...(profileOpt ? { profileId: profileOpt } : {}),
    })
        .where(eq(dealLpInvestor.id, target.id));
    return { ok: true };
}
