import type { Request, Response } from "express";
import { getJwtUser } from "../middleware/jwtUser.js";
import {
  ContactScopeConflictError,
  countDealInvestmentsByContactIdForViewer,
  getUserDisplayNameById,
  insertContact,
  listContactsForViewer,
  patchContactStatusForViewer,
  updateContactFieldsForViewer,
} from "../services/contact.service.js";
import type { ContactRow } from "../schema/contact.schema.js";

function paramStr(v: string | string[] | undefined): string {
  if (v == null) return "";
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" ? s.trim() : "";
}

function bodyString(v: unknown): string {
  return typeof v === "string" ? v : v != null ? String(v) : "";
}

function bodyStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

function dedupeOwnersPreserveOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of items) {
    const t = x.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function mapContactToJson(row: ContactRow) {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    note: row.note,
    tags: row.tags ?? [],
    lists: row.lists ?? [],
    owners: row.owners ?? [],
    /** Internal — prefer `createdByDisplayName` in UI */
    createdBy: row.createdBy,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
    status: row.status ?? "active",
    lastEditReason: row.lastEditReason?.trim() || undefined,
  };
}

async function mapContactToJsonWithNames(
  row: ContactRow,
  dealCounts?: Map<string, number>,
) {
  const base = mapContactToJson(row);
  const { createdBy: _createdBy, ...rest } = base;
  const createdByDisplayName = (
    await getUserDisplayNameById(row.createdBy)
  ).trim();
  const idKey = String(row.id).trim().toLowerCase();
  const dealCount = dealCounts?.get(idKey) ?? 0;
  return {
    ...rest,
    createdByDisplayName: createdByDisplayName || undefined,
    dealCount,
  };
}

export async function getContacts(
  req: Request,
  res: Response,
): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }
  try {
    const rows = await listContactsForViewer(user.id, user.userRole);
    const contactIds = rows.map((r) => String(r.id));
    const dealCounts = await countDealInvestmentsByContactIdForViewer({
      viewerUserId: user.id,
      jwtUserRole: user.userRole,
      contactIds,
    });
    const contacts = await Promise.all(
      rows.map((r) => mapContactToJsonWithNames(r, dealCounts)),
    );
    res.status(200).json({ contacts });
  } catch (err) {
    console.error("getContacts:", err);
    res.status(500).json({ message: "Could not load contacts" });
  }
}

export async function postContact(req: Request, res: Response): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }

  const b = req.body as Record<string, unknown>;
  const firstName = bodyString(b.first_name || b.firstName).trim();
  const lastName = bodyString(b.last_name || b.lastName).trim();
  const email = bodyString(b.email).trim();
  const phone = bodyString(b.phone).trim();
  const note = bodyString(b.note).trim();
  const tags = bodyStringArray(b.tags);
  const lists = bodyStringArray(b.lists);
  const ownersFromClient = bodyStringArray(b.owners);

  if (!firstName) {
    res.status(400).json({ message: "First name is required" });
    return;
  }
  if (!lastName) {
    res.status(400).json({ message: "Last name is required" });
    return;
  }
  if (!email) {
    res.status(400).json({ message: "Email is required" });
    return;
  }

  try {
    const creatorLabel = (await getUserDisplayNameById(user.id)).trim();
    const fallback =
      user.email?.trim() || creatorLabel || "User";
    const primaryOwner = creatorLabel || fallback;
    const owners = dedupeOwnersPreserveOrder([
      primaryOwner,
      ...ownersFromClient,
    ]);

    const row = await insertContact({
      input: {
        firstName,
        lastName,
        email,
        phone,
        note,
        tags,
        lists,
        owners,
      },
      createdByUserId: user.id,
    });
    const dealCounts = await countDealInvestmentsByContactIdForViewer({
      viewerUserId: user.id,
      jwtUserRole: user.userRole,
      contactIds: [String(row.id)],
    });
    res.status(201).json({
      message: "Contact created",
      contact: await mapContactToJsonWithNames(row, dealCounts),
    });
  } catch (err) {
    if (err instanceof ContactScopeConflictError) {
      res.status(409).json({ message: err.message });
      return;
    }
    console.error("postContact:", err);
    res.status(500).json({ message: "Could not create contact" });
  }
}

export async function patchContact(req: Request, res: Response): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }
  const contactId = paramStr(req.params.contactId);
  if (!contactId) {
    res.status(400).json({ message: "Contact id required" });
    return;
  }

  const b = req.body as Record<string, unknown>;
  const editReason = bodyString(b.edit_reason || b.editReason).trim();
  if (!editReason) {
    res.status(400).json({ message: "Edit reason is required" });
    return;
  }

  const firstName = bodyString(b.first_name || b.firstName).trim();
  const lastName = bodyString(b.last_name || b.lastName).trim();
  const email = bodyString(b.email).trim();
  const phone = bodyString(b.phone).trim();
  const note = bodyString(b.note).trim();
  const tags = bodyStringArray(b.tags);
  const lists = bodyStringArray(b.lists);
  const ownersFromClient = bodyStringArray(b.owners);

  if (!firstName) {
    res.status(400).json({ message: "First name is required" });
    return;
  }
  if (!lastName) {
    res.status(400).json({ message: "Last name is required" });
    return;
  }
  if (!email) {
    res.status(400).json({ message: "Email is required" });
    return;
  }

  try {
    const creatorLabel = (await getUserDisplayNameById(user.id)).trim();
    const fallback = user.email?.trim() || creatorLabel || "User";
    const primaryOwner = creatorLabel || fallback;
    const owners = dedupeOwnersPreserveOrder([
      primaryOwner,
      ...ownersFromClient,
    ]);

    const updated = await updateContactFieldsForViewer(
      user.id,
      contactId,
      {
        firstName,
        lastName,
        email,
        phone,
        note,
        tags,
        lists,
        owners,
        lastEditReason: editReason,
      },
      user.userRole,
    );
    if (!updated) {
      res.status(404).json({ message: "Contact not found or access denied" });
      return;
    }
    const dealCounts = await countDealInvestmentsByContactIdForViewer({
      viewerUserId: user.id,
      jwtUserRole: user.userRole,
      contactIds: [String(updated.id)],
    });
    res.status(200).json({
      message: "Contact updated",
      contact: await mapContactToJsonWithNames(updated, dealCounts),
    });
  } catch (err) {
    if (err instanceof ContactScopeConflictError) {
      res.status(409).json({ message: err.message });
      return;
    }
    console.error("patchContact:", err);
    res.status(500).json({ message: "Could not update contact" });
  }
}

export async function patchContactStatus(
  req: Request,
  res: Response,
): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }
  const contactId = paramStr(req.params.contactId);
  if (!contactId) {
    res.status(400).json({ message: "Contact id required" });
    return;
  }
  const b = req.body as Record<string, unknown>;
  const raw = bodyString(b.status).trim().toLowerCase();
  const status = raw === "suspended" ? "suspended" : "active";

  try {
    const updated = await patchContactStatusForViewer(
      user.id,
      contactId,
      status,
      user.userRole,
    );
    if (!updated) {
      res.status(404).json({ message: "Contact not found or access denied" });
      return;
    }
    const dealCounts = await countDealInvestmentsByContactIdForViewer({
      viewerUserId: user.id,
      jwtUserRole: user.userRole,
      contactIds: [String(updated.id)],
    });
    res.status(200).json({
      message: "Contact status updated",
      contact: await mapContactToJsonWithNames(updated, dealCounts),
    });
  } catch (err) {
    console.error("patchContactStatus:", err);
    res.status(500).json({ message: "Could not update contact status" });
  }
}
