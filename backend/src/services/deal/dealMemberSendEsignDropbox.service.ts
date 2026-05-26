import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as nodePath from "node:path";
import { and, eq } from "drizzle-orm";
import { getUploadsPhysicalRoot } from "../../config/uploadPaths.js";
import { db } from "../../database/db.js";
import { dealInvestment } from "../../schema/deal.schema/deal-investment.schema.js";
import { getDropboxSignConfig } from "../../config/dropboxSign.config.js";
import type { DealInvestorEsignDocumentRef } from "../../constants/deal-investor-esign-status.js";
import {
  createEmbeddedSignatureRequestWithFile,
  createEmbeddedSignatureRequestWithTemplates,
  getDropboxSignTemplateFormFieldsForEmbeddedFile,
  type DropboxSignFormFieldPerDocument,
  type DropboxSignPrefillCustomField,
} from "../esign/dropboxSign.service.js";
import { getDealInvestorQuestionnaireState } from "./dealInvestorQuestionnaire.service.js";
import {
  buildInvestorQuestionnaireAnswersPdf,
  countPdfPages,
} from "./investorQuestionnaireAnswersPdf.service.js";
import {
  normalizeInvestorQuestionnaireAnswersInput,
  readInvestorQuestionnaireAnswersForTarget,
  type InvestorQuestionnaireAnswersMap,
} from "./investorQuestionnaireAnswers.service.js";
import {
  ensureEsignTemplatePdfPrepared,
  getDealEsignTemplatesState,
  isPdfEsignFile,
  type EsignTemplateFileRecord,
} from "./dealEsignTemplates.service.js";
import {
  getInvestorQuestionnaireSignatureFormFields,
  prependPdfBuffers,
  replaceW9AppendixWithFilled,
  appendW9ToPdfBuffer,
} from "./esignPdfMerge.service.js";
import {
  normalizeInvestorW9FormInput,
  readInvestorW9FormForTarget,
  type InvestorW9FormData,
} from "./investorW9Form.service.js";
import { applyQuestionnairePrefillToEsignFormFields } from "./investorQuestionnaireEsignPrefill.service.js";
import type { InvestorEsignRowTarget } from "./dealMemberEsignStatus.service.js";
import {
  DEAL_ESIGN_PREVIEW_FOLDER,
  dealAssetsRelativePath,
  resolveDealStorageFolderName,
  sanitizeStoragePathSegment,
} from "./dealStoragePaths.service.js";

export type CreateInvestorSignatureRequestResult = {
  signatureRequestId: string;
  signatureId: string;
  signUrl: string;
  /** Merged questionnaire + template PDF for View/Download while pending. */
  investorPreviewRelativePath?: string;
};

function safeRosterSegment(raw: string): string {
  return sanitizeStoragePathSegment(raw, 64) || "investor";
}

/** Saved copy of the file sent to Dropbox (includes questionnaire pages when merged). */
async function persistInvestorEsignPreviewPdf(params: {
  dealId: string;
  rosterId: string;
  buffer: Buffer;
  fileName: string;
}): Promise<string> {
  const dealFolder = await resolveDealStorageFolderName(params.dealId);
  const rosterFolder = safeRosterSegment(params.rosterId);
  const base = params.fileName.trim() || "esign-preview.pdf";
  const fileName = base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
  const relativePath = dealAssetsRelativePath(
    dealFolder,
    DEAL_ESIGN_PREVIEW_FOLDER,
    rosterFolder,
    fileName.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 120),
  );
  const abs = nodePath.join(getUploadsPhysicalRoot(), relativePath);
  await mkdir(nodePath.dirname(abs), { recursive: true });
  await writeFile(abs, params.buffer);
  return relativePath;
}

/** Use merged preview path on document rows so View shows questionnaire + template. */
export function applyInvestorPreviewToEsignDocuments(
  documents: DealInvestorEsignDocumentRef[],
  previewRelativePath: string | undefined,
): DealInvestorEsignDocumentRef[] {
  const rel = previewRelativePath?.trim();
  if (!rel) return documents;
  return documents.map((d) => ({
    ...d,
    templateRelativePath: rel,
  }));
}

/**
 * Creates an embedded Dropbox Sign request for the selected ready templates.
 * When the template includes the investor questionnaire and answers exist,
 * prepends a PDF of responses before the prepared template (signature page + subscription).
 */
export async function createInvestorSignatureRequest(params: {
  dealId: string;
  rosterId: string;
  toEmail: string;
  memberDisplayName?: string;
  dealName: string;
  selectedFiles: EsignTemplateFileRecord[];
  esignTarget?: InvestorEsignRowTarget | null;
  commitmentProfileId?: string;
  questionnaireAnswers?: InvestorQuestionnaireAnswersMap | null;
  w9FormData?: InvestorW9FormData | null;
  /** Stored on Dropbox metadata for webhook → `investment_signatures`. */
  investmentId?: string;
  investorId?: string;
}): Promise<CreateInvestorSignatureRequestResult | null> {
  if (!getDropboxSignConfig()) return null;

  const templateIds = params.selectedFiles
    .map((f) => f.dropboxSignTemplateId?.trim() ?? "")
    .filter(Boolean);
  if (templateIds.length === 0) {
    throw new Error("Selected documents are missing Dropbox Sign template ids");
  }

  const signerEmail = params.toEmail.trim().toLowerCase();
  const signerName = params.memberDisplayName?.trim() || signerEmail;
  const dealLabel = params.dealName.trim() || "Deal";
  const requestMetadata: Record<string, string> = {
    deal_id: params.dealId,
    roster_id: params.rosterId,
  };
  const investmentId = params.investmentId?.trim();
  const investorId = params.investorId?.trim();
  if (investmentId) requestMetadata.investment_id = investmentId;
  if (investorId) requestMetadata.investor_id = investorId;

  const assembled = await assembleInvestorSigningPdf(params);
  let investorPreviewRelativePath: string | undefined;
  if (assembled?.savePreview) {
    try {
      investorPreviewRelativePath = await persistInvestorEsignPreviewPdf({
        dealId: params.dealId,
        rosterId: params.rosterId,
        buffer: assembled.buffer,
        fileName: assembled.fileName,
      });
    } catch (err) {
      console.warn("persistInvestorEsignPreviewPdf:", err);
    }
  }

  if (assembled?.needsCustomDropboxFile) {
    const { formFields, customFields } = await resolveInvestorEsignFormFields({
      dealId: params.dealId,
      templateId: assembled.templateId,
      answerPageCount: assembled.answerPageCount,
      questionnaireAnswers: assembled.answers,
      memberDisplayName: params.memberDisplayName,
    });

    if (formFields.length === 0) {
      console.warn(
        `[esign] No sponsor template fields loaded for deal ${params.dealId}; using Dropbox template signing`,
      );
      const result = await createEmbeddedSignatureRequestWithTemplates({
        templateIds,
        signerEmail,
        signerName,
        title: `eSign — ${dealLabel}`,
        subject: `Please sign — ${dealLabel}`,
        message: `Please review and sign the documents for ${dealLabel}.`,
        metadata: requestMetadata,
        customFields,
      });
      return {
        signatureRequestId: result.signatureRequestId,
        signatureId: result.signatureId,
        signUrl: result.signUrl,
        investorPreviewRelativePath,
      };
    }

    const result = await createEmbeddedSignatureRequestWithFile({
      fileBuffer: assembled.buffer,
      fileName: assembled.fileName,
      signerEmail,
      signerName,
      title: `eSign — ${dealLabel}`,
      subject: `Please sign — ${dealLabel}`,
      message: `Please review and sign the documents for ${dealLabel}.`,
      metadata: requestMetadata,
      formFieldsPerDocument: formFields,
      customFields,
      usePreexistingFields: false,
    });
    return {
      signatureRequestId: result.signatureRequestId,
      signatureId: result.signatureId,
      signUrl: result.signUrl,
      investorPreviewRelativePath,
    };
  }

  const customFields = await resolveQuestionnairePrefillCustomFields(params);

  const result = await createEmbeddedSignatureRequestWithTemplates({
    templateIds,
    signerEmail,
    signerName,
    title: `eSign — ${dealLabel}`,
    subject: `Please sign — ${dealLabel}`,
    message: `Please review and sign the documents for ${dealLabel}.`,
    metadata: requestMetadata,
    customFields,
  });

  return {
    signatureRequestId: result.signatureRequestId,
    signatureId: result.signatureId,
    signUrl: result.signUrl,
    investorPreviewRelativePath,
  };
}

async function resolveInvestorW9FormData(params: {
  dealId: string;
  esignTarget?: InvestorEsignRowTarget | null;
  w9FormData?: InvestorW9FormData | null;
}): Promise<InvestorW9FormData | null> {
  const fromBody = normalizeInvestorW9FormInput(params.w9FormData);
  if (fromBody) return fromBody;
  if (!params.esignTarget) return null;
  return readInvestorW9FormForTarget(params.dealId, params.esignTarget);
}

/** Text-merge prefill when signing via Dropbox template (unmodified PDF). */
async function resolveQuestionnairePrefillCustomFields(params: {
  dealId: string;
  selectedFiles: EsignTemplateFileRecord[];
  esignTarget?: InvestorEsignRowTarget | null;
  questionnaireAnswers?: InvestorQuestionnaireAnswersMap | null;
  memberDisplayName?: string;
}): Promise<DropboxSignPrefillCustomField[]> {
  if (params.selectedFiles.length !== 1) return [];

  const answers = normalizeInvestorQuestionnaireAnswersInput(
    params.questionnaireAnswers ??
      (params.esignTarget
        ? await readInvestorQuestionnaireAnswersForTarget(
            params.dealId,
            params.esignTarget,
          )
        : null),
  );
  if (!answers || !Object.keys(answers).length) return [];

  const templateId = params.selectedFiles[0].dropboxSignTemplateId?.trim();
  if (!templateId) return [];

  let templateFields: DropboxSignFormFieldPerDocument[] = [];
  try {
    templateFields = await getDropboxSignTemplateFormFieldsForEmbeddedFile(
      templateId,
      { pageOffset: 0 },
    );
  } catch (err) {
    console.warn(
      `[esign] Could not load template fields for questionnaire prefill (${templateId}):`,
      err,
    );
    return [];
  }

  const config = await getDealInvestorQuestionnaireState(params.dealId);
  const { customFields } = await applyQuestionnairePrefillToEsignFormFields({
    formFields: templateFields,
    config,
    answers,
    memberDisplayName: params.memberDisplayName,
  });
  return customFields;
}

async function resolveInvestorEsignFormFields(params: {
  dealId: string;
  templateId: string;
  answerPageCount: number;
  questionnaireAnswers?: InvestorQuestionnaireAnswersMap | null;
  memberDisplayName?: string;
}): Promise<{
  formFields: DropboxSignFormFieldPerDocument[];
  customFields: DropboxSignPrefillCustomField[];
}> {
  const questionnaireFields =
    params.answerPageCount > 0
      ? getInvestorQuestionnaireSignatureFormFields(params.answerPageCount)
      : [];

  let templateFields: DropboxSignFormFieldPerDocument[] = [];
  try {
    templateFields = await getDropboxSignTemplateFormFieldsForEmbeddedFile(
      params.templateId,
      { pageOffset: params.answerPageCount },
    );
  } catch (err) {
    console.warn(
      `[esign] Could not load Dropbox template fields for ${params.templateId}:`,
      err,
    );
  }

  const seen = new Set<string>();
  const formFields: DropboxSignFormFieldPerDocument[] = [];
  /** Sponsor template positions win over built-in questionnaire defaults. */
  for (const field of [...templateFields, ...questionnaireFields]) {
    const key = field.apiId.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    formFields.push(field);
  }

  const answers = normalizeInvestorQuestionnaireAnswersInput(
    params.questionnaireAnswers,
  );
  if (!answers || !Object.keys(answers).length) {
    return { formFields, customFields: [] };
  }

  const config = await getDealInvestorQuestionnaireState(params.dealId);
  return applyQuestionnairePrefillToEsignFormFields({
    formFields,
    config,
    answers,
    memberDisplayName: params.memberDisplayName,
  });
}

/**
 * Builds the investor-facing PDF (questionnaire answers, filled W-9, template body).
 * Saved for sponsor/investor View while pending; sent to Dropbox only when structurally merged.
 */
async function assembleInvestorSigningPdf(params: {
  dealId: string;
  selectedFiles: EsignTemplateFileRecord[];
  esignTarget?: InvestorEsignRowTarget | null;
  commitmentProfileId?: string;
  questionnaireAnswers?: InvestorQuestionnaireAnswersMap | null;
  w9FormData?: InvestorW9FormData | null;
  dealName: string;
  memberDisplayName?: string;
}): Promise<{
  buffer: Buffer;
  fileName: string;
  templateId: string;
  answerPageCount: number;
  answers: InvestorQuestionnaireAnswersMap | null;
  needsCustomDropboxFile: boolean;
  savePreview: boolean;
} | null> {
  if (params.selectedFiles.length !== 1) return null;

  const file = params.selectedFiles[0];
  if (!isPdfEsignFile(file)) return null;

  const templateId = file.dropboxSignTemplateId?.trim();
  if (!templateId) return null;

  let answers =
    params.questionnaireAnswers ??
    (params.esignTarget
      ? await readInvestorQuestionnaireAnswersForTarget(
          params.dealId,
          params.esignTarget,
        )
      : null);
  answers = normalizeInvestorQuestionnaireAnswersInput(answers);

  const w9Data = await resolveInvestorW9FormData({
    dealId: params.dealId,
    esignTarget: params.esignTarget,
    w9FormData: params.w9FormData,
  });

  const profileId = await resolveCommitmentProfileId(
    params.dealId,
    params.esignTarget,
    params.commitmentProfileId,
  );

  const prependQuestionnaireAnswers =
    Boolean(file.includeQuestionnaire) &&
    Boolean(answers && Object.keys(answers).length) &&
    Boolean(profileId);

  const needsCustomDropboxFile = prependQuestionnaireAnswers || Boolean(w9Data);
  const savePreview = needsCustomDropboxFile;

  const esignState = await getDealEsignTemplatesState(params.dealId);
  const { absolutePath } = await ensureEsignTemplatePdfPrepared(
    params.dealId,
    file,
    esignState,
  );
  let buffer: Buffer = Buffer.from(await readFile(absolutePath));

  let answerPageCount = 0;
  if (prependQuestionnaireAnswers && answers && profileId) {
    const config = await getDealInvestorQuestionnaireState(params.dealId);
    const answersPdf = await buildInvestorQuestionnaireAnswersPdf({
      config,
      answers,
      commitmentProfileId: profileId,
      dealName: params.dealName,
      investorName: params.memberDisplayName,
    });
    answerPageCount = await countPdfPages(answersPdf);
    const merged = await prependPdfBuffers(buffer, [answersPdf]);
    if (!merged.prepended) return null;
    buffer = Buffer.from(merged.buffer);
  }

  if (w9Data) {
    if (file.includesW9Appendix) {
      buffer = Buffer.from(await replaceW9AppendixWithFilled(buffer, w9Data));
    } else {
      const appended = await appendW9ToPdfBuffer(buffer, w9Data);
      buffer = Buffer.from(appended.buffer);
    }
  }

  const suffix = prependQuestionnaireAnswers
    ? "-with-questionnaire"
    : w9Data
      ? "-with-w9"
      : "";
  return {
    buffer,
    fileName: file.originalName.replace(/\.pdf$/i, "") + `${suffix}.pdf`,
    templateId,
    answerPageCount,
    answers,
    needsCustomDropboxFile,
    savePreview,
  };
}

async function resolveCommitmentProfileId(
  dealId: string,
  target: InvestorEsignRowTarget | null | undefined,
  override?: string,
): Promise<string | null> {
  const fromOverride = override?.trim();
  if (fromOverride) return fromOverride;
  if (!target || target.table !== "investment") return null;
  const [row] = await db
    .select({ profileId: dealInvestment.profileId })
    .from(dealInvestment)
    .where(
      and(
        eq(dealInvestment.id, target.id),
        eq(dealInvestment.dealId, dealId),
      ),
    )
    .limit(1);
  const p = String(row?.profileId ?? "").trim();
  return p || null;
}

export function esignTemplateDisplayNameForFile(
  file: EsignTemplateFileRecord,
): string {
  return (
    file.templateName?.trim() ||
    file.dropboxSignTitle?.trim() ||
    file.originalName?.trim() ||
    "Document"
  );
}

export function esignDocumentsFromSelectedFiles(
  files: EsignTemplateFileRecord[],
): DealInvestorEsignDocumentRef[] {
  return files.map((f) => ({
    fileId: f.id,
    name: esignTemplateDisplayNameForFile(f),
    categoryId: f.categoryId,
    templateRelativePath: f.relativePath,
  }));
}
