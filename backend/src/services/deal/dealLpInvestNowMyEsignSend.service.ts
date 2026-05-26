import {
  findEsignSendForCategoryAndFiles,
  parseEsignStatusBundle,
} from "../../constants/deal-investor-esign-status.js";
import { getDropboxSignConfig } from "../../config/dropboxSign.config.js";
import { getAddDealFormById } from "./dealForm.service.js";
import {
  dealHasEsignTemplateDocuments,
  getDealEsignTemplatesState,
  type EsignTemplateFileRecord,
} from "./dealEsignTemplates.service.js";
import {
  normalizeInvestorQuestionnaireAnswersInput,
} from "./investorQuestionnaireAnswers.service.js";
import { normalizeInvestorW9FormInput } from "./investorW9Form.service.js";
import {
  findInvestorEsignTargetForInvestNowCommitment,
  markDealInvestorEsignPending,
  readInvestorEsignStatusJson,
} from "./dealMemberEsignStatus.service.js";
import {
  recordInvestmentSignatureOnCreate,
  resolveInvestmentIdForEsignTarget,
} from "../investment/investmentSignature.service.js";
import {
  applyInvestorPreviewToEsignDocuments,
  createInvestorSignatureRequest,
  esignDocumentsFromSelectedFiles,
  esignTemplateDisplayNameForFile,
} from "./dealMemberSendEsignDropbox.service.js";

const LP_COMMITMENT_PROFILE_IDS = new Set([
  "individual",
  "custodian_ira_401k",
  "joint_tenancy",
  "llc_corp_trust_etc",
]);

function esignCategoryFromProfileId(profileId: string): string | null {
  const p = profileId.trim();
  if (!p || !LP_COMMITMENT_PROFILE_IDS.has(p)) return null;
  if (p === "llc_corp_trust_etc") return "llc";
  return p;
}

function readyFilesForCategory(
  files: EsignTemplateFileRecord[],
  categoryId: string,
): EsignTemplateFileRecord[] {
  return files.filter(
    (f) =>
      f.categoryId === categoryId &&
      f.dropboxSignStatus === "ready" &&
      Boolean(f.dropboxSignTemplateId?.trim()),
  );
}

export type SendMyInvestNowEsignResult =
  | {
      ok: true;
      alreadySent: boolean;
      alreadyCompleted: boolean;
      signatureRequestId: string | null;
      investmentId: string | null;
      documentNames: string[];
    }
  | { ok: false; message: string };

async function ensureInvestmentSignatureTracked(params: {
  dealId: string;
  target: { table: "investment" | "lp"; id: string };
  viewerUserId: string;
  signatureRequestId: string;
  signUrl?: string | null;
  dropboxResponse?: unknown;
}): Promise<string | null> {
  const investmentId = await resolveInvestmentIdForEsignTarget(
    params.dealId,
    params.target,
  );
  if (!investmentId) return null;

  await recordInvestmentSignatureOnCreate({
    investmentId,
    investorId: params.viewerUserId,
    signatureRequestId: params.signatureRequestId,
    signUrl: params.signUrl,
    dropboxResponse: params.dropboxResponse,
  });
  return investmentId;
}

/**
 * Creates a Dropbox Sign request for the signed-in investor's profile template
 * during Invest Now (no sponsor action required).
 */
export async function sendMyInvestNowEsignIfNeeded(params: {
  dealId: string;
  viewerEmail: string;
  viewerUserId: string;
  profileId: string;
  memberDisplayName?: string;
  questionnaireAnswers?: Record<string, string> | null;
  w9Form?: unknown;
}): Promise<SendMyInvestNowEsignResult> {
  const dealId = params.dealId.trim();
  const email = params.viewerEmail.trim().toLowerCase();
  const categoryId = esignCategoryFromProfileId(params.profileId);
  if (!categoryId) {
    return { ok: false, message: "Invalid investor profile for eSign" };
  }

  if (!getDropboxSignConfig()) {
    return {
      ok: false,
      message:
        "Dropbox Sign is not configured. Your sponsor must enable eSign before you can sign documents here.",
    };
  }

  const esignState = await getDealEsignTemplatesState(dealId);
  if (!dealHasEsignTemplateDocuments(esignState)) {
    return {
      ok: false,
      message:
        "No eSign documents are uploaded for this deal yet. Contact your sponsor.",
    };
  }

  const selectedFiles = readyFilesForCategory(esignState.files, categoryId);
  if (selectedFiles.length === 0) {
    return {
      ok: false,
      message:
        "No Dropbox Sign template is ready for your investor profile on this deal. Ask your sponsor to complete the eSign template setup.",
    };
  }

  const target = await findInvestorEsignTargetForInvestNowCommitment(dealId, {
    email,
    userId: params.viewerUserId,
  });
  if (!target) {
    return {
      ok: false,
      message:
        "Save your investment commitment first, then return to sign documents.",
    };
  }

  const raw = await readInvestorEsignStatusJson(dealId, target);
  const bundle = parseEsignStatusBundle(raw);
  const investmentIdForTarget = await resolveInvestmentIdForEsignTarget(
    dealId,
    target,
  );

  const selectedIds = new Set(selectedFiles.map((f) => f.id));
  const existingSend = bundle
    ? findEsignSendForCategoryAndFiles(bundle, categoryId, selectedIds)
    : null;

  if (existingSend?.sentAt?.trim()) {
    const sigId = existingSend.signatureRequestId?.trim() ?? "";
    const completed = Boolean(existingSend.completedAt?.trim());
    if (sigId) {
      await ensureInvestmentSignatureTracked({
        dealId,
        target,
        viewerUserId: params.viewerUserId,
        signatureRequestId: sigId,
      });
    }
    return {
      ok: true,
      alreadySent: true,
      alreadyCompleted: completed,
      signatureRequestId: sigId || null,
      investmentId: investmentIdForTarget,
      documentNames: selectedFiles.map((f) => esignTemplateDisplayNameForFile(f)),
    };
  }

  const deal = await getAddDealFormById(dealId);
  const dealName = deal?.dealName?.trim() || "Deal";
  const rosterId = target.id;

  let signatureRequestId: string | undefined;
  let signatureId: string | undefined;
  let investorPreviewRelativePath: string | undefined;
  let createResult: Awaited<
    ReturnType<typeof createInvestorSignatureRequest>
  > = null;
  try {
    const sig = await createInvestorSignatureRequest({
      dealId,
      rosterId,
      toEmail: email,
      memberDisplayName: params.memberDisplayName?.trim() || undefined,
      dealName,
      selectedFiles,
      esignTarget: target,
      commitmentProfileId: params.profileId,
      questionnaireAnswers: normalizeInvestorQuestionnaireAnswersInput(
        params.questionnaireAnswers,
      ),
      w9FormData: normalizeInvestorW9FormInput(params.w9Form) ?? undefined,
      investmentId: investmentIdForTarget ?? undefined,
      investorId: params.viewerUserId,
    });
    if (!sig) {
      return {
        ok: false,
        message: "Could not create Dropbox Sign signature request",
      };
    }
    createResult = sig;
    signatureRequestId = sig.signatureRequestId;
    signatureId = sig.signatureId;
    investorPreviewRelativePath = sig.investorPreviewRelativePath;
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Could not create Dropbox Sign signature request";
    return { ok: false, message: msg };
  }

  await markDealInvestorEsignPending(dealId, {
    rosterId,
    toEmail: email,
    documents: applyInvestorPreviewToEsignDocuments(
      esignDocumentsFromSelectedFiles(selectedFiles),
      investorPreviewRelativePath,
    ),
    signatureRequestId,
    signatureId,
  });

  let trackedInvestmentId = investmentIdForTarget;
  if (signatureRequestId) {
    trackedInvestmentId =
      (await ensureInvestmentSignatureTracked({
        dealId,
        target,
        viewerUserId: params.viewerUserId,
        signatureRequestId,
        signUrl: createResult?.signUrl,
        dropboxResponse: createResult,
      })) ?? investmentIdForTarget;
  }

  return {
    ok: true,
    alreadySent: false,
    alreadyCompleted: false,
    signatureRequestId: signatureRequestId ?? null,
    investmentId: trackedInvestmentId,
    documentNames: selectedFiles.map((f) => esignTemplateDisplayNameForFile(f)),
  };
}
