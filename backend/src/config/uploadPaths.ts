import * as path from "node:path";

const cwd = process.cwd();

/**
 * Folder on disk that Express serves at HTTP `/uploads/*`.
 *
 * - Env `UPLOADS_PHYSICAL_ROOT`: relative to backend `cwd` or absolute.
 * - Default: `src/storage/uploads` (keeps uploads under `src/` with the rest of the app).
 *
 * DB still stores paths like `deal-assets/<file>` (relative to this root).
 */
export function getUploadsPhysicalRoot(): string {
  const fromEnv = process.env.UPLOADS_PHYSICAL_ROOT?.trim();
  if (fromEnv)
    return path.isAbsolute(fromEnv) ? fromEnv : path.join(cwd, fromEnv);
  return path.join(cwd, "src", "storage", "uploads");
}
