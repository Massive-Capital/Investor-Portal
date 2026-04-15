import { Router } from "express";
import multer from "multer";
import {
  getDealById,
  getDeals,
  getOfferingPreviewToken,
  getPublicOfferingPreview,
  postOfferingPreviewShareEmail,
  patchDealAnnouncement,
  patchDealGalleryCover,
  patchDealOfferingGallery,
  postDealOfferingGalleryUploads,
  postDealOfferingDocumentUploads,
  patchDealInvestorSummary,
  patchDealKeyHighlights,
  patchDealOfferingInvestorPreview,
  patchDealOfferingOverview,
  postDeal,
  putDeal,
  deleteDeal,
} from "../controllers/deal/add_deal.controller.js";
import {
  getDealCommitmentAmountByContact,
  getDealInvestors,
  postDealInvestment,
  putDealInvestment,
} from "../controllers/deal/dealInvestment.controller.js";
import {
  patchDealLpInvestorMyCommitment,
  postDealLpInvestor,
  putDealLpInvestor,
} from "../controllers/deal/dealLpInvestor.controller.js";
import {
  deleteDealMember,
  getDealMembers,
  postDealMemberInvitationEmail,
} from "../controllers/deal/dealMember.controller.js";
import {
  deleteDealInvestorClass,
  getDealInvestorClasses,
  postDealInvestorClass,
  putDealInvestorClass,
} from "../controllers/deal/dealInvestorClass.controller.js";
import {
  postDealInvestorsExportNotify,
  postDealMembersExportNotify,
  postDealsExportNotify,
} from "../controllers/exportNotify.controller.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 20 },
});

const router = Router();

router.get("/public/offering-preview", getPublicOfferingPreview);

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
router.get(
  "/deals/:dealId/commitment-amount",
  getDealCommitmentAmountByContact,
);
router.post(
  "/deals/:dealId/investors/export-notify",
  postDealInvestorsExportNotify,
);
router.post("/deals/:dealId/lp-investors", postDealLpInvestor);
router.put("/deals/:dealId/lp-investors/:lpInvestorId", putDealLpInvestor);
router.patch(
  "/deals/:dealId/lp-investors/my-commitment",
  patchDealLpInvestorMyCommitment,
);
router.get("/deals/:dealId/members", getDealMembers);
router.post(
  "/deals/:dealId/members/export-notify",
  postDealMembersExportNotify,
);
router.delete("/deals/:dealId/members/:rowId", deleteDealMember);
router.post(
  "/deals/:dealId/members/send-invitation-email",
  postDealMemberInvitationEmail,
);
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
router.patch("/deals/:dealId/investor-summary", patchDealInvestorSummary);
router.patch("/deals/:dealId/deal-announcement", patchDealAnnouncement);
router.patch("/deals/:dealId/key-highlights", patchDealKeyHighlights);
router.patch(
  "/deals/:dealId/offering-investor-preview",
  patchDealOfferingInvestorPreview,
);
router.patch("/deals/:dealId/gallery-cover", patchDealGalleryCover);
router.post(
  "/deals/:dealId/offering-gallery-uploads",
  upload.array("galleryFiles", 20),
  postDealOfferingGalleryUploads,
);
router.post(
  "/deals/:dealId/offering-document-uploads",
  upload.array("documentFiles", 20),
  postDealOfferingDocumentUploads,
);
router.patch("/deals/:dealId/offering-gallery", patchDealOfferingGallery);
router.patch("/deals/:dealId/offering-overview", patchDealOfferingOverview);
router.get(
  "/deals/:dealId/offering-preview-token",
  getOfferingPreviewToken,
);
router.post(
  "/deals/:dealId/offering-preview-share-email",
  postOfferingPreviewShareEmail,
);
router.get("/deals/:dealId", getDealById);
router.put(
  "/deals/:dealId",
  upload.array("assetImages", 20),
  putDeal,
);
router.delete("/deals/:dealId", deleteDeal);
router.post("/deals", upload.array("assetImages", 20), postDeal);

export default router;
