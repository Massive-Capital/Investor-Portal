/**
 * Distribution Setup — load/save waterfall payment rows.
 * Classes + promote come from Class Setup; this module stores waterfalls only.
 */

import { eq } from "drizzle-orm";
import { db } from "../../database/db.js";
import { addDealForm } from "../../schema/deal.schema/add-deal-form.schema.js";
import { getClassSetupBundle } from "../classSetup/classSetup.service.js";
import {
  normalizePayToAgainstClasses,
  parseDistributionSetupJson,
  seedDefaultPayTo,
  serializeDistributionSetupJson,
} from "./distributionSetup.mapper.js";
import type {
  DistributionSetupBundle,
  DistributionSetupSaveInput,
  DistributionWaterfalls,
} from "./distributionSetup.types.js";
import { emptyWaterfalls } from "./distributionSetup.types.js";

export async function getDistributionSetupBundle(
  dealId: string,
): Promise<DistributionSetupBundle | null> {
  const classBundle = await getClassSetupBundle(dealId);
  if (!classBundle) return null;

  const [deal] = await db
    .select({
      distributionSetupJson: addDealForm.distributionSetupJson,
    })
    .from(addDealForm)
    .where(eq(addDealForm.id, dealId))
    .limit(1);

  let waterfalls = parseDistributionSetupJson(
    deal?.distributionSetupJson ?? "{}",
  );

  const classIds = new Set(
    classBundle.classes.map((c) => c.id).filter((id): id is string => Boolean(id)),
  );
  const classRefs = classBundle.classes
    .filter((c) => c.id)
    .map((c) => ({ id: c.id as string, classType: c.classType }));

  waterfalls = seedDefaultPayTo(waterfalls, classRefs);
  waterfalls = normalizePayToAgainstClasses(waterfalls, classIds);

  return {
    dealId: classBundle.dealId,
    dealName: classBundle.dealName,
    targetRaise: classBundle.meta.targetRaise,
    waterfalls,
    classes: classBundle.classes
      .filter((c) => c.id)
      .map((c) => ({
        id: c.id as string,
        name: c.name,
        classType: c.classType,
        actuallyFunded: c.actuallyFunded,
        equityPct: c.equityPct,
        preferredReturn: {
          enabled: c.preferredReturn.enabled,
          rate: c.preferredReturn.rate,
        },
        prefEquity: { ...c.prefEquity },
        mezz: { ...c.mezz },
      })),
    promote: {
      hurdles: classBundle.meta.promote.hurdles.map((h) => ({
        id: h.id,
        rate: h.rate,
        basis: h.basis,
        measuredOn: h.measuredOn,
      })),
      shares: classBundle.meta.promote.shares,
    },
  };
}

export async function saveDistributionSetupBundle(params: {
  dealId: string;
  input: DistributionSetupSaveInput;
}): Promise<{ bundle: DistributionSetupBundle; error?: string }> {
  const existing = await getDistributionSetupBundle(params.dealId);
  if (!existing) {
    return {
      bundle: {
        dealId: params.dealId,
        dealName: "",
        targetRaise: "0",
        waterfalls: emptyWaterfalls(),
        classes: [],
        promote: { hurdles: [], shares: {} },
      },
      error: "Deal not found",
    };
  }

  const classIds = new Set(existing.classes.map((c) => c.id));
  const waterfalls: DistributionWaterfalls = normalizePayToAgainstClasses(
    {
      operating: params.input.waterfalls?.operating ?? [],
      capital: params.input.waterfalls?.capital ?? [],
    },
    classIds,
  );

  if (waterfalls.operating.length === 0 && waterfalls.capital.length === 0) {
    return { bundle: existing, error: "At least one payment row is required" };
  }

  await db
    .update(addDealForm)
    .set({
      distributionSetupJson: serializeDistributionSetupJson(waterfalls),
    })
    .where(eq(addDealForm.id, params.dealId));

  const bundle = await getDistributionSetupBundle(params.dealId);
  return { bundle: bundle ?? { ...existing, waterfalls } };
}
