import type { Request, Response } from "express";
import { handleDealInvestorEsignWebhook } from "../../services/deal/dealMemberEsignCompletion.service.js";

function parseWebhookPayload(req: Request): {
  eventType: string;
  signatureRequestId: string;
  dealId: string;
  rosterId: string;
} | null {
  let raw: unknown = req.body;
  if (raw && typeof raw === "object" && "json" in raw) {
    const j = (raw as { json?: unknown }).json;
    if (typeof j === "string") {
      try {
        raw = JSON.parse(j) as unknown;
      } catch {
        return null;
      }
    }
  }

  const root = raw as {
    event?: { event_type?: string };
    signature_request?: {
      signature_request_id?: string;
      metadata?: Record<string, string>;
    };
  };

  const eventType = String(root.event?.event_type ?? "").trim();
  const signatureRequestId = String(
    root.signature_request?.signature_request_id ?? "",
  ).trim();
  const metadata = root.signature_request?.metadata ?? {};
  const dealId = String(metadata.deal_id ?? metadata.dealId ?? "").trim();
  const rosterId = String(metadata.roster_id ?? metadata.rosterId ?? "").trim();

  if (!eventType || !signatureRequestId || !dealId) return null;
  return { eventType, signatureRequestId, dealId, rosterId };
}

/**
 * POST /webhooks/dropbox-sign — Dropbox Sign event callback (no JWT).
 * Configure this URL in the Dropbox Sign API app settings.
 */
export async function postDropboxSignWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = parseWebhookPayload(req);
  if (!parsed) {
    res.status(200).send("Hello API Event Received");
    return;
  }

  try {
    await handleDealInvestorEsignWebhook({
      dealId: parsed.dealId,
      rosterId: parsed.rosterId || undefined,
      signatureRequestId: parsed.signatureRequestId,
      eventType: parsed.eventType,
    });
  } catch (err) {
    console.error("postDropboxSignWebhook:", err);
  }

  res.status(200).send("Hello API Event Received");
}
