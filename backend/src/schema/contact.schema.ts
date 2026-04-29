import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { companies } from "./company.schema/company.js";
import { users } from "./auth.schema/signin.js";

/** CRM-style contacts added from the portal; `created_by` is the authenticated user who saved the row */
export const contact = pgTable("contact", {
  id: uuid("id").defaultRandom().primaryKey(),
  /**
   * Same `companies.id` as `users.organization_id` for the creating user (set on insert via
   * `resolveOrganizationIdForUserId` — usually the creator’s `users.organization_id`, or
   * resolved from `companies` via the portal user’s `organization_id`).
   */
  organizationId: uuid("organization_id").references(() => companies.id, {
    onDelete: "set null",
  }),
  firstName: varchar("first_name", { length: 200 }).notNull(),
  lastName: varchar("last_name", { length: 200 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  /** True when this email is linked to a row in `users` — excluded from All Contacts lists. */
  isPortalUser: boolean("is_portal_user").notNull().default(false),
  phone: varchar("phone", { length: 64 }).notNull().default(""),
  note: text("note").notNull().default(""),
  tags: jsonb("tags").$type<string[]>().notNull(),
  lists: jsonb("lists").$type<string[]>().notNull(),
  owners: jsonb("owners").$type<string[]>().notNull(),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  lastEditReason: text("last_edit_reason"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type ContactRow = typeof contact.$inferSelect;
export type ContactInsert = typeof contact.$inferInsert;
