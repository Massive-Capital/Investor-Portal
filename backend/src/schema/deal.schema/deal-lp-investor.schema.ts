import { pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";
import { users } from "../auth.schema/signin.js";
import { addDealForm } from "./add-deal-form.schema.js";

/**
 * LP investor roster (Investors tab) without a `deal_investment` row.
 * Mirrors `deal_member`: lean roster + class; unique (deal_id, contact_member_id).
 */
export const dealLpInvestor = pgTable(
  "deal_lp_investor",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => addDealForm.id, { onDelete: "cascade" }),
    addedBy: uuid("added_by").references(() => users.id, { onDelete: "set null" }),
    contactMemberId: text("contact_member_id").notNull().default(""),
    investorClass: text("investor_class").notNull().default(""),
    sendInvitationMail: text("send_invitation_mail").notNull().default("no"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("deal_lp_investor_deal_id_contact_member_id_uidx").on(
      t.dealId,
      t.contactMemberId,
    ),
  ],
);

export type DealLpInvestorRow = typeof dealLpInvestor.$inferSelect;
export type DealLpInvestorInsert = typeof dealLpInvestor.$inferInsert;
