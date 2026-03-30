import nodemailer from "nodemailer";

/**
 * Nodemailer transporter from env:
 * - EMAIL_SERVICE_TYPE: `gmail` | `office365` | `smtp`
 * - For gmail / office365: SENDER_EMAIL_ID, SENDER_EMAIL_PASSWORD
 * - For smtp: SMTP_HOST (required), SMTP_PORT (default 587), SMTP_SECURE (true|false),
 *   optional SENDER_EMAIL_ID + SENDER_EMAIL_PASSWORD if the server requires auth
 */
const emailConfig = () => {
  const EMAIL_SERVICE = process.env.EMAIL_SERVICE_TYPE?.trim().toLowerCase();
  const user = process.env.SENDER_EMAIL_ID?.trim();
  const pass = process.env.SENDER_EMAIL_PASSWORD?.trim();

  if (EMAIL_SERVICE === "smtp") {
    const host = process.env.SMTP_HOST?.trim();
    if (!host) {
      throw new Error(
        "When EMAIL_SERVICE_TYPE=smtp, SMTP_HOST must be set (e.g. smtp.sendgrid.net).",
      );
    }
    const portRaw = process.env.SMTP_PORT?.trim();
    const port = portRaw ? Number.parseInt(portRaw, 10) : 587;
    const secure = process.env.SMTP_SECURE?.trim().toLowerCase() === "true";
    return nodemailer.createTransport({
      host,
      port: Number.isFinite(port) ? port : 587,
      secure,
      ...(user && pass ? { auth: { user, pass } } : {}),
    });
  }

  if (!user || !pass) {
    throw new Error(
      "SENDER_EMAIL_ID and SENDER_EMAIL_PASSWORD must be set to send email (or use EMAIL_SERVICE_TYPE=smtp with SMTP_HOST and optional auth).",
    );
  }

  if (EMAIL_SERVICE === "gmail") {
    return nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user, pass },
    });
  }

  if (EMAIL_SERVICE === "office365") {
    return nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false,
      auth: { user, pass },
    });
  }

  throw new Error(
    "Unsupported EMAIL_SERVICE_TYPE. Use 'gmail', 'office365', or 'smtp'.",
  );
};

export default emailConfig;
