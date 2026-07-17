import {
  pgTable,
  text,
  uuid,
  varchar,
  timestamp,
} from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  /** GoHighLevel sub-account (location) id when per-org CRM is enabled. */
  ghlLocationId: varchar("ghl_location_id", { length: 64 }),
  /** pending | active | failed | skipped */
  ghlLocationStatus: varchar("ghl_location_status", { length: 32 })
    .notNull()
    .default("pending"),
  ghlLocationError: text("ghl_location_error"),
  ghlLocationProvisionedAt: timestamp("ghl_location_provisioned_at", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type CompanyRow = typeof companies.$inferSelect;
