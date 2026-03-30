import type { Request } from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/auth.js";

export type JwtUserPayload = {
  id?: string;
  email?: string;
  userRole?: string;
};

export function bearerToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h || typeof h !== "string") return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m?.[1]?.trim() || null;
}

export function getJwtUser(req: Request): JwtUserPayload | null {
  const token = bearerToken(req);
  if (!token) return null;
  try {
    return jwt.verify(token, getJwtSecret()) as JwtUserPayload;
  } catch {
    return null;
  }
}
