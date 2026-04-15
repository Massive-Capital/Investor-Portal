import type { Request, Response } from "express";
import { findContactByEmailForSignupPrefill } from "../../services/contact.service.js";
import {
  registerUser,
  type SignupBody,
} from "../../services/signup.service.js";

/** Public: prefill first/last/phone from CRM `contact` when the email matches. */
export async function getSignupPrefill(req: Request, res: Response): Promise<void> {
  const raw = req.query.email;
  const email = typeof raw === "string" ? raw.trim() : "";
  if (!email || !email.includes("@")) {
    res.status(400).json({ message: "A valid email is required.", found: false });
    return;
  }
  try {
    const row = await findContactByEmailForSignupPrefill(email);
    if (!row) {
      res.status(200).json({ found: false });
      return;
    }
    res.status(200).json({
      found: true,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
    });
  } catch (err) {
    console.error("getSignupPrefill:", err);
    res.status(500).json({ message: "Could not load prefill.", found: false });
  }
}

export async function postSignup(req: Request, res: Response): Promise<void> {
  const token =
    typeof req.params.token === "string" ? req.params.token : undefined;
  const result = await registerUser(token, req.body as SignupBody);

  if (!result.ok) {
    res.status(result.status).json({ message: result.message });
    return;
  }

  res.status(201).json({
    message: result.message,
  });
}
