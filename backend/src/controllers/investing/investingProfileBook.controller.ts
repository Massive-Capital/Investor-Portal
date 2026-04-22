import type { Request, Response } from "express";
import { getJwtUser } from "../../middleware/jwtUser.js";
import {
  createBeneficiaryForUser,
  createInvestorProfileForUser,
  createSavedAddressForUser,
  getProfileBookForUser,
  setBeneficiaryArchived,
  setInvestorProfileArchived,
  setSavedAddressArchived,
  updateBeneficiaryForUser,
  updateInvestorProfileForUser,
  updateSavedAddressForUser,
} from "../../services/investingProfileBook.service.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return typeof s === "string" && UUID_RE.test(s.trim());
}

function requireUser(req: Request, res: Response): string | null {
  const jwtUser = getJwtUser(req);
  if (!jwtUser?.id) {
    res.status(401).json({ message: "Authorization required" });
    return null;
  }
  return jwtUser.id;
}

export async function getMyProfileBook(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const snapshot = await getProfileBookForUser(userId);
    res.status(200).json(snapshot);
  } catch (err) {
    console.error("getMyProfileBook:", err);
    res.status(500).json({ message: "Could not load profile data. Please try again." });
  }
}

export async function postMyProfileBookProfile(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) return;
  const body = req.body as { profileName?: unknown; profileType?: unknown };
  const profileName = typeof body.profileName === "string" ? body.profileName : "";
  const profileType = typeof body.profileType === "string" ? body.profileType : "";
  try {
    const row = await createInvestorProfileForUser(userId, { profileName, profileType });
    if (!row) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.status(201).json({ profile: row });
  } catch (err) {
    console.error("postMyProfileBookProfile:", err);
    res.status(500).json({ message: "Could not save profile. Please try again." });
  }
}

export async function patchMyProfileBookProfile(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) return;
  const id = String(req.params.id ?? "");
  if (!isUuid(id)) {
    res.status(400).json({ message: "Invalid id" });
    return;
  }
  const body = req.body as { archived?: unknown };
  if (typeof body.archived !== "boolean") {
    res.status(400).json({ message: "Field archived (boolean) is required" });
    return;
  }
  try {
    const row = await setInvestorProfileArchived(userId, id, body.archived);
    if (!row) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }
    res.status(200).json({ profile: row });
  } catch (err) {
    console.error("patchMyProfileBookProfile:", err);
    res.status(500).json({ message: "Could not update profile. Please try again." });
  }
}

export async function putMyProfileBookProfile(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) return;
  const id = String(req.params.id ?? "");
  if (!isUuid(id)) {
    res.status(400).json({ message: "Invalid id" });
    return;
  }
  const body = req.body as { profileName?: unknown; profileType?: unknown };
  const profileName = typeof body.profileName === "string" ? body.profileName : "";
  const profileType = typeof body.profileType === "string" ? body.profileType : "";
  if (!profileName.trim()) {
    res.status(400).json({ message: "Profile name is required" });
    return;
  }
  try {
    const row = await updateInvestorProfileForUser(userId, id, { profileName, profileType });
    if (!row) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }
    res.status(200).json({ profile: row });
  } catch (err) {
    console.error("putMyProfileBookProfile:", err);
    res.status(500).json({ message: "Could not update profile. Please try again." });
  }
}

export async function postMyProfileBookBeneficiary(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) return;
  const body = req.body as Record<string, unknown>;
  const input = {
    fullName: typeof body.fullName === "string" ? body.fullName : "",
    relationship: typeof body.relationship === "string" ? body.relationship : "",
    taxId: typeof body.taxId === "string" ? body.taxId : "",
    phone: typeof body.phone === "string" ? body.phone : "",
    email: typeof body.email === "string" ? body.email : "",
    addressQuery: typeof body.addressQuery === "string" ? body.addressQuery : "",
  };
  try {
    const row = await createBeneficiaryForUser(userId, input);
    if (!row) {
      res.status(500).json({ message: "Could not create beneficiary" });
      return;
    }
    res.status(201).json({ beneficiary: row });
  } catch (err) {
    console.error("postMyProfileBookBeneficiary:", err);
    res.status(500).json({ message: "Could not save beneficiary. Please try again." });
  }
}

export async function patchMyProfileBookBeneficiary(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) return;
  const id = String(req.params.id ?? "");
  if (!isUuid(id)) {
    res.status(400).json({ message: "Invalid id" });
    return;
  }
  const body = req.body as { archived?: unknown };
  if (typeof body.archived !== "boolean") {
    res.status(400).json({ message: "Field archived (boolean) is required" });
    return;
  }
  try {
    const row = await setBeneficiaryArchived(userId, id, body.archived);
    if (!row) {
      res.status(404).json({ message: "Beneficiary not found" });
      return;
    }
    res.status(200).json({ beneficiary: row });
  } catch (err) {
    console.error("patchMyProfileBookBeneficiary:", err);
    res.status(500).json({ message: "Could not update beneficiary. Please try again." });
  }
}

export async function putMyProfileBookBeneficiary(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) return;
  const id = String(req.params.id ?? "");
  if (!isUuid(id)) {
    res.status(400).json({ message: "Invalid id" });
    return;
  }
  const body = req.body as Record<string, unknown>;
  const input = {
    fullName: typeof body.fullName === "string" ? body.fullName : "",
    relationship: typeof body.relationship === "string" ? body.relationship : "",
    taxId: typeof body.taxId === "string" ? body.taxId : "",
    phone: typeof body.phone === "string" ? body.phone : "",
    email: typeof body.email === "string" ? body.email : "",
    addressQuery: typeof body.addressQuery === "string" ? body.addressQuery : "",
  };
  try {
    const row = await updateBeneficiaryForUser(userId, id, input);
    if (!row) {
      res.status(404).json({ message: "Beneficiary not found" });
      return;
    }
    res.status(200).json({ beneficiary: row });
  } catch (err) {
    console.error("putMyProfileBookBeneficiary:", err);
    res.status(500).json({ message: "Could not update beneficiary. Please try again." });
  }
}

export async function postMyProfileBookAddress(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) return;
  const body = req.body as Record<string, unknown>;
  const input = {
    fullNameOrCompany:
      typeof body.fullNameOrCompany === "string" ? body.fullNameOrCompany : "",
    country: typeof body.country === "string" ? body.country : "",
    street1: typeof body.street1 === "string" ? body.street1 : "",
    street2: typeof body.street2 === "string" ? body.street2 : "",
    city: typeof body.city === "string" ? body.city : "",
    state: typeof body.state === "string" ? body.state : "",
    zip: typeof body.zip === "string" ? body.zip : "",
    checkMemo: typeof body.checkMemo === "string" ? body.checkMemo : "",
    distributionNote:
      typeof body.distributionNote === "string" ? body.distributionNote : "",
  };
  try {
    const row = await createSavedAddressForUser(userId, input);
    if (!row) {
      res.status(500).json({ message: "Could not create address" });
      return;
    }
    res.status(201).json({ address: row });
  } catch (err) {
    console.error("postMyProfileBookAddress:", err);
    res.status(500).json({ message: "Could not save address. Please try again." });
  }
}

export async function patchMyProfileBookAddress(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) return;
  const id = String(req.params.id ?? "");
  if (!isUuid(id)) {
    res.status(400).json({ message: "Invalid id" });
    return;
  }
  const body = req.body as { archived?: unknown };
  if (typeof body.archived !== "boolean") {
    res.status(400).json({ message: "Field archived (boolean) is required" });
    return;
  }
  try {
    const row = await setSavedAddressArchived(userId, id, body.archived);
    if (!row) {
      res.status(404).json({ message: "Address not found" });
      return;
    }
    res.status(200).json({ address: row });
  } catch (err) {
    console.error("patchMyProfileBookAddress:", err);
    res.status(500).json({ message: "Could not update address. Please try again." });
  }
}

export async function putMyProfileBookAddress(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) return;
  const id = String(req.params.id ?? "");
  if (!isUuid(id)) {
    res.status(400).json({ message: "Invalid id" });
    return;
  }
  const body = req.body as Record<string, unknown>;
  const input = {
    fullNameOrCompany:
      typeof body.fullNameOrCompany === "string" ? body.fullNameOrCompany : "",
    country: typeof body.country === "string" ? body.country : "",
    street1: typeof body.street1 === "string" ? body.street1 : "",
    street2: typeof body.street2 === "string" ? body.street2 : "",
    city: typeof body.city === "string" ? body.city : "",
    state: typeof body.state === "string" ? body.state : "",
    zip: typeof body.zip === "string" ? body.zip : "",
    checkMemo: typeof body.checkMemo === "string" ? body.checkMemo : "",
    distributionNote:
      typeof body.distributionNote === "string" ? body.distributionNote : "",
  };
  try {
    const row = await updateSavedAddressForUser(userId, id, input);
    if (!row) {
      res.status(404).json({ message: "Address not found" });
      return;
    }
    res.status(200).json({ address: row });
  } catch (err) {
    console.error("putMyProfileBookAddress:", err);
    res.status(500).json({ message: "Could not update address. Please try again." });
  }
}
