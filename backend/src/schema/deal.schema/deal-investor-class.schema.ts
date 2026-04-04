import {
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { addDealForm } from "./add-deal-form.schema.js";

/** Per-deal investor class / offering tranche (Offering Information tab). */
export const dealInvestorClass = pgTable("deal_investor_class", {
  id: uuid("id").defaultRandom().primaryKey(),
  dealId: uuid("deal_id")
    .notNull()
    .references(() => addDealForm.id, { onDelete: "cascade" }),
  name: text("name").notNull().default(""),
  subscriptionType: text("subscription_type").notNull().default(""),
  entityName: text("entity_name").notNull().default(""),
  startDate: text("start_date").notNull().default(""),
  offeringSize: text("offering_size").notNull().default(""),
  minimumInvestment: text("minimum_investment").notNull().default(""),
  pricePerUnit: text("price_per_unit").notNull().default(""),
  status: text("status").notNull().default("draft"),
  visibility: text("visibility").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type DealInvestorClassRow = typeof dealInvestorClass.$inferSelect;
export type DealInvestorClassInsert = typeof dealInvestorClass.$inferInsert;
