import { getDropboxSignConfig } from "../../config/dropboxSign.config.js";
import type { DealInvestorEsignDocumentRef } from "../../constants/deal-investor-esign-status.js";
import type { EsignTemplateFileRecord } from "./dealEsignTemplates.service.js";
import { createEmbeddedSignatureRequestWithTemplates } from "../esign/dropboxSign.service.js";

export type CreateInvestorSignatureRequestResult = {
  signatureRequestId: string;
  signatureId: string;
  signUrl: string;
};

/**
 * Creates an embedded Dropbox Sign request for the selected ready templates.
 */
export async function createInvestorSignatureRequest(params: {
  dealId: string;
  rosterId: string;
  toEmail: string;
  memberDisplayName?: string;
  dealName: string;
  selectedFiles: EsignTemplateFileRecord[];
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

  const result = await createEmbeddedSignatureRequestWithTemplates({
    templateIds,
    signerEmail,
    signerName,
    title: `eSign — ${dealLabel}`,
    subject: `Please sign — ${dealLabel}`,
    message: `Please review and sign the documents for ${dealLabel}.`,
    metadata: {
      deal_id: params.dealId,
      roster_id: params.rosterId,
    },
  });

  return {
    signatureRequestId: result.signatureRequestId,
    signatureId: result.signatureId,
    signUrl: result.signUrl,
  };
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
