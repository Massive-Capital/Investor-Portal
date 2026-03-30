import {
  boolean,
  date,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Syndication wizard submissions — column names match DB fields. */
export const addDealForm = pgTable("add_deal_form", {
  id: uuid("id").defaultRandom().primaryKey(),
  dealName: text("deal_name").notNull(),
  dealType: text("deal_type").notNull().default(""),
  dealStage: text("deal_stage").notNull(),
  secType: text("sec_type").notNull(),
  closeDate: date("close_date"),
  owningEntityName: text("owning_entity_name").notNull(),
  fundsRequiredBeforeGpSign: boolean("funds_required_before_gp_sign").notNull(),
  autoSendFundingInstructions: boolean(
    "auto_send_funding_instructions",
  ).notNull(),
  propertyName: text("property_name").notNull(),
  country: text("country").notNull().default(""),
  city: text("city").notNull().default(""),
  /** Relative paths under the uploads physical root (see getUploadsPhysicalRoot), joined with `;` */
  assetImagePath: text("asset_image_path"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type AddDealFormRow = typeof addDealForm.$inferSelect;
export type AddDealFormInsert = typeof addDealForm.$inferInsert;
