import { Router } from "express";
import { patchDealLpInvestorMyInvestNowAddon } from "../controllers/deal/dealLpInvestorMyInvestNow.addon.controller.js";

const router = Router();

router.patch(
  "/deals/:dealId/lp-investors/my-invest-now-commitment",
  patchDealLpInvestorMyInvestNowAddon,
);

export default router;
