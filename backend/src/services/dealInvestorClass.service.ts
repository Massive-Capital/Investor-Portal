import { and, asc, eq } from "drizzle-orm";
import { db } from "../database/db.js";
import {
  dealInvestorClass,
  type DealInvestorClassInsert,
  type DealInvestorClassRow,
} from "../schema/deal.schema/deal-investor-class.schema.js";

export type InvestorClassInput = {
  name: string;
  subscriptionType: string;
  entityName: string;
  startDate: string;
  offeringSize: string;
  minimumInvestment: string;
  pricePerUnit: string;
  status: string;
  visibility: string;
};

export function mapRowToJson(row: DealInvestorClassRow) {
  return {
    id: row.id,
    dealId: row.dealId,
    name: row.name,
    subscriptionType: row.subscriptionType,
    entityName: row.entityName,
    startDate: row.startDate,
    offeringSize: row.offeringSize,
    minimumInvestment: row.minimumInvestment,
    pricePerUnit: row.pricePerUnit,
    status: row.status,
    visibility: row.visibility,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
    updatedAt:
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : String(row.updatedAt),
  };
}

export async function listInvestorClassesByDealId(
  dealId: string,
): Promise<DealInvestorClassRow[]> {
  return db
    .select()
    .from(dealInvestorClass)
    .where(eq(dealInvestorClass.dealId, dealId))
    .orderBy(asc(dealInvestorClass.createdAt));
}

export async function insertInvestorClass(params: {
  dealId: string;
  input: InvestorClassInput;
}): Promise<DealInvestorClassRow> {
  const row: DealInvestorClassInsert = {
    dealId: params.dealId,
    name: params.input.name,
    subscriptionType: params.input.subscriptionType,
    entityName: params.input.entityName,
    startDate: params.input.startDate,
    offeringSize: params.input.offeringSize,
    minimumInvestment: params.input.minimumInvestment,
    pricePerUnit: params.input.pricePerUnit,
    status: params.input.status,
    visibility: params.input.visibility,
  };
  const [inserted] = await db.insert(dealInvestorClass).values(row).returning();
  if (!inserted) throw new Error("INSERT_INVESTOR_CLASS_FAILED");
  return inserted;
}

export async function updateInvestorClass(params: {
  dealId: string;
  classId: string;
  input: InvestorClassInput;
}): Promise<DealInvestorClassRow | null> {
  const [updated] = await db
    .update(dealInvestorClass)
    .set({
      name: params.input.name,
      subscriptionType: params.input.subscriptionType,
      entityName: params.input.entityName,
      startDate: params.input.startDate,
      offeringSize: params.input.offeringSize,
      minimumInvestment: params.input.minimumInvestment,
      pricePerUnit: params.input.pricePerUnit,
      status: params.input.status,
      visibility: params.input.visibility,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(dealInvestorClass.id, params.classId),
        eq(dealInvestorClass.dealId, params.dealId),
      ),
    )
    .returning();
  return updated ?? null;
}

export async function deleteInvestorClass(params: {
  dealId: string;
  classId: string;
}): Promise<boolean> {
  const deleted = await db
    .delete(dealInvestorClass)
    .where(
      and(
        eq(dealInvestorClass.id, params.classId),
        eq(dealInvestorClass.dealId, params.dealId),
      ),
    )
    .returning({ id: dealInvestorClass.id });
  return deleted.length > 0;
}
