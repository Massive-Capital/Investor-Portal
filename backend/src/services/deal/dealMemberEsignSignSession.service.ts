import { getDropboxSignConfig } from "../../config/dropboxSign.config.js";
import {
  findEsignSendBySignatureRequestId,
  parseEsignStatusBundle,
  pickPendingEsignSend,
} from "../../constants/deal-investor-esign-status.js";
import { getDealEsignDropboxSignPublicConfig } from "./dealEsignDropboxSign.service.js";
import {
  getEmbeddedSignUrl,
  getFirstSignatureIdFromRequest,
} from "../esign/dropboxSign.service.js";
import {
  findInvestorEsignTargetForPortalUser,
  readInvestorEsignStatusJson,
  type InvestorEsignRowTarget,
} from "./dealMemberEsignStatus.service.js";

export type DealMyEsignSignSessionResult =
  | {
      ok: true;
      alreadyCompleted: boolean;
      signUrl: string | null;
      clientId: string | null;
      testMode: boolean;
      configured: boolean;
      signatureRequestId?: string | null;
    }
  | { ok: false; code: "not_found" | "not_pending" | "not_configured"; message: string };

async function resolveSignatureIdForSend(
  send: { signatureId?: string; signatureRequestId?: string },
): Promise<string | null> {
  const stored = send.signatureId?.trim();
  if (stored) return stored;

  const requestId = send.signatureRequestId?.trim();
  if (!requestId) return null;
  return getFirstSignatureIdFromRequest(requestId);
}

/**
 * Fresh embedded sign session for the signed-in investor (portal iframe flow).
 */
export async function getDealMyEsignSignSession(params: {
  dealId: string;
  email: string;
  userId: string;
  signatureRequestId?: string;
}): Promise<DealMyEsignSignSessionResult> {
  const publicCfg = getDealEsignDropboxSignPublicConfig();
  if (!getDropboxSignConfig()) {
    return {
      ok: false,
      code: "not_configured",
      message: "Dropbox Sign is not configured on the server",
    };
  }

  const target = await findInvestorEsignTargetForPortalUser(params.dealId, {
    email: params.email.trim().toLowerCase(),
    userId: params.userId,
  });
  if (!target) {
    return {
      ok: false,
      code: "not_found",
      message: "No eSign request found for your account on this deal",
    };
  }

  const raw = await readInvestorEsignStatusJson(params.dealId, target);
  const bundle = parseEsignStatusBundle(raw);
  if (!bundle?.sends.length) {
    return {
      ok: false,
      code: "not_pending",
      message: "No pending eSign documents for this deal",
    };
  }

  const requestedId = params.signatureRequestId?.trim();
  let send = requestedId
    ? findEsignSendBySignatureRequestId(bundle, requestedId)
    : pickPendingEsignSend(bundle.sends);

  if (!send?.sentAt) {
    return {
      ok: false,
      code: "not_pending",
      message: "No pending eSign documents for this deal",
    };
  }

  const sigId = send.signatureRequestId?.trim() ?? "";

  if (send.completedAt?.trim()) {
    return {
      ok: true,
      alreadyCompleted: true,
      signUrl: null,
      clientId: publicCfg.clientId,
      testMode: publicCfg.testMode,
      configured: publicCfg.configured,
      signatureRequestId: sigId || null,
    };
  }

  const signatureId = await resolveSignatureIdForSend(send);
  if (!signatureId) {
    return {
      ok: false,
      code: "not_pending",
      message: "Could not resolve your eSign signing session. Ask your sponsor to resend.",
    };
  }

  try {
    const { signUrl } = await getEmbeddedSignUrl(signatureId);
    return {
      ok: true,
      alreadyCompleted: false,
      signUrl,
      clientId: publicCfg.clientId,
      testMode: publicCfg.testMode,
      configured: publicCfg.configured,
      signatureRequestId: sigId || null,
    };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not load signing session";
    return { ok: false, code: "not_pending", message: msg };
  }
}
