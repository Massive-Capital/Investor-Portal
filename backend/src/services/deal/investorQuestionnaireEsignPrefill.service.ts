import type { DropboxSignFormFieldPerDocument } from "../esign/dropboxSign.service.js";
import type { DropboxSignPrefillCustomField } from "../esign/dropboxSign.service.js";
import { formatEinDisplay, nineDigitsFromEinInput } from "../../common/tax/usEin.js";
import type {
  InvestorQuestionnaireJson,
  InvestorQuestionnaireQuestion,
} from "./dealInvestorQuestionnaire.service.js";
import type { InvestorQuestionnaireAnswersMap } from "./investorQuestionnaireAnswers.service.js";

function normalizeFieldKey(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

/** Dropbox field labels / api ids that receive a computed full name. */
const COMPUTED_FULL_NAME_FIELD_KEYS = new Set(
  [
    "print name",
    "fullname1",
    "investor name",
    "name",
    "subscriber name",
    "signer name",
  ].map((s) => normalizeFieldKey(s)),
);

/**
 * Extra aliases for sponsor-placed fields whose label does not match question id.
 * Keys are normalized field keys; values are questionnaire question ids.
 */
const FIELD_KEY_TO_QUESTION_ID: Record<string, string> = {
  [normalizeFieldKey("First Name")]: "first_name",
  [normalizeFieldKey("Last Name")]: "last_name",
  [normalizeFieldKey("Telephone")]: "telephone",
  [normalizeFieldKey("Phone")]: "telephone",
  [normalizeFieldKey("Address")]: "address",
  [normalizeFieldKey("Mailing Address")]: "address",
  [normalizeFieldKey("SSN")]: "social_security_number",
  [normalizeFieldKey("Social Security Number")]: "social_security_number",
  [normalizeFieldKey("Birth Date")]: "birth_date",
  [normalizeFieldKey("Date of Birth")]: "birth_date",
  [normalizeFieldKey("Entity Legal Name")]: "entity_full_legal_name",
  [normalizeFieldKey("Entity Name")]: "entity_full_legal_name",
};

function formatAnswerForEsign(
  question: InvestorQuestionnaireQuestion,
  raw: string | undefined,
): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";

  if (question.fieldType === "boolean") {
    if (value === "yes") return "Yes";
    if (value === "no") return "No";
    return value;
  }

  if (question.fieldType === "checkboxes") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        const items = parsed.filter((v): v is string => typeof v === "string");
        return items.join(", ");
      }
    } catch {
      /* use raw */
    }
    return value;
  }

  if (question.fieldType === "phone") {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 10) {
      return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return value;
  }

  if (question.fieldType === "ssn") {
    const digits = value.replace(/\D/g, "").slice(0, 9);
    if (digits.length === 9) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
    }
    return value;
  }

  if (
    question.fieldType === "ein" ||
    question.id === "ira_entity_custodian_ein" ||
    question.id === "ira_entity_partner_ein"
  ) {
    const digits = nineDigitsFromEinInput(value);
    if (digits.length === 9) return formatEinDisplay(digits);
    return value;
  }

  return value.replace(/\s+/g, " ").trim();
}

function buildFormattedAnswerMap(
  config: InvestorQuestionnaireJson,
  answers: InvestorQuestionnaireAnswersMap,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const question of config.questions) {
    const id = question.id.trim();
    if (!id) continue;
    const formatted = formatAnswerForEsign(question, answers[id]);
    if (formatted) out.set(id, formatted);
  }
  return out;
}

function resolveFullName(
  formatted: Map<string, string>,
  memberDisplayName?: string,
): string {
  const fromParts = [formatted.get("first_name"), formatted.get("last_name")]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fromParts) return fromParts;
  return String(memberDisplayName ?? "").trim();
}

function resolveValueForFieldKey(
  fieldKey: string,
  formatted: Map<string, string>,
  memberDisplayName?: string,
): string {
  if (COMPUTED_FULL_NAME_FIELD_KEYS.has(fieldKey)) {
    return resolveFullName(formatted, memberDisplayName);
  }

  const questionId = FIELD_KEY_TO_QUESTION_ID[fieldKey] ?? fieldKey.replace(/\s+/g, "_");
  if (formatted.has(questionId)) {
    return formatted.get(questionId) ?? "";
  }

  for (const [qid, value] of formatted.entries()) {
    if (normalizeFieldKey(qid) === fieldKey) return value;
  }

  return "";
}

function customFieldNameForFormField(
  field: DropboxSignFormFieldPerDocument,
): string {
  const name = String(field.name ?? "").trim();
  if (name) return name;
  return String(field.apiId ?? "").trim();
}

export type QuestionnaireEsignPrefillResult = {
  formFields: DropboxSignFormFieldPerDocument[];
  customFields: DropboxSignPrefillCustomField[];
};

/**
 * Matches Dropbox Sign template / questionnaire signature fields to questionnaire
 * answers and returns merge-field custom_field values for embedded signing.
 */
export function applyQuestionnairePrefillToEsignFormFields({
  formFields,
  config,
  answers,
  memberDisplayName,
}: {
  formFields: DropboxSignFormFieldPerDocument[];
  config: InvestorQuestionnaireJson;
  answers: InvestorQuestionnaireAnswersMap;
  memberDisplayName?: string;
}): QuestionnaireEsignPrefillResult {
  const formatted = buildFormattedAnswerMap(config, answers);
  if (!formatted.size && !memberDisplayName?.trim()) {
    return { formFields, customFields: [] };
  }

  const customFields: DropboxSignPrefillCustomField[] = [];
  const seenNames = new Set<string>();

  const nextFields = formFields.map((field) => {
    if (field.type !== "text" && field.type !== "text-merge") {
      return field;
    }

    const fieldName = customFieldNameForFormField(field);
    if (!fieldName) return field;

    const fieldKey = normalizeFieldKey(fieldName);
    const apiKey = normalizeFieldKey(field.apiId);
    const value =
      resolveValueForFieldKey(fieldKey, formatted, memberDisplayName) ||
      resolveValueForFieldKey(apiKey, formatted, memberDisplayName);
    if (!value) return field;

    const customName = fieldName;
    if (!seenNames.has(customName.toLowerCase())) {
      seenNames.add(customName.toLowerCase());
      customFields.push({ name: customName, value });
    }

    return { ...field, type: "text-merge" as const };
  });

  return { formFields: nextFields, customFields };
}
