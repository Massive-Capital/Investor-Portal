import { Router } from "express";
import {
  getPlatformFundingHandler,
  getPlatformMetricsHandler,
} from "../controllers/platform/platformMetrics.controller.js";

const router = Router();

router.get("/platform/metrics", getPlatformMetricsHandler);
router.get("/platform/metrics/funding", getPlatformFundingHandler);

export default router;
