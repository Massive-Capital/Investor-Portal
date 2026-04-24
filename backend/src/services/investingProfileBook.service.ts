import { and, desc, eq } from "drizzle-orm";
import { db } from "../database/db.js";
import {
  userBeneficiaries,
  userInvestorProfiles,
  userSavedAddresses,
  users,
} from "../schema/schema.js";

function displayNameFromUser(row: {
  firstName: string;
  lastName: string;
  email: string;
}): string {
  const f = String(row.firstName ?? "").trim();
  const l = String(row.lastName ?? "").trim();
  const n = [f, l].filter(Boolean).join(" ");
  if (n) return n;
  return String(row.email ?? "").trim() || "—";
}

const MAX_FORM_SNAPSHOT_BYTES = 256 * 1024;
const ERR_FORM_SNAPSHOT_TOO_LARGE = "form_snapshot_too_large";

/**
 * Controllers pass JSON from the body as a UTF-8 string; this turns it into a jsonb-ready object.
 */
function formSnapshotFromRequestJson(s: string | null): Record<string, unknown> | null {
  if (s == null) return null;
  const t = s.trim();
  if (!t) return null;
  if (Buffer.byteLength(t, "utf8") > MAX_FORM_SNAPSHOT_BYTES) {
    throw new Error(ERR_FORM_SNAPSHOT_TOO_LARGE);
  }
  const o = JSON.parse(t) as unknown;
  if (o == null || typeof o !== "object" || Array.isArray(o)) {
    return null;
  }
  if (Buffer.byteLength(JSON.stringify(o), "utf8") > MAX_FORM_SNAPSHOT_BYTES) {
    throw new Error(ERR_FORM_SNAPSHOT_TOO_LARGE);
  }
  return o as Record<string, unknown>;
}

export type ProfileBookSnapshot = {
  profiles: Array<{
    id: string;
    profileName: string;
    profileType: string;
    addedBy: string;
    investmentsCount: number;
    dateCreated: string;
    archived: boolean;
    lastEditReason: string | null;
    /** Add-profile wizard; maps to DB `form_snapshot` (jsonb). */
    profileWizardState: unknown | null;
  }>;
  beneficiaries: Array<{
    id: string;
    fullName: string;
    relationship: string;
    taxId: string;
    phone: string;
    email: string;
    addressQuery: string;
    archived: boolean;
  }>;
  addresses: Array<{
    id: string;
    fullNameOrCompany: string;
    country: string;
    street1: string;
    street2: string;
    city: string;
    state: string;
    zip: string;
    checkMemo: string;
    distributionNote: string;
    archived: boolean;
  }>;
};

export async function getProfileBookForUser(
  userId: string,
): Promise<ProfileBookSnapshot> {
  const [pRows, bRows, aRows] = await Promise.all([
    db
      .select()
      .from(userInvestorProfiles)
      .where(eq(userInvestorProfiles.userId, userId))
      .orderBy(desc(userInvestorProfiles.createdAt)),
    db
      .select()
      .from(userBeneficiaries)
      .where(eq(userBeneficiaries.userId, userId))
      .orderBy(desc(userBeneficiaries.createdAt)),
    db
      .select()
      .from(userSavedAddresses)
      .where(eq(userSavedAddresses.userId, userId))
      .orderBy(desc(userSavedAddresses.createdAt)),
  ]);

  return {
    profiles: pRows.map(mapProfileRow),
    beneficiaries: bRows.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      relationship: r.relationship,
      taxId: r.taxId,
      phone: r.phone,
      email: r.email,
      addressQuery: r.addressQuery,
      archived: r.archived,
    })),
    addresses: aRows.map((r) => ({
      id: r.id,
      fullNameOrCompany: r.fullNameOrCompany,
      country: r.country,
      street1: r.street1,
      street2: r.street2,
      city: r.city,
      state: r.state,
      zip: r.zip,
      checkMemo: r.checkMemo,
      distributionNote: r.distributionNote,
      archived: r.archived,
    })),
  };
}

export async function createInvestorProfileForUser(
  userId: string,
  input: { profileName: string; profileType: string; profileWizardState: string | null },
): Promise<ProfileBookSnapshot["profiles"][0] | null> {
  const [u] = await db
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) return null;

  const addedBy = displayNameFromUser(u);
  const formSnapshot = formSnapshotFromRequestJson(input.profileWizardState);
  const [row] = await db
    .insert(userInvestorProfiles)
    .values({
      userId,
      profileName: (input.profileName ?? "").trim() || "—",
      profileType: (input.profileType ?? "").trim() || "—",
      addedBy,
      formSnapshot,
    })
    .returning();

  if (!row) return null;
  return mapProfileRow(row);
}

export async function setInvestorProfileArchived(
  userId: string,
  profileId: string,
  archived: boolean,
): Promise<ProfileBookSnapshot["profiles"][0] | null> {
  const [row] = await db
    .update(userInvestorProfiles)
    .set({ archived })
    .where(
      and(eq(userInvestorProfiles.id, profileId), eq(userInvestorProfiles.userId, userId)),
    )
    .returning();
  if (!row) return null;
  return mapProfileRow(row);
}

export async function createBeneficiaryForUser(
  userId: string,
  input: {
    fullName: string;
    relationship: string;
    taxId: string;
    phone: string;
    email: string;
    addressQuery: string;
  },
): Promise<ProfileBookSnapshot["beneficiaries"][0] | null> {
  const [row] = await db
    .insert(userBeneficiaries)
    .values({
      userId,
      fullName: input.fullName ?? "",
      relationship: input.relationship ?? "",
      taxId: input.taxId ?? "",
      phone: input.phone ?? "",
      email: input.email ?? "",
      addressQuery: input.addressQuery ?? "",
    })
    .returning();
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.fullName,
    relationship: row.relationship,
    taxId: row.taxId,
    phone: row.phone,
    email: row.email,
    addressQuery: row.addressQuery,
    archived: row.archived,
  };
}

export async function setBeneficiaryArchived(
  userId: string,
  beneficiaryId: string,
  archived: boolean,
): Promise<ProfileBookSnapshot["beneficiaries"][0] | null> {
  const [row] = await db
    .update(userBeneficiaries)
    .set({ archived })
    .where(
      and(eq(userBeneficiaries.id, beneficiaryId), eq(userBeneficiaries.userId, userId)),
    )
    .returning();
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.fullName,
    relationship: row.relationship,
    taxId: row.taxId,
    phone: row.phone,
    email: row.email,
    addressQuery: row.addressQuery,
    archived: row.archived,
  };
}

export async function createSavedAddressForUser(
  userId: string,
  input: {
    fullNameOrCompany: string;
    country: string;
    street1: string;
    street2: string;
    city: string;
    state: string;
    zip: string;
    checkMemo: string;
    distributionNote: string;
  },
): Promise<ProfileBookSnapshot["addresses"][0] | null> {
  const [row] = await db
    .insert(userSavedAddresses)
    .values({
      userId,
      fullNameOrCompany: input.fullNameOrCompany ?? "",
      country: input.country ?? "",
      street1: input.street1 ?? "",
      street2: input.street2 ?? "",
      city: input.city ?? "",
      state: input.state ?? "",
      zip: input.zip ?? "",
      checkMemo: input.checkMemo ?? "",
      distributionNote: input.distributionNote ?? "",
    })
    .returning();
  if (!row) return null;
  return {
    id: row.id,
    fullNameOrCompany: row.fullNameOrCompany,
    country: row.country,
    street1: row.street1,
    street2: row.street2,
    city: row.city,
    state: row.state,
    zip: row.zip,
    checkMemo: row.checkMemo,
    distributionNote: row.distributionNote,
    archived: row.archived,
  };
}

export async function setSavedAddressArchived(
  userId: string,
  addressId: string,
  archived: boolean,
): Promise<ProfileBookSnapshot["addresses"][0] | null> {
  const [row] = await db
    .update(userSavedAddresses)
    .set({ archived })
    .where(
      and(eq(userSavedAddresses.id, addressId), eq(userSavedAddresses.userId, userId)),
    )
    .returning();
  if (!row) return null;
  return {
    id: row.id,
    fullNameOrCompany: row.fullNameOrCompany,
    country: row.country,
    street1: row.street1,
    street2: row.street2,
    city: row.city,
    state: row.state,
    zip: row.zip,
    checkMemo: row.checkMemo,
    distributionNote: row.distributionNote,
    archived: row.archived,
  };
}

function mapProfileRow(
  row: (typeof userInvestorProfiles.$inferSelect),
): ProfileBookSnapshot["profiles"][0] {
  return {
    id: row.id,
    profileName: row.profileName,
    profileType: row.profileType,
    addedBy: row.addedBy,
    investmentsCount: row.investmentsCount,
    dateCreated: row.createdAt.toISOString(),
    archived: row.archived,
    lastEditReason: row.lastEditReason != null && String(row.lastEditReason).trim()
      ? String(row.lastEditReason).trim()
      : null,
    profileWizardState: row.formSnapshot,
  };
}

function mapBenRow(row: (typeof userBeneficiaries.$inferSelect)): ProfileBookSnapshot["beneficiaries"][0] {
  return {
    id: row.id,
    fullName: row.fullName,
    relationship: row.relationship,
    taxId: row.taxId,
    phone: row.phone,
    email: row.email,
    addressQuery: row.addressQuery,
    archived: row.archived,
  };
}

function mapAddrRow(
  row: (typeof userSavedAddresses.$inferSelect),
): ProfileBookSnapshot["addresses"][0] {
  return {
    id: row.id,
    fullNameOrCompany: row.fullNameOrCompany,
    country: row.country,
    street1: row.street1,
    street2: row.street2,
    city: row.city,
    state: row.state,
    zip: row.zip,
    checkMemo: row.checkMemo,
    distributionNote: row.distributionNote,
    archived: row.archived,
  };
}

export async function updateInvestorProfileForUser(
  userId: string,
  profileId: string,
  input: {
    profileName: string;
    profileType: string;
    lastEditReason: string;
    /** Omit to leave `form_snapshot` unchanged. */
    profileWizardState?: string | null;
  },
): Promise<ProfileBookSnapshot["profiles"][0] | null> {
  const reason = (input.lastEditReason ?? "").trim();
  const [row] = await db
    .update(userInvestorProfiles)
    .set(
      Object.prototype.hasOwnProperty.call(input, "profileWizardState")
        ? {
            profileName: (input.profileName ?? "").trim() || "—",
            profileType: (input.profileType ?? "").trim() || "—",
            lastEditReason: reason || null,
            formSnapshot: formSnapshotFromRequestJson(
              input.profileWizardState == null
                ? null
                : String(input.profileWizardState),
            ),
          }
        : {
            profileName: (input.profileName ?? "").trim() || "—",
            profileType: (input.profileType ?? "").trim() || "—",
            lastEditReason: reason || null,
          },
    )
    .where(
      and(eq(userInvestorProfiles.id, profileId), eq(userInvestorProfiles.userId, userId)),
    )
    .returning();
  if (!row) return null;
  return mapProfileRow(row);
}

export async function updateBeneficiaryForUser(
  userId: string,
  beneficiaryId: string,
  input: {
    fullName: string;
    relationship: string;
    taxId: string;
    phone: string;
    email: string;
    addressQuery: string;
  },
): Promise<ProfileBookSnapshot["beneficiaries"][0] | null> {
  const [row] = await db
    .update(userBeneficiaries)
    .set({
      fullName: input.fullName ?? "",
      relationship: input.relationship ?? "",
      taxId: input.taxId ?? "",
      phone: input.phone ?? "",
      email: input.email ?? "",
      addressQuery: input.addressQuery ?? "",
    })
    .where(
      and(eq(userBeneficiaries.id, beneficiaryId), eq(userBeneficiaries.userId, userId)),
    )
    .returning();
  if (!row) return null;
  return mapBenRow(row);
}

export async function updateSavedAddressForUser(
  userId: string,
  addressId: string,
  input: {
    fullNameOrCompany: string;
    country: string;
    street1: string;
    street2: string;
    city: string;
    state: string;
    zip: string;
    checkMemo: string;
    distributionNote: string;
  },
): Promise<ProfileBookSnapshot["addresses"][0] | null> {
  const [row] = await db
    .update(userSavedAddresses)
    .set({
      fullNameOrCompany: input.fullNameOrCompany ?? "",
      country: input.country ?? "",
      street1: input.street1 ?? "",
      street2: input.street2 ?? "",
      city: input.city ?? "",
      state: input.state ?? "",
      zip: input.zip ?? "",
      checkMemo: input.checkMemo ?? "",
      distributionNote: input.distributionNote ?? "",
    })
    .where(
      and(eq(userSavedAddresses.id, addressId), eq(userSavedAddresses.userId, userId)),
    )
    .returning();
  if (!row) return null;
  return mapAddrRow(row);
}
