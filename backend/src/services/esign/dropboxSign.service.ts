import { randomUUID } from "node:crypto";
import { requireDropboxSignConfig } from "../../config/dropboxSign.config.js";

const DROPBOX_SIGN_API_BASE = "https://api.hellosign.com/v3";

const DEFAULT_TEMPLATE_SIGNER_ROLES: DropboxSignSignerRole[] = [
  { name: "Investor", order: 0 },
  { name: "Sponsor", order: 1 },
];

/** Basic auth header: API key as username, empty password (Dropbox Sign convention). */
function authorizationHeader(apiKey: string): string {
  const token = Buffer.from(`${apiKey}:`, "utf8").toString("base64");
  return `Basic ${token}`;
}

export type DropboxSignSignerRole = {
  name: string;
  order: number;
};

export type DropboxSignCustomField = {
  name: string;
  type: "text" | "checkbox";
  signerIndex?: number;
  required?: boolean;
};

/** Field placement for POST /template/create (`form_fields_per_document`). */
export type DropboxSignFormFieldPerDocument = {
  documentIndex: number;
  apiId: string;
  type: "signature" | "text" | "date_signed" | "initials";
  signer: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  required?: boolean;
  name?: string;
  placeholder?: string;
};

export type CreateDropboxSignTemplateParams = {
  title: string;
  fileBuffer: Buffer;
  fileName: string;
  signerRoles?: DropboxSignSignerRole[];
  formFieldsPerDocument?: DropboxSignFormFieldPerDocument[];
  /** Detect AcroForm fields already in the PDF. */
  usePreexistingFields?: boolean;
  message?: string;
  subject?: string;
};

export type CreateDropboxSignTemplateResult = {
  templateId: string;
};

export type CreateEmbeddedTemplateDraftParams = {
  title: string;
  /** PDF bytes sent as multipart `file[0]` to Dropbox Sign. */
  fileBuffer: Buffer;
  fileName: string;
  signerRoles?: DropboxSignSignerRole[];
  message?: string;
  subject?: string;
  /** Pre-defined fields (e.g. investor questionnaire) for signer 0. */
  customFields?: DropboxSignCustomField[];
  formFieldsPerDocument?: DropboxSignFormFieldPerDocument[];
  usePreexistingFields?: boolean;
};

export type EmbeddedTemplateDraftResult = {
  templateId: string;
  editUrl: string;
  expiresAt: number;
};

export type EmbeddedTemplateEditUrlResult = {
  editUrl: string;
  expiresAt: number;
};

type DropboxSignErrorBody = {
  error?: {
    error_name?: string;
    error_msg?: string;
  };
};

/** True when Dropbox Sign reports a missing template or signature request. */
export function isDropboxSignNotFoundError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /not_found/i.test(msg) || /template not found/i.test(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseDropboxSignError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as DropboxSignErrorBody;
    const msg = body.error?.error_msg?.trim();
    const name = body.error?.error_name?.trim();
    if (msg && name) return `${name}: ${msg}`;
    if (msg) return msg;
  } catch {
    /* ignore */
  }
  return `Dropbox Sign API error (${res.status})`;
}

function appendSignerRoles(form: FormData, roles: DropboxSignSignerRole[]): void {
  roles.forEach((role, index) => {
    form.append(`signer_roles[${index}][name]`, role.name);
    form.append(`signer_roles[${index}][order]`, String(role.order));
  });
}

function appendFormFieldPerDocument(
  form: FormData,
  index: number,
  field: DropboxSignFormFieldPerDocument,
): void {
  const p = `form_fields_per_document[${index}]`;
  form.append(`${p}[document_index]`, String(field.documentIndex));
  form.append(`${p}[api_id]`, field.apiId);
  form.append(`${p}[type]`, field.type);
  form.append(`${p}[signer]`, field.signer);
  form.append(`${p}[x]`, String(field.x));
  form.append(`${p}[y]`, String(field.y));
  form.append(`${p}[width]`, String(field.width));
  form.append(`${p}[height]`, String(field.height));
  form.append(`${p}[page]`, String(field.page));
  form.append(`${p}[required]`, field.required !== false ? "1" : "0");
  if (field.name) form.append(`${p}[name]`, field.name);
  if (field.placeholder) form.append(`${p}[placeholder]`, field.placeholder);
}

/** Starter fields so template/create succeeds; sponsor adjusts in embedded editor. */
export function buildDefaultFormFieldsForSignerRoles(
  roles: DropboxSignSignerRole[],
  customFields?: DropboxSignCustomField[],
): DropboxSignFormFieldPerDocument[] {
  const fields: DropboxSignFormFieldPerDocument[] = [];
  let y = 620;

  for (const role of roles) {
    const order = role.order;
    fields.push({
      documentIndex: 0,
      apiId: `sig_${order}_${randomUUID().slice(0, 8)}`,
      type: "signature",
      signer: String(order),
      x: 72,
      y,
      width: 220,
      height: 44,
      page: 1,
      required: true,
      name: `${role.name} signature`,
    });
    y -= 70;
  }

  let textY = 120;
  for (const cf of customFields ?? []) {
    const signer = String(cf.signerIndex ?? 0);
    fields.push({
      documentIndex: 0,
      apiId: `txt_${randomUUID().slice(0, 8)}`,
      type: "text",
      signer,
      x: 72,
      y: textY,
      width: 280,
      height: 20,
      page: 1,
      required: Boolean(cf.required),
      name: cf.name,
      placeholder: cf.name,
    });
    textY += 36;
  }

  return fields;
}

/**
 * Creates a reusable Dropbox Sign template via POST /v3/template/create.
 * With `client_id`, the template is embedded and can be edited via `/embedded/edit_url`.
 *
 * @see https://developers.hellosign.com/api/template/create
 */
export async function createDropboxSignTemplate(
  params: CreateDropboxSignTemplateParams,
): Promise<CreateDropboxSignTemplateResult> {
  const { apiKey, clientId, testMode } = requireDropboxSignConfig();

  const roles =
    params.signerRoles?.length ? params.signerRoles : DEFAULT_TEMPLATE_SIGNER_ROLES;

  const formFields =
    params.formFieldsPerDocument?.length ?
      params.formFieldsPerDocument
    : params.usePreexistingFields
      ? []
    : buildDefaultFormFieldsForSignerRoles(roles);

  if (!params.usePreexistingFields && formFields.length === 0) {
    throw new Error("At least one form field is required for template/create");
  }

  const form = new FormData();
  form.append("client_id", clientId);
  form.append("test_mode", testMode ? "1" : "0");
  form.append("title", params.title);
  if (params.subject) form.append("subject", params.subject);
  if (params.message) form.append("message", params.message);
  if (params.usePreexistingFields) {
    form.append("use_preexisting_fields", "1");
  }

  appendSignerRoles(form, roles);
  formFields.forEach((field, index) => {
    appendFormFieldPerDocument(form, index, field);
  });

  const blob = new Blob([new Uint8Array(params.fileBuffer)], {
    type: "application/pdf",
  });
  form.append(
    "file[0]",
    blob,
    params.fileName.endsWith(".pdf") ? params.fileName : `${params.fileName}.pdf`,
  );

  const res = await fetch(`${DROPBOX_SIGN_API_BASE}/template/create`, {
    method: "POST",
    headers: { Authorization: authorizationHeader(apiKey) },
    body: form,
  });

  if (!res.ok) {
    throw new Error(await parseDropboxSignError(res));
  }

  const data = (await res.json()) as {
    template?: { template_id?: string };
  };

  const templateId = data.template?.template_id?.trim();
  if (!templateId) {
    throw new Error("Dropbox Sign returned an incomplete template/create response");
  }

  return { templateId };
}

/**
 * Embedded template draft — required for the iframe field editor (placeholder popup).
 * `/embedded/edit_url` only works reliably for templates from this endpoint.
 *
 * @see https://developers.hellosign.com/api/template/create-embedded-draft
 */
async function createEmbeddedTemplateDraftViaEmbeddedApi(
  params: CreateEmbeddedTemplateDraftParams,
): Promise<EmbeddedTemplateDraftResult> {
  const { apiKey, clientId, testMode } = requireDropboxSignConfig();

  const form = new FormData();
  form.append("client_id", clientId);
  form.append("test_mode", testMode ? "1" : "0");
  form.append("title", params.title);
  if (params.subject) form.append("subject", params.subject);
  if (params.message) form.append("message", params.message);

  const roles =
    params.signerRoles?.length ? params.signerRoles : DEFAULT_TEMPLATE_SIGNER_ROLES;
  appendSignerRoles(form, roles);

  const customFields = params.customFields ?? [];
  customFields.forEach((field, index) => {
    form.append(`custom_fields[${index}][name]`, field.name);
    form.append(`custom_fields[${index}][type]`, field.type);
    form.append(
      `custom_fields[${index}][signer]`,
      String(field.signerIndex ?? 0),
    );
    form.append(
      `custom_fields[${index}][required]`,
      field.required ? "1" : "0",
    );
  });

  const formFields = params.formFieldsPerDocument ?? [];
  if (params.usePreexistingFields) {
    form.append("use_preexisting_fields", "1");
  }
  formFields.forEach((field, index) => {
    appendFormFieldPerDocument(form, index, field);
  });

  const blob = new Blob([new Uint8Array(params.fileBuffer)], {
    type: "application/pdf",
  });
  form.append(
    "file[0]",
    blob,
    params.fileName.endsWith(".pdf") ? params.fileName : `${params.fileName}.pdf`,
  );

  const res = await fetch(
    `${DROPBOX_SIGN_API_BASE}/template/create_embedded_draft`,
    {
      method: "POST",
      headers: { Authorization: authorizationHeader(apiKey) },
      body: form,
    },
  );

  if (!res.ok) {
    throw new Error(await parseDropboxSignError(res));
  }

  const data = (await res.json()) as {
    template?: {
      template_id?: string;
      edit_url?: string;
      expires_at?: number;
    };
  };

  const templateId = data.template?.template_id?.trim();
  const editUrl = data.template?.edit_url?.trim();
  const expiresAt = data.template?.expires_at;

  if (!templateId || !editUrl || typeof expiresAt !== "number") {
    throw new Error("Dropbox Sign returned an incomplete embedded draft response");
  }

  return { templateId, editUrl, expiresAt };
}

/**
 * Opens the embedded field editor: uses create_embedded_draft (returns edit_url).
 * POST /template/create alone does not support the placeholder iframe editor.
 */
export async function createEmbeddedTemplateDraft(
  params: CreateEmbeddedTemplateDraftParams,
): Promise<EmbeddedTemplateDraftResult> {
  return createEmbeddedTemplateDraftViaEmbeddedApi(params);
}

/**
 * Polls until `/embedded/edit_url` succeeds (e.g. after async template/create).
 */
export async function waitForEmbeddedTemplateEditUrl(
  templateId: string,
  options?: { maxAttempts?: number; delayMs?: number },
): Promise<EmbeddedTemplateEditUrlResult> {
  const maxAttempts = options?.maxAttempts ?? 30;
  const delayMs = options?.delayMs ?? 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await tryGetEmbeddedTemplateEditUrl(templateId);
    if (result) return result;
    if (attempt < maxAttempts) await sleep(delayMs);
  }

  throw new Error(
    `Dropbox Sign template ${templateId} is not ready for the field editor. Try again shortly.`,
  );
}

/**
 * Returns a fresh `edit_url` for an existing embedded template (re-open field editor).
 *
 * @see https://developers.hellosign.com/api/embedded/edit-url
 */
export async function getEmbeddedTemplateEditUrl(
  templateId: string,
): Promise<EmbeddedTemplateEditUrlResult> {
  const { apiKey, clientId, testMode } = requireDropboxSignConfig();

  const res = await fetch(
    `${DROPBOX_SIGN_API_BASE}/embedded/edit_url/${encodeURIComponent(templateId)}`,
    {
      method: "POST",
      headers: {
        Authorization: authorizationHeader(apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        test_mode: testMode,
        client_id: clientId,
      }),
    },
  );

  if (!res.ok) {
    throw new Error(await parseDropboxSignError(res));
  }

  const data = (await res.json()) as {
    embedded?: { edit_url?: string; expires_at?: number };
  };

  const editUrl = data.embedded?.edit_url?.trim();
  const expiresAt = data.embedded?.expires_at;

  if (!editUrl || typeof expiresAt !== "number") {
    throw new Error("Dropbox Sign returned an incomplete embedded edit URL response");
  }

  return { editUrl, expiresAt };
}

/**
 * Returns a fresh edit URL, or `null` when the template id no longer exists in Dropbox Sign.
 */
export async function tryGetEmbeddedTemplateEditUrl(
  templateId: string,
): Promise<EmbeddedTemplateEditUrlResult | null> {
  try {
    return await getEmbeddedTemplateEditUrl(templateId);
  } catch (err) {
    if (isDropboxSignNotFoundError(err)) return null;
    throw err;
  }
}

export type CreateEmbeddedSignatureFromTemplatesParams = {
  templateIds: string[];
  signerEmail: string;
  signerName: string;
  signerRole?: string;
  title: string;
  subject?: string;
  message?: string;
  metadata?: Record<string, string>;
};

export type EmbeddedSignatureFromTemplatesResult = {
  signatureRequestId: string;
  signatureId: string;
  signUrl: string;
  expiresAt: number;
};

/**
 * Embedded signing flow for investors (no duplicate Dropbox email).
 *
 * @see https://developers.hellosign.com/api/reference/create-embedded-signature-request-with-template
 */
export async function createEmbeddedSignatureRequestWithTemplates(
  params: CreateEmbeddedSignatureFromTemplatesParams,
): Promise<EmbeddedSignatureFromTemplatesResult> {
  const { apiKey, clientId, testMode } = requireDropboxSignConfig();
  const templateIds = params.templateIds.map((t) => t.trim()).filter(Boolean);
  if (templateIds.length === 0) {
    throw new Error("At least one Dropbox Sign template id is required");
  }

  const form = new FormData();
  form.append("client_id", clientId);
  form.append("test_mode", testMode ? "1" : "0");
  form.append("title", params.title);
  if (params.subject) form.append("subject", params.subject);
  if (params.message) form.append("message", params.message);
  templateIds.forEach((id, i) => {
    form.append(`template_ids[${i}]`, id);
  });
  form.append("signers[0][email_address]", params.signerEmail.trim());
  form.append("signers[0][name]", params.signerName.trim() || params.signerEmail.trim());
  form.append(
    "signers[0][role]",
    params.signerRole?.trim() || "Investor",
  );
  for (const [key, value] of Object.entries(params.metadata ?? {})) {
    const k = key.trim();
    const v = value.trim();
    if (k && v) form.append(`metadata[${k}]`, v);
  }

  const res = await fetch(
    `${DROPBOX_SIGN_API_BASE}/signature_request/create_embedded_with_template`,
    {
      method: "POST",
      headers: { Authorization: authorizationHeader(apiKey) },
      body: form,
    },
  );

  if (!res.ok) {
    throw new Error(await parseDropboxSignError(res));
  }

  const data = (await res.json()) as {
    signature_request?: {
      signature_request_id?: string;
      signatures?: Array<{ signature_id?: string }>;
    };
  };

  const signatureRequestId =
    data.signature_request?.signature_request_id?.trim() ?? "";
  const signatureId =
    data.signature_request?.signatures?.[0]?.signature_id?.trim() ?? "";
  if (!signatureRequestId || !signatureId) {
    throw new Error(
      "Dropbox Sign returned an incomplete embedded signature request",
    );
  }

  // @see https://developers.hellosign.com/api/embedded/sign-url — GET, not POST
  const { signUrl, expiresAt } = await getEmbeddedSignUrl(signatureId);

  return { signatureRequestId, signatureId, signUrl, expiresAt };
}

export type EmbeddedSignUrlResult = {
  signUrl: string;
  expiresAt: number;
};

/**
 * Fresh embedded sign URL for a signer (valid ~60 minutes; regenerate per visit).
 *
 * @see https://developers.hellosign.com/api/embedded/sign-url
 */
export async function getEmbeddedSignUrl(
  signatureId: string,
): Promise<EmbeddedSignUrlResult> {
  const { apiKey } = requireDropboxSignConfig();
  const id = signatureId.trim();
  if (!id) throw new Error("signature_id is required");

  const signUrlRes = await fetch(
    `${DROPBOX_SIGN_API_BASE}/embedded/sign_url/${encodeURIComponent(id)}`,
    {
      method: "GET",
      headers: { Authorization: authorizationHeader(apiKey) },
    },
  );

  if (!signUrlRes.ok) {
    throw new Error(await parseDropboxSignError(signUrlRes));
  }

  const signData = (await signUrlRes.json()) as {
    embedded?: { sign_url?: string; expires_at?: number };
  };
  const signUrl = signData.embedded?.sign_url?.trim() ?? "";
  const expiresAt = signData.embedded?.expires_at;
  if (!signUrl || typeof expiresAt !== "number") {
    throw new Error("Dropbox Sign returned an incomplete embedded sign URL");
  }

  return { signUrl, expiresAt };
}

/** First signer signature id on an existing embedded signature request. */
export async function getFirstSignatureIdFromRequest(
  signatureRequestId: string,
): Promise<string | null> {
  const { apiKey } = requireDropboxSignConfig();
  const id = signatureRequestId.trim();
  if (!id) return null;

  const res = await fetch(
    `${DROPBOX_SIGN_API_BASE}/signature_request/${encodeURIComponent(id)}`,
    { headers: { Authorization: authorizationHeader(apiKey) } },
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    signature_request?: {
      signatures?: Array<{ signature_id?: string }>;
    };
  };
  return data.signature_request?.signatures?.[0]?.signature_id?.trim() ?? null;
}

export type DropboxSignatureRequestSummary = {
  signatureRequestId: string;
  isComplete: boolean;
  isDeclined: boolean;
  lastViewedAt: string | null;
  lastSignedAt: string | null;
};

export type DropboxSignatureSignerDetail = {
  signatureId: string | null;
  signerName: string | null;
  signerEmail: string | null;
  statusCode: string | null;
  lastViewedAt: string | null;
  signedAt: string | null;
};

export type DropboxSignatureRequestDetail = DropboxSignatureRequestSummary & {
  createdAt: string | null;
  completeAt: string | null;
  signers: DropboxSignatureSignerDetail[];
};

function dropboxUnixToIso(value: number | null | undefined): string | null {
  if (typeof value !== "number" || value <= 0) return null;
  return new Date(value * 1000).toISOString();
}

function latestIso(dates: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  let bestMs = -1;
  for (const d of dates) {
    const s = d?.trim();
    if (!s) continue;
    const ms = new Date(s).getTime();
    if (!Number.isNaN(ms) && ms > bestMs) {
      bestMs = ms;
      best = s;
    }
  }
  return best;
}

/** Full signature request state from Dropbox Sign (viewed / signed / complete per signer). */
export async function getSignatureRequestDetail(
  signatureRequestId: string,
): Promise<DropboxSignatureRequestDetail> {
  const { apiKey } = requireDropboxSignConfig();
  const res = await fetch(
    `${DROPBOX_SIGN_API_BASE}/signature_request/${encodeURIComponent(signatureRequestId)}`,
    {
      headers: { Authorization: authorizationHeader(apiKey) },
    },
  );
  if (!res.ok) {
    throw new Error(await parseDropboxSignError(res));
  }

  const data = (await res.json()) as {
    signature_request?: {
      signature_request_id?: string;
      is_complete?: boolean;
      is_declined?: boolean;
      created_at?: number | null;
      signatures?: Array<{
        signature_id?: string;
        signer_name?: string;
        signer_email_address?: string;
        last_viewed_at?: number | null;
        signed_at?: number | null;
        status_code?: string;
      }>;
    };
  };
  const sr = data.signature_request;
  const signers: DropboxSignatureSignerDetail[] = (sr?.signatures ?? []).map(
    (sig) => ({
      signatureId: sig.signature_id?.trim() ?? null,
      signerName: sig.signer_name?.trim() ?? null,
      signerEmail: sig.signer_email_address?.trim() ?? null,
      statusCode: sig.status_code?.trim() ?? null,
      lastViewedAt: dropboxUnixToIso(sig.last_viewed_at),
      signedAt: dropboxUnixToIso(sig.signed_at),
    }),
  );

  const lastViewedAt = latestIso(signers.map((s) => s.lastViewedAt));
  const lastSignedAt = latestIso(signers.map((s) => s.signedAt));
  const isComplete = Boolean(sr?.is_complete);
  const completeAt = isComplete ? lastSignedAt : null;

  return {
    signatureRequestId: sr?.signature_request_id?.trim() ?? signatureRequestId,
    isComplete,
    isDeclined: Boolean(sr?.is_declined),
    createdAt: dropboxUnixToIso(sr?.created_at),
    completeAt,
    signers,
    lastViewedAt,
    lastSignedAt,
  };
}

export async function getSignatureRequestSummary(
  signatureRequestId: string,
): Promise<DropboxSignatureRequestSummary> {
  const detail = await getSignatureRequestDetail(signatureRequestId);
  return {
    signatureRequestId: detail.signatureRequestId,
    isComplete: detail.isComplete,
    isDeclined: detail.isDeclined,
    lastViewedAt: detail.lastViewedAt,
    lastSignedAt: detail.lastSignedAt,
  };
}

function parseDropboxSignFileUrlResponse(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const root = body as { file_url?: string; file?: { file_url?: string } };
  const url =
    root.file_url?.trim() || root.file?.file_url?.trim() || null;
  return url || null;
}

/** Downloads the combined signed PDF directly from Dropbox Sign. */
export async function downloadSignatureRequestPdfBuffer(
  signatureRequestId: string,
): Promise<Buffer> {
  const { apiKey } = requireDropboxSignConfig();
  const res = await fetch(
    `${DROPBOX_SIGN_API_BASE}/signature_request/files/${encodeURIComponent(signatureRequestId)}?file_type=pdf`,
    {
      headers: { Authorization: authorizationHeader(apiKey) },
    },
  );
  if (!res.ok) {
    throw new Error(await parseDropboxSignError(res));
  }
  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  if (contentType.includes("application/json")) {
    const data = (await res.json()) as unknown;
    const url = parseDropboxSignFileUrlResponse(data);
    if (!url) throw new Error("Dropbox Sign did not return signed PDF data");
    return downloadUrlToBuffer(url);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Returns a temporary URL to download the combined signed PDF. */
export async function getSignatureRequestFilesDownloadUrl(
  signatureRequestId: string,
): Promise<string> {
  const { apiKey } = requireDropboxSignConfig();
  const res = await fetch(
    `${DROPBOX_SIGN_API_BASE}/signature_request/files_as_file_url/${encodeURIComponent(signatureRequestId)}`,
    {
      headers: { Authorization: authorizationHeader(apiKey) },
    },
  );
  if (!res.ok) {
    throw new Error(await parseDropboxSignError(res));
  }
  const data = (await res.json()) as unknown;
  const url = parseDropboxSignFileUrlResponse(data);
  if (!url) throw new Error("Dropbox Sign did not return a download URL");
  return url;
}

export async function downloadUrlToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download signed document (${res.status})`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
