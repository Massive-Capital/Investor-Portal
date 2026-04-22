import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "../auth.schema/signin.js";

/** LP investing → Profiles: one row per saved investor profile for a portal user. */
export const userInvestorProfiles = pgTable("user_investor_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  profileName: varchar("profile_name", { length: 255 }).notNull(),
  profileType: varchar("profile_type", { length: 100 }).notNull().default(""),
  addedBy: varchar("added_by", { length: 255 }).notNull().default(""),
  investmentsCount: integer("investments_count").notNull().default(0),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const userBeneficiaries = pgTable("user_beneficiaries", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  fullName: varchar("full_name", { length: 200 }).notNull().default(""),
  relationship: varchar("relationship", { length: 100 }).notNull().default(""),
  taxId: varchar("tax_id", { length: 100 }).notNull().default(""),
  phone: varchar("phone", { length: 32 }).notNull().default(""),
  email: varchar("email", { length: 255 }).notNull().default(""),
  addressQuery: text("address_query").notNull().default(""),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const userSavedAddresses = pgTable("user_saved_addresses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  fullNameOrCompany: varchar("full_name_or_company", { length: 255 })
    .notNull()
    .default(""),
  country: varchar("country", { length: 100 }).notNull().default(""),
  street1: varchar("street1", { length: 255 }).notNull().default(""),
  street2: varchar("street2", { length: 255 }).notNull().default(""),
  city: varchar("city", { length: 100 }).notNull().default(""),
  state: varchar("state", { length: 100 }).notNull().default(""),
  zip: varchar("zip", { length: 32 }).notNull().default(""),
  checkMemo: varchar("check_memo", { length: 500 }).notNull().default(""),
  distributionNote: text("distribution_note").notNull().default(""),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type UserInvestorProfileRow = typeof userInvestorProfiles.$inferSelect;
export type UserBeneficiaryRow = typeof userBeneficiaries.$inferSelect;
export type UserSavedAddressRow = typeof userSavedAddresses.$inferSelect;
