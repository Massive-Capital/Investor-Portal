import type { Request, Response } from "express";
import {
  registerUser,
  type SignupBody,
} from "../../services/signup.service.js";

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
