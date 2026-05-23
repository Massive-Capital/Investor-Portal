import { Router } from "express";
import {
  getPlatformFundingHandler,
  getPlatformMetricsHandler,
  getPlatformUserActivityHandler,
} from "../controllers/platform/platformMetrics.controller.js";

const router = Router();

router.get("/platform/metrics", getPlatformMetricsHandler);
router.get("/platform/metrics/funding", getPlatformFundingHandler);
router.get("/platform/metrics/user-activity", getPlatformUserActivityHandler);

export default router;
