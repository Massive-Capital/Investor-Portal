import { Router } from "express";
import {
  getDealDistributionSetup,
  putDealDistributionSetup,
} from "../controllers/distributionSetup/distributionSetup.controller.js";

const router = Router();

router.get("/deals/:dealId/distribution-setup", getDealDistributionSetup);
router.put("/deals/:dealId/distribution-setup", putDealDistributionSetup);

export default router;
