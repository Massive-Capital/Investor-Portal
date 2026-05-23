import HelloSign from "hellosign-embedded"
import { useLayoutEffect, useRef } from "react"
import "./dropbox-sign-embedded.css"

export type DropboxSignEmbeddedSignerProps = {
  signUrl: string
  clientId: string
  testMode: boolean
  /** When true, embed in the host element instead of a body-level modal. */
  useInlineContainer?: boolean
  onSigned?: () => void
  onCancel?: () => void
  onError?: (message: string) => void
  onOpened?: () => void
}

/**
 * Opens Dropbox Sign embedded signing via hellosign-embedded (client_id required).
 * Mount once per fresh signUrl — URLs expire on first access (avoid StrictMode double-open).
 */
export function DropboxSignEmbeddedSigner({
  signUrl,
  clientId,
  testMode,
  useInlineContainer = false,
  onSigned,
  onCancel,
  onError,
  onOpened,
}: DropboxSignEmbeddedSignerProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const onSignedRef = useRef(onSigned)
  const onCancelRef = useRef(onCancel)
  const onErrorRef = useRef(onError)
  const onOpenedRef = useRef(onOpened)
  const finishedRef = useRef(false)

  onSignedRef.current = onSigned
  onCancelRef.current = onCancel
  onErrorRef.current = onError
  onOpenedRef.current = onOpened

  useLayoutEffect(() => {
    const url = signUrl?.trim()
    const cid = clientId?.trim()
    if (!url || !cid) return

    finishedRef.current = false

    const container =
      useInlineContainer && hostRef.current ? hostRef.current : undefined

    if (useInlineContainer && !container) return

    const client = new HelloSign({ clientId: cid })

    const notifySigned = () => {
      if (finishedRef.current) return
      finishedRef.current = true
      onSignedRef.current?.()
    }

    client.on("sign", notifySigned)
    client.on("finish", notifySigned)

    client.on("cancel", () => {
      onCancelRef.current?.()
    })

    client.on("error", (err) => {
      const e = err as { code?: string; message?: string }
      const detail = e?.code ?? e?.message
      onErrorRef.current?.(
        detail ? `Dropbox Sign error: ${detail}` : "Dropbox Sign signing error",
      )
    })

    let cancelled = false

    const openTimer = window.setTimeout(() => {
      if (cancelled) return
      try {
        const openOptions = {
          clientId: cid,
          skipDomainVerification: testMode,
          allowCancel: true,
          ...(testMode ? { testMode: true } : {}),
          ...(container ? { container } : {}),
        }
        client.open(url, openOptions as Parameters<typeof client.open>[1])
        onOpenedRef.current?.()
      } catch (err) {
        onErrorRef.current?.(
          err instanceof Error ? err.message : "Could not open signing session",
        )
      }
    }, 50)

    return () => {
      cancelled = true
      window.clearTimeout(openTimer)
      try {
        client.close()
      } catch {
        /* ignore */
      }
    }
  }, [clientId, signUrl, testMode, useInlineContainer])

  return (
    <div
      ref={hostRef}
      className={`dropbox_sign_embedded_host${useInlineContainer ? " dropbox_sign_embedded_host_inline" : ""}`}
      role="region"
      aria-label="Dropbox Sign document signing"
    />
  )
}
