import type { Request, Response } from "express";
import { getJwtUser } from "../../middleware/jwtUser.js";
import {
  assertDealIdInViewerScope,
  resolveDealViewerScope,
} from "../../services/dealAccess.service.js";
import {
  deleteInvestorClass,
  insertInvestorClass,
  listInvestorClassesByDealId,
  mapRowToJson,
  type InvestorClassInput,
  updateInvestorClass,
} from "../../services/dealInvestorClass.service.js";

function bodyString(v: unknown): string {
  return typeof v === "string" ? v : v != null ? String(v) : "";
}

function parseInput(b: Record<string, unknown>): InvestorClassInput {
  return {
    name: bodyString(b.name).trim(),
    subscriptionType: bodyString(b.subscription_type ?? b.subscriptionType).trim(),
    entityName: bodyString(b.entity_name ?? b.entityName).trim(),
    startDate: bodyString(b.start_date ?? b.startDate).trim(),
    offeringSize: bodyString(b.offering_size ?? b.offeringSize).trim(),
    raiseAmountDistributions: bodyString(
      b.raise_amount_distributions ?? b.raiseAmountDistributions,
    ).trim(),
    billingRaiseQuota: bodyString(
      b.billing_raise_quota ?? b.billingRaiseQuota,
    ).trim(),
    minimumInvestment: bodyString(
      b.minimum_investment ?? b.minimumInvestment,
    ).trim(),
    pricePerUnit: bodyString(b.price_per_unit ?? b.pricePerUnit).trim(),
    status: bodyString(b.status).trim() || "draft",
    visibility: bodyString(b.visibility).trim(),
    advancedOptionsJson: (() => {
      const raw = b.advanced_options_json ?? b.advancedOptionsJson;
      if (raw == null) return "{}";
      if (typeof raw === "string") {
        const t = raw.trim();
        return t === "" ? "{}" : t;
      }
      try {
        return JSON.stringify(raw);
      } catch {
        return "{}";
      }
    })(),
  };
}

export async function getDealInvestorClasses(
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
    const rows = await listInvestorClassesByDealId(dealId);
    res.status(200).json({
      investorClasses: rows.map(mapRowToJson),
    });
  } catch (err) {
    console.error("getDealInvestorClasses:", err);
    res.status(500).json({ message: "Could not load investor classes" });
  }
}

export async function postDealInvestorClass(
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
  if (!dealId) {
    res.status(400).json({ message: "Missing deal id" });
    return;
  }
  const b = req.body as Record<string, unknown>;
  const input = parseInput(b);
  if (!input.name) {
    res.status(400).json({ message: "Name is required" });
    return;
  }
  try {
    const scope = await resolveDealViewerScope(user.id, user.userRole);
    if (!(await assertDealIdInViewerScope(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }
    const row = await insertInvestorClass({ dealId, input });
    res.status(201).json({
      message: "Investor class created",
      investorClass: mapRowToJson(row),
    });
  } catch (err) {
    console.error("postDealInvestorClass:", err);
    res.status(500).json({ message: "Could not create investor class" });
  }
}

export async function putDealInvestorClass(
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
  const classId =
    typeof req.params.classId === "string"
      ? req.params.classId
      : req.params.classId?.[0];
  if (!dealId || !classId) {
    res.status(400).json({ message: "Missing deal id or class id" });
    return;
  }
  const b = req.body as Record<string, unknown>;
  const input = parseInput(b);
  if (!input.name) {
    res.status(400).json({ message: "Name is required" });
    return;
  }
  try {
    const scope = await resolveDealViewerScope(user.id, user.userRole);
    if (!(await assertDealIdInViewerScope(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }
    const row = await updateInvestorClass({ dealId, classId, input });
    if (!row) {
      res.status(404).json({ message: "Investor class not found" });
      return;
    }
    res.status(200).json({
      message: "Investor class updated",
      investorClass: mapRowToJson(row),
    });
  } catch (err) {
    console.error("putDealInvestorClass:", err);
    res.status(500).json({ message: "Could not update investor class" });
  }
}

export async function deleteDealInvestorClass(
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
  const classId =
    typeof req.params.classId === "string"
      ? req.params.classId
      : req.params.classId?.[0];
  if (!dealId || !classId) {
    res.status(400).json({ message: "Missing deal id or class id" });
    return;
  }
  try {
    const scope = await resolveDealViewerScope(user.id, user.userRole);
    if (!(await assertDealIdInViewerScope(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }
    const ok = await deleteInvestorClass({ dealId, classId });
    if (!ok) {
      res.status(404).json({ message: "Investor class not found" });
      return;
    }
    res.status(200).json({ message: "Investor class deleted" });
  } catch (err) {
    console.error("deleteDealInvestorClass:", err);
    res.status(500).json({ message: "Could not delete investor class" });
  }
}
