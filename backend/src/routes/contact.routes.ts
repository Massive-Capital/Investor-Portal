import { Router } from "express";
import {
  getContacts,
  getOrganizationContactLists,
  getOrganizationContactTags,
  patchContact,
  patchContactStatus,
  postContact,
} from "../controllers/contact.controller.js";
import { postContactsExportNotify } from "../controllers/exportNotify.controller.js";

const router = Router();

router.get("/contacts", getContacts);
router.get("/contacts/organization-tags", getOrganizationContactTags);
router.get("/contacts/organization-lists", getOrganizationContactLists);
router.post("/contacts", postContact);
router.post("/contacts/export-notify", postContactsExportNotify);
router.patch("/contacts/:contactId/status", patchContactStatus);
router.patch("/contacts/:contactId", patchContact);

export default router;
