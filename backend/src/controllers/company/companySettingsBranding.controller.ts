import type { Request, Response } from "express";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getUploadsPhysicalRoot } from "../../config/uploadPaths.js";
import { getJwtUser } from "../../middleware/jwtUser.js";
import {
  upsertWorkspaceTabPayload,
  userCanEditCompanyWorkspace,
} from "../../services/companyWorkspaceSettings.service.js";

const ASSET_TYPES = new Set(["logo", "background", "logoIcon"]);

const ASSET_TYPE_TO_SETTINGS_KEY: Record<string, "logoImageUrl" | "backgroundImageUrl" | "logoIconUrl"> = {
  logo: "logoImageUrl",
  background: "backgroundImageUrl",
  logoIcon: "logoIconUrl",
};

const MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED_IMAGE_EXT = new Set(["png", "jpg", "webp", "gif", "svg", "ico"]);

function extFromMimetype(m: string): string {
  const m2 = m.toLowerCase();
  if (m2 === "image/png") return "png";
  if (m2 === "image/jpeg" || m2 === "image/jpg") return "jpg";
  if (m2 === "image/webp") return "webp";
  if (m2 === "image/gif") return "gif";
  if (m2 === "image/svg+xml") return "svg";
  if (
    m2 === "image/x-icon" ||
    m2 === "image/vnd.microsoft.icon" ||
    m2 === "image/ico"
  ) {
    return "ico";
  }
  return "";
}

function extFromOriginalFilename(originalname: string): string {
  const b = path.extname(originalname).toLowerCase();
  if (b === ".png") return "png";
  if (b === ".jpg" || b === ".jpeg") return "jpg";
  if (b === ".webp") return "webp";
  if (b === ".gif") return "gif";
  if (b === ".svg") return "svg";
  if (b === ".ico") return "ico";
  return "";
}

/**
 * Browsers / OS often send .ico (tab icons) with x-icon, octet-stream, or an empty type.
 * We only allow known extensions (see ALLOWED_IMAGE_EXT) after mimetype+filename fallbacks.
 */
function resolveBrandingFileExtension(
  mimetype: string,
  originalname: string,
): string {
  const m = String(mimetype || "").toLowerCase();
  const fromM = extFromMimetype(m);
  if (fromM && ALLOWED_IMAGE_EXT.has(fromM)) return fromM;
  const fromName = extFromOriginalFilename(originalname);
  if (fromName && ALLOWED_IMAGE_EXT.has(fromName)) return fromName;
  return "";
}

function isAcceptableBrandingMimetype(
  mimetype: string,
  hasKnownExt: boolean,
): boolean {
  const m = String(mimetype || "").toLowerCase();
  if (m.startsWith("image/")) return true;
  /** Some OS/browsers (esp. for SVG, ICO) send empty type, octet-stream, or text/plain. */
  if (
    hasKnownExt &&
    (m === "application/octet-stream" || m === "" || m === "text/plain")
  ) {
    return true;
  }
  return false;
}

function paramStr(v: string | string[] | undefined): string {
  if (v == null) return "";
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" ? s.trim() : "";
}

/** Disk path under `getUploadsPhysicalRoot()` for company branding files. */
const COMPANY_BRANDING_UPLOAD_SUBDIR = "company-branding";

/**
 * POST multipart `file` — image for company settings (logo, full-page background, favicon-style icon).
 * Files are stored under `uploads/company-branding/<companyId>/` and the response is
 * `{ url: "/uploads/company-branding/…" }` for the workspace `settings` tab JSON.
 */
export async function postCompanySettingsBranding(
  req: Request,
  res: Response,
): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }
  const companyId = paramStr(req.params.companyId);
  const assetType = paramStr(req.params.assetType);
  if (!companyId || !ASSET_TYPES.has(assetType)) {
    res.status(400).json({ message: "Invalid company or asset type" });
    return;
  }
  const can = await userCanEditCompanyWorkspace(
    user.id,
    user.userRole,
    companyId,
  );
  if (!can) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  const file = req.file;
  if (!file?.buffer?.length) {
    const ct = String(req.get("content-type") ?? "");
    if (process.env.NODE_ENV !== "production") {
      console.warn("postCompanySettingsBranding: no file buffer", {
        contentType: ct || null,
        hasFileObject: Boolean(req.file),
        method: req.method,
      });
    }
    res.status(400).json({
      message:
        ct && ct.toLowerCase().includes("multipart")
          ? 'Missing or empty "file" in multipart form.'
          : `Use multipart form-data with a field named "file". Received: ${ct || "no Content-Type"}`,
    });
    return;
  }
  if (file.size > MAX_BYTES) {
    res.status(400).json({ message: "File too large (max 8 MB)" });
    return;
  }
  const originalname = String(
    (file as { originalname?: string }).originalname ?? "",
  );
  const ext = resolveBrandingFileExtension(
    file.mimetype ?? "",
    originalname,
  );
  if (!ext) {
    res.status(400).json({
      message:
        "Unsupported file type. Use PNG, JPEG, WebP, GIF, SVG, or ICO (e.g. favicon).",
    });
    return;
  }
  if (!isAcceptableBrandingMimetype(String(file.mimetype || ""), Boolean(ext))) {
    res.status(400).json({ message: "File must be an image" });
    return;
  }
  const cid = companyId.toLowerCase();
  const fileName = `${assetType}-${Date.now()}.${ext}`;
  const root = getUploadsPhysicalRoot();
  const full = path.join(root, COMPANY_BRANDING_UPLOAD_SUBDIR, cid, fileName);
  const base = path.posix.join(
    COMPANY_BRANDING_UPLOAD_SUBDIR,
    cid,
    fileName,
  );
  try {
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, file.buffer);
  } catch (e) {
    console.error("postCompanySettingsBranding write:", e);
    res.status(500).json({ message: "Could not store file" });
    return;
  }
  const url = `/uploads/${base}`;
  const settingsKey = ASSET_TYPE_TO_SETTINGS_KEY[assetType];
  try {
    await upsertWorkspaceTabPayload(companyId, "settings", {
      [settingsKey]: url,
    });
  } catch (e) {
    console.error("postCompanySettingsBranding workspace settings update:", e);
    try {
      await fs.unlink(full);
    } catch {
      // ignore
    }
    res.status(500).json({
      message: "File was stored but workspace settings could not be updated. Try again.",
    });
    return;
  }
  res.status(200).json({ url });
}
