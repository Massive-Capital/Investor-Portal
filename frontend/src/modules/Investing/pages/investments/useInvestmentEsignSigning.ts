import { useCallback, useRef, useState } from "react"
import { fetchDealMyEsignSignSession } from "@/modules/Syndication/Deals/api/dealsApi"

export interface InvestmentEsignActiveSession {
  signUrl: string
  clientId: string
  testMode: boolean
  signatureRequestId: string | null
}

export type InvestmentEsignSignPhase =
  | "idle"
  | "loading"
  | "embed"
  | "completed"
  | "error"

export function useInvestmentEsignSigning(
  dealId: string,
  signatureRequestId?: string,
) {
  const [phase, setPhase] = useState<InvestmentEsignSignPhase>("idle")
  const [error, setError] = useState<string | null>(null)
  const [activeSession, setActiveSession] =
    useState<InvestmentEsignActiveSession | null>(null)
  const [embedKey, setEmbedKey] = useState(0)
  const loadGenRef = useRef(0)
  const loadingRef = useRef(false)

  const loadSession = useCallback(async () => {
    const id = dealId.trim()
    if (!id || loadingRef.current) return false
    loadingRef.current = true
    const gen = ++loadGenRef.current
    setPhase("loading")
    setError(null)

    const result = await fetchDealMyEsignSignSession(
      id,
      signatureRequestId?.trim() || undefined,
    )

    if (gen !== loadGenRef.current) {
      loadingRef.current = false
      return false
    }

    loadingRef.current = false

    if (!result.ok) {
      setError(result.message)
      setActiveSession(null)
      setPhase("error")
      return false
    }

    if (result.alreadyCompleted) {
      setActiveSession(null)
      setPhase("completed")
      return true
    }

    if (!result.configured) {
      setError("eSign is not configured on this portal. Contact your sponsor.")
      setActiveSession(null)
      setPhase("error")
      return false
    }

    if (!result.signUrl?.trim() || !result.clientId?.trim()) {
      setError(
        "Could not start signing. Ask your sponsor to resend the eSign request.",
      )
      setActiveSession(null)
      setPhase("error")
      return false
    }

    setActiveSession({
      signUrl: result.signUrl.trim(),
      clientId: result.clientId.trim(),
      testMode: result.testMode,
      signatureRequestId: result.signatureRequestId?.trim() || null,
    })
    setEmbedKey((k) => k + 1)
    setPhase("embed")
    return true
  }, [dealId, signatureRequestId])

  const reset = useCallback(() => {
    loadGenRef.current += 1
    loadingRef.current = false
    setPhase("idle")
    setError(null)
    setActiveSession(null)
    setEmbedKey(0)
  }, [])

  const clearEmbed = useCallback(() => {
    setActiveSession(null)
    setPhase((p) => (p === "embed" ? "error" : p))
  }, [])

  return {
    phase,
    error,
    activeSession,
    embedKey,
    loadSession,
    reset,
    clearEmbed,
    setError,
  }
}
