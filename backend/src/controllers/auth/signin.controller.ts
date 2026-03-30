import type { Request, Response } from "express";
import { signInWithPassword } from "../../services/auth.service.js";

type SigninBody = {
  emailOrUsername?: unknown;
  password?: unknown;
};

export async function postSignin(req: Request, res: Response): Promise<void> {
  const body = req.body as SigninBody;
  const emailOrUsername =
    typeof body.emailOrUsername === "string" ? body.emailOrUsername : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!emailOrUsername.trim()) {
    res.status(401).json({ message: "Email or username is required" });
    return;
  }
  if (!password) {
    res.status(401).json({ message: "Password is required" });
    return;
  }

  const result = await signInWithPassword(emailOrUsername, password);

  if (!result.ok) {
    const status =
      result.message === "An error occurred during login. Please try again."
        ? 500
        : 401;
    res.status(status).json({ message: result.message });
    return;
  }

  res.status(200).json({
    message: result.message,
    token: result.token,
    userDetails: result.userDetails,
  });
}

