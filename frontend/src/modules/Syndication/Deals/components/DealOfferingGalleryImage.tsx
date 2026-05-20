import { useCallback, useEffect, useState } from "react"
import { normalizeDealGallerySrc } from "@/common/utils/apiBaseUrl"

function fallbackGallerySrc(src: string, attempt: number): string {
  const normalized = normalizeDealGallerySrc(src).trim()
  if (!normalized) return ""
  if (attempt === 0) return normalized
  try {
    if (/^https?:\/\//i.test(normalized)) {
      const u = new URL(normalized)
      const lower = u.pathname.toLowerCase()
      const idx = lower.indexOf("/uploads/")
      if (idx >= 0) {
        const pathOnly = `${u.pathname.slice(idx)}${u.search || ""}`
        if (pathOnly !== normalized && pathOnly.startsWith("/uploads/")) {
          if (typeof window !== "undefined") {
            return `${window.location.origin.replace(/\/$/, "")}${pathOnly}`
          }
          return pathOnly
        }
      }
    }
  } catch {
    /* ignore */
  }
  return ""
}

export interface DealOfferingGalleryImageProps {
  src: string
  alt?: string
  className?: string
  loading?: "eager" | "lazy"
  fetchPriority?: "high" | "low" | "auto"
  decoding?: "async" | "sync" | "auto"
}

/** Gallery `<img>` with URL normalization and a same-origin `/uploads/` retry on error. */
export function DealOfferingGalleryImage({
  src,
  alt = "",
  className,
  loading = "lazy",
  fetchPriority,
  decoding = "async",
}: DealOfferingGalleryImageProps) {
  const [attempt, setAttempt] = useState(0)
  const resolved = fallbackGallerySrc(src, attempt) || normalizeDealGallerySrc(src)

  useEffect(() => {
    setAttempt(0)
  }, [src])

  const onError = useCallback(() => {
    setAttempt((n) => (n < 1 ? n + 1 : n))
  }, [])

  if (!resolved) return null

  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding={decoding}
      onError={onError}
    />
  )
}
