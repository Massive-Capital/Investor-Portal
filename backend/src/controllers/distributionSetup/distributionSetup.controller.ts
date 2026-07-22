import type { Request, Response } from "express";
import { getValidJwtUser } from "../../middleware/jwtUser.js";
import {
  assertDealIdInViewerScope,
  resolveDealViewerScope,
} from "../../services/deal/dealAccess.service.js";
import { requestedOrganizationIdFromRequest } from "../../services/org/orgResolution.service.js";
import {
  getDistributionSetupBundle,
  saveDistributionSetupBundle,
} from "../../services/distributionSetup/distributionSetup.service.js";
import type {
  DistributionPaymentRow,
  DistributionSetupSaveInput,
  DistributionWaterfalls,
  DistributionWfKind,
} from "../../services/distributionSetup/distributionSetup.types.js";
import {
  DISTRIBUTION_AMOUNT_MODES,
  DISTRIBUTION_WF_KINDS,
} from "../../services/distributionSetup/distributionSetup.types.js";

function paramId(v: string | string[] | undefined): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

function asRecord(v: unknown): Record<string, unknown> {
  if (v != null && typeof v === "object" && !Array.isArray(v))
    return v as Record<string, unknown>;
  return {};
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v != null ? String(v).trim() : "";
}

function parseRow(raw: unknown): DistributionPaymentRow | null {
  const o = asRecord(raw);
  const kind = str(o.kind);
  if (!(DISTRIBUTION_WF_KINDS as readonly string[]).includes(kind)) return null;
  const mode = str(o.amountMode ?? o.amount_mode) || "calc";
  const amountMode = (DISTRIBUTION_AMOUNT_MODES as readonly string[]).includes(
    mode,
  )
    ? (mode as DistributionPaymentRow["amountMode"])
    : "calc";
  const payToRaw = Array.isArray(o.payTo)
    ? o.payTo
    : Array.isArray(o.pay_to)
      ? o.pay_to
      : [];
  const catchup = asRecord(o.catchup);
  return {
    id: str(o.id) || `row_${Date.now().toString(36)}`,
    kind: kind as DistributionWfKind,
    name: str(o.name) || kind,
    payTo: payToRaw.map((id) => str(id)).filter(Boolean),
    amountMode,
    inputAmount: str(o.inputAmount ?? o.input_amount) || "0",
    catchupPct: str(catchup.pct ?? o.catchupPct ?? o.catchup_pct) || "20",
  };
}

function parseSaveInput(body: unknown): DistributionSetupSaveInput | null {
  if (body == null || typeof body !== "object" || Array.isArray(body))
    return null;
  const b = body as Record<string, unknown>;
  const wfRaw = asRecord(b.waterfalls ?? b);
  const operatingRaw = Array.isArray(wfRaw.operating) ? wfRaw.operating : [];
  const capitalRaw = Array.isArray(wfRaw.capital)
    ? wfRaw.capital
    : Array.isArray(wfRaw.capital_event)
      ? wfRaw.capital_event
      : [];
  const operating = operatingRaw
    .map(parseRow)
    .filter((r): r is DistributionPaymentRow => r != null);
  const capital = capitalRaw
    .map(parseRow)
    .filter((r): r is DistributionPaymentRow => r != null);
  const waterfalls: DistributionWaterfalls = { operating, capital };
  return { waterfalls };
}

async function assertDealAccess(
  req: Request,
  dealId: string,
): Promise<
  | { ok: true }
  | { ok: false; status: number; message: string }
> {
  const user = await getValidJwtUser(req);
  if (!user?.id)
    return { ok: false, status: 401, message: "Authorization required" };
  const scope = await resolveDealViewerScope(
    user.id,
    user.userRole,
    requestedOrganizationIdFromRequest(req),
  );
  if (!(await assertDealIdInViewerScope(dealId, scope)))
    return { ok: false, status: 404, message: "Deal not found" };
  return { ok: true };
}

export async function getDealDistributionSetup(req: Request, res: Response) {
  try {
    const dealId = paramId(req.params.dealId);
    if (!dealId) {
      res.status(400).json({ message: "dealId is required" });
      return;
    }
    const access = await assertDealAccess(req, dealId);
    if (!access.ok) {
      res.status(access.status).json({ message: access.message });
      return;
    }
    const bundle = await getDistributionSetupBundle(dealId);
    if (!bundle) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }
    res.json({ distributionSetup: bundle });
  } catch (err) {
    console.error("getDealDistributionSetup", err);
    res.status(500).json({ message: "Failed to load distribution setup" });
  }
}

export async function putDealDistributionSetup(req: Request, res: Response) {
  try {
    const dealId = paramId(req.params.dealId);
    if (!dealId) {
      res.status(400).json({ message: "dealId is required" });
      return;
    }
    const access = await assertDealAccess(req, dealId);
    if (!access.ok) {
      res.status(access.status).json({ message: access.message });
      return;
    }
    const input = parseSaveInput(req.body);
    if (!input) {
      res.status(400).json({ message: "Invalid distribution setup payload" });
      return;
    }
    const { bundle, error } = await saveDistributionSetupBundle({
      dealId,
      input,
    });
    if (error) {
      res.status(400).json({ message: error, distributionSetup: bundle });
      return;
    }
    res.json({ distributionSetup: bundle });
  } catch (err) {
    console.error("putDealDistributionSetup", err);
    res.status(500).json({ message: "Failed to save distribution setup" });
  }
}
