import "./env.bootstrap.js";
import express from "express";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import cookieParser from "cookie-parser";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./database/db.js";
import { assertJwtSecretConfigured } from "./config/auth.js";
import { applyCorsHeaders, corsOptions } from "./config/cors.js";
import { getUploadsPhysicalRoot } from "./config/uploadPaths.js";
import { postCompanySettingsBranding } from "./controllers/company/companySettingsBranding.controller.js";
import {
  postDeal,
  postDealOfferingGalleryUploads,
  putDeal,
} from "./controllers/deal/add_deal.controller.js";
import {
  uploadDealCreateOrUpdateAssetImages,
  uploadDealOfferingGalleryFile,
} from "./middleware/dealAssetImageUpload.middleware.js";
import { uploadDealEsignTemplateFiles } from "./middleware/dealEsignTemplateUpload.middleware.js";
import { uploadCompanySettingsBranding } from "./middleware/companySettingsBrandingUpload.middleware.js";
import { socHttpAuditMiddleware } from "./middleware/socHttpAudit.middleware.js";
import { protectedUploadsMiddleware } from "./middleware/protectedUploads.middleware.js";
import { signflowWebhookBodyParser } from "./middleware/signflowWebhook.middleware.js";
import {
  authRateLimiter,
  generalApiRateLimiter,
  webhookRateLimiter,
} from "./middleware/rateLimit.js";
import { securityHeadersMiddleware } from "./middleware/securityHeaders.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/errorHandler.js";
import userRoutes from "./routes/userRoutes.routes.js";
import companyRoutes from "./routes/companyRoutes.routes.js";
import dealFormRoutes from "./routes/dealForm.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import esignTemplateRoutes from "./routes/esignTemplate.routes.js";
import investingProfileBookRoutes from "./routes/investingProfileBook.routes.js";
import platformRoutes from "./routes/platformRoutes.routes.js";
import { postDropboxSignWebhook } from "./controllers/deal/dealDropboxSignWebhook.controller.js";
import { postSignFlowWebhook } from "./controllers/deal/dealSignflowWebhook.controller.js";
import { postDealEsignTemplateUploads } from "./controllers/deal/dealEsignTemplates.controller.js";
import { dropboxSignWebhookUpload } from "./middleware/dropboxSignWebhook.middleware.js";
import investmentSignatureRoutes from "./routes/investmentSignature.routes.js";
import { getSignFlowPublicConfig } from "./config/signflow.config.js";

assertJwtSecretConfigured();

const PORT = process.env.BACKEND_PORT ?? 5004;
const app = express();

app.set("trust proxy", 1);
app.use(securityHeadersMiddleware());
app.use(cors(corsOptions()));
app.use(cookieParser());

app.use((req, res, next) => {
  applyCorsHeaders(req, res);
  next();
});

/* Webhooks — register before global JSON parser; rate-limited. */
app.post(
  "/webhooks/dropbox-sign",
  webhookRateLimiter,
  dropboxSignWebhookUpload,
  postDropboxSignWebhook,
);
app.post(
  "/api/webhooks/dropbox-sign",
  webhookRateLimiter,
  dropboxSignWebhookUpload,
  postDropboxSignWebhook,
);
app.post(
  "/webhooks/signflow",
  webhookRateLimiter,
  signflowWebhookBodyParser,
  postSignFlowWebhook,
);
app.post(
  "/api/webhooks/signflow",
  webhookRateLimiter,
  signflowWebhookBodyParser,
  postSignFlowWebhook,
);

/* Multipart uploads must run before any body parser (multer/busboy reads the stream). */
app.post(
  "/api/v1/companies/:companyId/settings/branding/:assetType",
  socHttpAuditMiddleware,
  uploadCompanySettingsBranding,
  postCompanySettingsBranding,
);
app.post(
  "/api/v1/deals",
  socHttpAuditMiddleware,
  uploadDealCreateOrUpdateAssetImages,
  postDeal,
);
app.put(
  "/api/v1/deals/:dealId",
  socHttpAuditMiddleware,
  uploadDealCreateOrUpdateAssetImages,
  putDeal,
);
app.post(
  "/api/v1/deals/:dealId/offering-gallery-uploads",
  socHttpAuditMiddleware,
  uploadDealOfferingGalleryFile,
  postDealOfferingGalleryUploads,
);
app.post(
  "/api/v1/deals/:dealId/esign-template-uploads",
  uploadDealEsignTemplateFiles,
  postDealEsignTemplateUploads,
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use("/api/v1/auth", authRateLimiter);
app.use("/api/v1", generalApiRateLimiter);
app.use("/api/v1", socHttpAuditMiddleware);

app.use("/api/v1", (req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

const uploadsRoot = getUploadsPhysicalRoot();
app.use("/uploads", protectedUploadsMiddleware);
console.log("Protected /uploads →", uploadsRoot);

app.use("/api/v1", [
  userRoutes,
  companyRoutes,
  dealFormRoutes,
  contactRoutes,
  esignTemplateRoutes,
  investingProfileBookRoutes,
  investmentSignatureRoutes,
  platformRoutes,
]);

app.use(notFoundHandler);
app.use(errorHandler);

console.log("Starting server...");

const baseUrl = process.env.BASE_URL?.trim();
const signFlowCfg = getSignFlowPublicConfig();
if (signFlowCfg.configured) {
  console.log(
    `SignFlow configured (${signFlowCfg.testMode ? "sandbox" : "production"}) → ${signFlowCfg.baseUrl}`,
  );
  const webhookBase = baseUrl?.trim() || `http://localhost:${PORT}`;
  console.log(`SignFlow webhook URL → ${webhookBase}/api/webhooks/signflow`);
} else {
  console.log(
    "SignFlow not configured — set SIGNFLOW_API_BASE_URL and SIGNFLOW_API_KEY (see API_INTEGRATION.md).",
  );
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function ensureInvestorQuestionnaireColumn(): Promise<void> {
  await pool.query(
    `ALTER TABLE add_deal_form ADD COLUMN IF NOT EXISTS investor_questionnaire_json text`,
  );
}

async function ensureDealInvestmentInvestNowColumns(): Promise<void> {
  await pool.query(
    `ALTER TABLE deal_investment ADD COLUMN IF NOT EXISTS funding_method text NOT NULL DEFAULT ''`,
  );
}

async function runMigrations(): Promise<void> {
  const migrationsFolder = path.resolve(__dirname, "..", "migrations");
  await migrate(db, { migrationsFolder });
  await ensureInvestorQuestionnaireColumn();
  await ensureDealInvestmentInvestNowColumns();
  console.log("Database migrations applied.");
}

async function verifyPoolConnection(): Promise<void> {
  const client = await pool.connect();
  client.release();
  console.log("Database pool ready.");
}

async function initDatabaseAfterListen(): Promise<void> {
  try {
    await verifyPoolConnection();
    if (process.env.SKIP_DB_MIGRATIONS === "1") {
      console.warn("SKIP_DB_MIGRATIONS=1 — migrations were not applied.");
    } else {
      await runMigrations();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      "Database initialization failed. Fix DATABASE_* in backend/.env.local, ensure PostgreSQL is running, then restart.\n",
      message,
    );
    if (process.env.REQUIRE_DB_BEFORE_START === "1") {
      process.exit(1);
    }
  }
}

const listenPort = Number(String(PORT).trim()) || 5004;
app.listen(listenPort, "0.0.0.0", () => {
  console.log(
    `Server listening on http://127.0.0.1:${listenPort} (0.0.0.0:${listenPort})`,
  );
  void initDatabaseAfterListen();
});
