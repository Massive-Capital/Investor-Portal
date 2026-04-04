import type { Request, Response } from "express";
import { getJwtUser } from "../../middleware/jwtUser.js";
import {
  assertDealIdInViewerScope,
  resolveDealViewerScope,
} from "../../services/dealAccess.service.js";
import { reconcileAssigningDealUsersForDeal } from "../../services/assigningDealUser.service.js";
import {
  buildInvestorKpisFromRows,
  getDealInvestmentById,
  insertDealInvestment,
  listDealInvestmentsByDealId,
  mapDealInvestmentsToInvestorApi,
  resolveInvestorClassForDealInvestment,
  saveSubscriptionDocument,
  updateDealInvestment,
} from "../../services/dealInvestment.service.js";

function bodyString(v: unknown): string {
  if (typeof v === "string") return v;
  // multipart parsers may expose duplicate keys as string[]
  if (Array.isArray(v)) {
    if (v.length === 0) return "";
    return bodyString(v[v.length - 1]);
  }
  if (v != null) return String(v);
  return "";
}

function parseExtras(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x));
  if (typeof raw === "string" && raw.trim()) {
    try {
      const j = JSON.parse(raw) as unknown;
      if (Array.isArray(j)) return j.map((x) => String(x));
    } catch {
      /* ignore */
    }
  }
  return [];
}

export async function getDealInvestors(
  req: Request,
  res: Response,
): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }
  const dealId =
    typeof req.params.dealId === "string" ? req.params.dealId : req.params.dealId?.[0];
  if (!dealId) {
    res.status(400).json({ message: "Missing deal id" });
    return;
  }
  try {
    const scope = await resolveDealViewerScope(user.id, user.userRole);
    if (!(await assertDealIdInViewerScope(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }
    const rows = await listDealInvestmentsByDealId(dealId);
    const investors = await mapDealInvestmentsToInvestorApi(rows);
    const kpis = buildInvestorKpisFromRows(rows);
    res.status(200).json({
      kpis,
      investors,
    });
  } catch (err) {
    console.error("getDealInvestors:", err);
    res.status(500).json({ message: "Could not load investors" });
  }
}

export async function putDealInvestment(
  req: Request,
  res: Response,
): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }

  const dealId =
    typeof req.params.dealId === "string"
      ? req.params.dealId
      : req.params.dealId?.[0];
  const investmentId =
    typeof req.params.investmentId === "string"
      ? req.params.investmentId
      : req.params.investmentId?.[0];
  if (!dealId || !investmentId) {
    res.status(400).json({ message: "Missing deal id or investment id" });
    return;
  }

  const b = req.body as Record<string, unknown>;
  const offeringId = bodyString(b.offering_id);
  const contactId = bodyString(b.contact_id);
  const contactDisplayName = bodyString(b.contact_display_name);
  const profileId = bodyString(b.profile_id);
  const investor_role = bodyString(b.investor_role);
  const status = bodyString(b.status);
  const investorClass = bodyString(b.investor_class);
  const docSignedDate = bodyString(b.doc_signed_date) || null;
  const commitmentAmount = bodyString(b.commitment_amount);
  const extraContributionAmounts = parseExtras(b.extra_contribution_amounts);

  if (!contactId.trim()) {
    res.status(400).json({ message: "Member (contact) is required" });
    return;
  }
  if (!commitmentAmount.trim()) {
    res.status(400).json({ message: "Commitment amount is required" });
    return;
  }

  const file = req.file;
  try {
    const scope = await resolveDealViewerScope(user.id, user.userRole);
    if (!(await assertDealIdInViewerScope(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }

    const classResolution = await resolveInvestorClassForDealInvestment(
      dealId,
      investorClass,
    );
    if (!classResolution.ok) {
      res.status(400).json({ message: classResolution.message });
      return;
    }
    const resolvedInvestorClass = classResolution.storedInvestorClass;

    const existing = await getDealInvestmentById(dealId, investmentId);
    if (!existing) {
      res.status(404).json({ message: "Investment not found" });
      return;
    }

    let documentStoragePath: string | null = existing.documentStoragePath;
    if (file && "buffer" in file && file.buffer && file.buffer.length > 0) {
      documentStoragePath = await saveSubscriptionDocument({
        dealId,
        file: {
          buffer: file.buffer,
          originalname: file.originalname || "document",
        },
      });
    }

    const row = await updateDealInvestment({
      dealId,
      investmentId,
      input: {
        offeringId,
        contactId,
        contactDisplayName,
        profileId,
        investor_role,
        status,
        investorClass: resolvedInvestorClass,
        docSignedDate,
        commitmentAmount,
        extraContributionAmounts,
        documentStoragePath,
      },
    });
    if (!row) {
      res.status(404).json({ message: "Investment not found" });
      return;
    }
    await reconcileAssigningDealUsersForDeal(dealId, user.id);
    const [investor] = await mapDealInvestmentsToInvestorApi([row]);
    res.status(200).json({
      message: "Investment updated",
      investor,
    });
  } catch (err) {
    console.error("putDealInvestment:", err);
    res.status(500).json({ message: "Could not update investment" });
  }
}

export async function postDealInvestment(
  req: Request,
  res: Response,
): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }

  const dealId =
    typeof req.params.dealId === "string" ? req.params.dealId : req.params.dealId?.[0];
  if (!dealId) {
    res.status(400).json({ message: "Missing deal id" });
    return;
  }

  const b = req.body as Record<string, unknown>;
  const offeringId = bodyString(b.offering_id);
  const contactId = bodyString(b.contact_id);
  const contactDisplayName = bodyString(b.contact_display_name);
  const profileId = bodyString(b.profile_id);
    const investor_role = bodyString(b.investor_role);

  const status = bodyString(b.status);
  const investorClass = bodyString(b.investor_class);
  const docSignedDate = bodyString(b.doc_signed_date) || null;
  const commitmentAmount = bodyString(b.commitment_amount);
  const extraContributionAmounts = parseExtras(b.extra_contribution_amounts);

  if (!contactId.trim()) {
    res.status(400).json({ message: "Member (contact) is required" });
    return;
  }
  if (!commitmentAmount.trim()) {
    res.status(400).json({ message: "Commitment amount is required" });
    return;
  }

  const file = req.file;
  let documentStoragePath: string | null = null;

  try {
    const scope = await resolveDealViewerScope(user.id, user.userRole);
    if (!(await assertDealIdInViewerScope(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }

    const classResolution = await resolveInvestorClassForDealInvestment(
      dealId,
      investorClass,
    );
    if (!classResolution.ok) {
      res.status(400).json({ message: classResolution.message });
      return;
    }
    const resolvedInvestorClass = classResolution.storedInvestorClass;

    if (file && "buffer" in file && file.buffer && file.buffer.length > 0) {
      documentStoragePath = await saveSubscriptionDocument({
        dealId,
        file: {
          buffer: file.buffer,
          originalname: file.originalname || "document",
        },
      });
    }

    const row = await insertDealInvestment({
      dealId,
      input: {
        offeringId,
        contactId,
        contactDisplayName,
        profileId,
        investor_role,
        status,
        investorClass: resolvedInvestorClass,
        docSignedDate,
        commitmentAmount,
        extraContributionAmounts,
        documentStoragePath,
      },
    });

    await reconcileAssigningDealUsersForDeal(dealId, user.id);
    const [investor] = await mapDealInvestmentsToInvestorApi([row]);
    res.status(201).json({
      message: "Investment recorded",
      investor,
    });
  } catch (err) {
    console.error("postDealInvestment:", err);
    res.status(500).json({ message: "Could not save investment" });
  }
}
