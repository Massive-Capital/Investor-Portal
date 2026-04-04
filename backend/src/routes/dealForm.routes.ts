import { Router } from "express";
import multer from "multer";
import {
  getDealById,
  getDeals,
  postDeal,
  putDeal,
} from "../controllers/deal/add_deal.controller.js";
import {
  getDealInvestors,
  postDealInvestment,
  putDealInvestment,
} from "../controllers/deal/dealInvestment.controller.js";
import {
  deleteDealInvestorClass,
  getDealInvestorClasses,
  postDealInvestorClass,
  putDealInvestorClass,
} from "../controllers/deal/dealInvestorClass.controller.js";
import { postDealsExportNotify } from "../controllers/exportNotify.controller.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 20 },
});

const router = Router();

router.get("/deals", getDeals);
router.post("/deals/export-notify", postDealsExportNotify);
router.get("/deals/:dealId/investor-classes", getDealInvestorClasses);
router.post("/deals/:dealId/investor-classes", postDealInvestorClass);
router.put("/deals/:dealId/investor-classes/:classId", putDealInvestorClass);
router.delete(
  "/deals/:dealId/investor-classes/:classId",
  deleteDealInvestorClass,
);
router.get("/deals/:dealId/investors", getDealInvestors);
router.post(
  "/deals/:dealId/investments",
  upload.single("subscriptionDocument"),
  postDealInvestment,
);
router.put(
  "/deals/:dealId/investments/:investmentId",
  upload.single("subscriptionDocument"),
  putDealInvestment,
);
router.get("/deals/:dealId", getDealById);
router.put(
  "/deals/:dealId",
  upload.array("assetImages", 20),
  putDeal,
);
router.post("/deals", upload.array("assetImages", 20), postDeal);

export default router;
