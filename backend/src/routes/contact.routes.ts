import { Router } from "express";
import {
  deleteContactEmailTemplate,
  getContact,
  getContactEmailTemplates,
  getContactOwnerSponsors,
  getContacts,
  getContactDealStats,
  getContactMatchingIds,
  getOrganizationContactLists,
  getOrganizationContactTags,
  getPlatformContacts,
  patchContact,
  patchContactAccreditationStatus,
  patchContactEmailTemplate,
  patchContactKnownSince,
  patchContactRelationship506b,
  patchContactShowOfferings,
  patchContactStatus,
  postContact,
  postContactEmailTemplate,
  postContactInvitation,
} from "../controllers/contact.controller.js";
import { postContactsExportNotify } from "../controllers/exportNotify.controller.js";

const router = Router();

router.get("/contacts", getContacts);
router.get("/contacts/deal-stats", getContactDealStats);
router.get("/contacts/matching-ids", getContactMatchingIds);
router.get("/contacts/email-templates", getContactEmailTemplates);
router.get("/contacts/organization-tags", getOrganizationContactTags);
router.get("/contacts/organization-lists", getOrganizationContactLists);
router.get("/contacts/owner-sponsors", getContactOwnerSponsors);
router.get("/contacts/platform-contacts", getPlatformContacts);
router.get("/contacts/:contactId", getContact);
router.post("/contacts", postContact);
router.post("/contacts/email-templates", postContactEmailTemplate);
router.post("/contacts/export-notify", postContactsExportNotify);
router.post("/contacts/:contactId/send-invitation", postContactInvitation);
router.patch("/contacts/:contactId/status", patchContactStatus);
router.patch("/contacts/:contactId/show-offerings", patchContactShowOfferings);
router.patch(
  "/contacts/:contactId/accreditation-status",
  patchContactAccreditationStatus,
);
router.patch("/contacts/:contactId/known-since", patchContactKnownSince);
router.patch(
  "/contacts/:contactId/relationship-506b",
  patchContactRelationship506b,
);
router.patch("/contacts/:contactId", patchContact);
router.patch("/contacts/email-templates/:templateId", patchContactEmailTemplate);
router.delete("/contacts/email-templates/:templateId", deleteContactEmailTemplate);

export default router;
