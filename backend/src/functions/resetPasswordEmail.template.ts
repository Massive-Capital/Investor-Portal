/** HTML body for the password-reset email (inline styles for common clients). */
export function buildResetPasswordEmailHtml(resetLink: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reset your password</title>
<style>
  body { font-family: Arial, sans-serif; margin:0; padding:0; background:#f4f6f8; color:#333333; }
  .container { max-width: 600px; margin: 20px auto; padding: 30px; background: #ffffff; border-radius: 8px; color:#333333; }
  h1 { color: #2463eb; }
  p { font-size:16px; line-height:1.5; color:#333333; }
  .button-container { margin:20px 0; }
  .confirm-button { background-color: #2463eb; color:#ffffff; padding:14px 28px; border-radius:6px; text-decoration:none; font-weight:bold; display:inline-block; }
  .footer { font-size:12px; color:#666666; margin-top:20px; text-align:center; }
</style>
</head>
<body style="font-family: Arial, sans-serif; margin:0; padding:0; background:#f4f6f8; color:#333333;">
<div class="container" style="max-width: 600px; margin: 20px auto; padding: 30px; background: #ffffff; border-radius: 8px; color:#333333;">
  <h1 style="color: #2463eb;">Reset your password</h1>
  <p style="font-size:16px; line-height:1.5; color:#333333;">You requested a password reset for your Investor Portal account. Click the button below to choose a new password.</p>
  <div class="button-container" style="margin:20px 0;">
    <a href="${resetLink}" class="confirm-button" style="background-color: #2463eb; color:#ffffff; padding:14px 28px; border-radius:6px; text-decoration:none; font-weight:bold; display:inline-block;">Reset Password</a>
  </div>
  <p style="font-size:16px; line-height:1.5; color:#333333;">This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>
  <p style="font-size:16px; line-height:1.5; color:#333333;">Thanks,<br>The Investor Portal Team</p>
  <div class="footer" style="font-size:12px; color:#666666; margin-top:20px; text-align:center;">&copy; 2026 Investor Portal LLC. All rights reserved.</div>
</div>
</body>
</html>`;
}
