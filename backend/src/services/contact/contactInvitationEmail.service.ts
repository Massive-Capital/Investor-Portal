import { eq } from "drizzle-orm";
import { db } from "../../database/db.js";
import { companies } from "../../schema/schema.js";
import type { ContactRow } from "../../schema/contact.schema.js";
import { createInviteForEmail } from "../auth/invite.service.js";
import { sendInviteSignupEmail } from "../auth/inviteEmail.service.js";

export function sendInvitationMailRequested(
  raw: string | null | undefined,
): boolean {
  return String(raw ?? "").trim().toLowerCase() === "yes";
}

export function contactInvitationEmailBlockReason(
  row: Pick<
    ContactRow,
    | "invitationEmailSent"
    | "isPortalUser"
    | "platformAdminOnly"
    | "status"
    | "email"
  >,
): string | null {
  if (Boolean(row.invitationEmailSent)) {
    return "An invitation email has already been sent to this contact";
  }
  if (Boolean(row.isPortalUser) || Boolean(row.platformAdminOnly)) {
    return "This contact already has a portal account";
  }
  if (String(row.status ?? "active").trim().toLowerCase() === "suspended") {
    return "Activate this contact before sending an invitation email";
  }
  const email = String(row.email ?? "").trim().toLowerCase();
  if (!email.includes("@")) {
    return "A valid email is required to send an invitation";
  }
  return null;
}

export function contactCanSendInvitationEmail(
  row: Pick<
    ContactRow,
    | "invitationEmailSent"
    | "isPortalUser"
    | "platformAdminOnly"
    | "status"
    | "email"
  >,
): boolean {
  return contactInvitationEmailBlockReason(row) == null;
}

/**
 * Optional portal signup invitation after creating a CRM contact.
 * Does not create a pending `users` row, so the contact stays on All Contacts
 * until they complete signup.
 */
export async function sendContactInvitationEmailIfRequested(params: {
  sendInvitationMail: string;
  email: string;
  organizationId: string | null | undefined;
  skipBecausePortalUser: boolean;
}): Promise<"sent" | "skipped" | "failed"> {
  if (!sendInvitationMailRequested(params.sendInvitationMail)) return "skipped";
  if (params.skipBecausePortalUser) return "skipped";

  const email = params.email.trim().toLowerCase();
  if (!email.includes("@")) return "skipped";

  let companyName: string | null = null;
  const orgId = params.organizationId?.trim() || null;
  if (orgId) {
    const [co] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, orgId))
      .limit(1);
    companyName = co?.name?.trim() || null;
  }

  const invite = createInviteForEmail(
    email,
    orgId ? { companyId: orgId, companyName } : null,
  );
  if (!invite.ok) {
    console.warn(
      "sendContactInvitationEmailIfRequested: could not build invite",
      invite.message,
    );
    return "failed";
  }

  const sent = await sendInviteSignupEmail(
    email,
    invite.signupUrl,
    invite.expiresIn,
  );
  if (!sent.ok) {
    console.warn(
      "sendContactInvitationEmailIfRequested: send failed",
      sent.error,
    );
    return "failed";
  }
  return "sent";
}
