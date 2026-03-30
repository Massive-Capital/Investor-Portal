import { Router } from "express";
import multer from "multer";
import {
  getDealById,
  getDeals,
  postDeal,
} from "../controllers/deal/add_deal.controller.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 20 },
});

const router = Router();

router.get("/deals", getDeals);
router.get("/deals/:dealId", getDealById);
router.post("/deals", upload.array("assetImages", 20), postDeal);

export default router;
