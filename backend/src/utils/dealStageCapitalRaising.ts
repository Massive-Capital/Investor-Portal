/**
 * Public LP preview, preview-token minting, and LP self-serve invest flows
 * are limited to this stage (matches DB / form values and legacy aliases).
 */
export function isDealStageCapitalRaising(
  raw: string | null | undefined,
): boolean {
  const s = String(raw ?? "").trim().toLowerCase()
  return s === "capital_raising" || s === "raising_capital"
}
