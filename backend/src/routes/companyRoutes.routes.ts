import { Router } from "express";
import {
  getCompanies,
  patchCompany,
  postCompany,
} from "../controllers/company.controller.js";

const router = Router();

router.get("/companies", getCompanies);
router.post("/companies", postCompany);
router.patch("/companies/:companyId", patchCompany);

export default router;
