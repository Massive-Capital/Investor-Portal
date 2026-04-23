import type { Request, Response } from "express";
import { findContactByEmailForSignupPrefill } from "../../services/contact.service.js";
import { findSignupPrefillForDealAndEmail } from "../../services/signupPrefillDeal.service.js";
import {
  registerUser,
  type SignupBody,
} from "../../services/signup.service.js";

/**
 * Public: prefill first/last/phone/(username) for signup.
 * - Optional `dealId` (query): when present, load from this deal’s roster (LP investors,
 *   members, investments) for the invited email; otherwise same as before — CRM `contact` by email.
 */
export async function getSignupPrefill(req: Request, res: Response): Promise<void> {
  const raw = req.query.email;
  const email = typeof raw === "string" ? raw.trim() : "";
  const rawDeal = req.query.dealId;
  const dealId = typeof rawDeal === "string" ? rawDeal.trim() : "";
  if (!email || !email.includes("@")) {
    res.status(400).json({ message: "A valid email is required.", found: false });
    return;
  }
  try {
    if (dealId) {
      const fromDeal = await findSignupPrefillForDealAndEmail(email, dealId);
      if (fromDeal) {
        res.status(200).json({
          found: true,
          firstName: fromDeal.firstName,
          lastName: fromDeal.lastName,
          phone: fromDeal.phone,
          userName: fromDeal.userName || undefined,
        });
        return;
      }
    }
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
