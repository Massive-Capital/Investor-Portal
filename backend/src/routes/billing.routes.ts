import { Router } from "express";
import {
  getBillingConfig,
  getCompanyBilling,
  getCompanyBillingDeals,
  getCompanyBillingInvoices,
  getCompanyBillingPaymentMethods,
  postCompanyBillingCheckout,
  postCompanyBillingDealCycle,
  postCompanyBillingPaySaved,
  postCompanyBillingPaymentElement,
  postCompanyBillingPortal,
  postCompanyBillingSetupIntent,
  postCompanyBillingSyncCheckout,
  postCompanyBillingSyncPayment,
  postCompanyBillingSyncPaymentMethods,
  postExtraCompanyUserCheckout,
  postExtraCompanyUserPaySaved,
  postExtraCompanyUserSyncCheckout,
} from "../controllers/billing/companyBilling.controller.js";
import {
  billingAlreadyPaidMiddleware,
  billingPaymentOnceMiddleware,
} from "../middleware/billingPaymentOnce.middleware.js";

const router = Router();

const startDealPayment = [
  billingAlreadyPaidMiddleware,
  billingPaymentOnceMiddleware(true),
] as const;

const startSavedPayment = [
  billingAlreadyPaidMiddleware,
  billingPaymentOnceMiddleware(false),
] as const;

router.get("/billing/config", getBillingConfig);
router.get("/companies/:companyId/billing/deals", getCompanyBillingDeals);
router.post(
  "/companies/:companyId/billing/deals/:dealId/cycle",
  postCompanyBillingDealCycle,
);
router.get("/companies/:companyId/billing/invoices", getCompanyBillingInvoices);
router.get(
  "/companies/:companyId/billing/payment-methods",
  getCompanyBillingPaymentMethods,
);
router.get("/companies/:companyId/billing", getCompanyBilling);
router.post(
  "/companies/:companyId/billing/checkout",
  ...startDealPayment,
  postCompanyBillingCheckout,
);
router.post(
  "/companies/:companyId/billing/pay-saved",
  ...startSavedPayment,
  postCompanyBillingPaySaved,
);
router.post(
  "/companies/:companyId/billing/payment-element",
  ...startDealPayment,
  postCompanyBillingPaymentElement,
);
router.post(
  "/companies/:companyId/billing/setup-intent",
  postCompanyBillingSetupIntent,
);
router.post(
  "/companies/:companyId/billing/sync-payment",
  postCompanyBillingSyncPayment,
);
router.post("/companies/:companyId/billing/portal", postCompanyBillingPortal);
router.post(
  "/companies/:companyId/billing/sync-checkout",
  postCompanyBillingSyncCheckout,
);
router.post(
  "/companies/:companyId/billing/sync-payment-methods",
  postCompanyBillingSyncPaymentMethods,
);
router.post(
  "/companies/:companyId/billing/extra-company-user",
  postExtraCompanyUserCheckout,
);
router.post(
  "/companies/:companyId/billing/extra-company-user/pay-saved",
  postExtraCompanyUserPaySaved,
);
router.post(
  "/companies/:companyId/billing/extra-company-user/sync-checkout",
  postExtraCompanyUserSyncCheckout,
);

export default router;
