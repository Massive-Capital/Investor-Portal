import dotenv from "dotenv";

// dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import express from "express";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./database/db.js";
import { getUploadsPhysicalRoot } from "./config/uploadPaths.js";
import { postCompanySettingsBranding } from "./controllers/company/companySettingsBranding.controller.js";
import { uploadCompanySettingsBranding } from "./middleware/companySettingsBrandingUpload.middleware.js";
import userRoutes from "./routes/userRoutes.routes.js";
import companyRoutes from "./routes/companyRoutes.routes.js";
import dealFormRoutes from "./routes/dealForm.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import investingProfileBookRoutes from "./routes/investingProfileBook.routes.js";


const PORT = process.env.BACKEND_PORT ?? 5004;
const app = express();

const baseUrl = process.env.BASE_URL?.trim();
const allowedOrigins: string[] = [...(baseUrl ? [baseUrl] : [])];

// CORS first so preflight (OPTIONS) and all responses get correct headers
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (e.g. Postman, same-origin) or when origin is in the list
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      // In development, allow any localhost origin so CORS never blocks
      if (
        process.env.NODE_ENV !== "production" &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return cb(null, true);
      }
      return cb(null, true);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "X-Requested-With",
    ],
    credentials: true,
    optionsSuccessStatus: 204,
  }),
);

// Ensure CORS headers are on every response (even 4xx/5xx) so browser can read the body
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (
    origin &&
    (allowedOrigins.includes(origin) ||
      (process.env.NODE_ENV !== "production" &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)))
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  next();
});

/* Multipart branding upload must run before any body parser (multer/busboy reads the stream). */
app.post(
  "/api/v1/companies/:companyId/settings/branding/:assetType",
  uploadCompanySettingsBranding,
  postCompanySettingsBranding,
);

// Allow larger request bodies (default is ~100kb; Investor Portal and other forms can exceed this)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Preflight: respond to OPTIONS for any /api/v1 path with 204 (CORS headers set by cors() above)
app.use("/api/v1", (req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});


const uploadsRoot = getUploadsPhysicalRoot();
app.use("/uploads", express.static(uploadsRoot, {
  fallthrough: true,
  maxAge: "1d",
}));
console.log("Static /uploads →", uploadsRoot);

app.use("/api/v1", [
  userRoutes,
  companyRoutes,
  dealFormRoutes,
  contactRoutes,
  investingProfileBookRoutes,
]);

console.log("Starting server...");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations(): Promise<void> {
  const migrationsFolder = path.resolve(__dirname, "..", "migrations");
  await migrate(db, { migrationsFolder });
  console.log("Database migrations applied.");
}

/** Ensures the pool can open a connection (no SQL executed here). */
async function verifyPoolConnection(): Promise<void> {
  const client = await pool.connect();
  client.release();
  console.log("Database pool ready.");
}

/**
 * If DB init fails *before* listen, nothing binds to the port and the Vite (or nginx) proxy
 * returns 502 with no useful error. We listen first, then connect/migrate, so the process is
 * always reachable; DB issues become 500/503 on routes and clear logs here.
 */
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
