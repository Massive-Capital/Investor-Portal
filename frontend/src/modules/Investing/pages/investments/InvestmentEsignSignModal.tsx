import { FileSignature, Loader2, X } from "lucide-react"
import { useCallback, useEffect, useRef } from "react"
import { DropboxSignEmbeddedSigner } from "@/common/components/dropbox-sign-embedded/DropboxSignEmbeddedSigner"
import { toast } from "@/common/components/Toast"
import "@/modules/Syndication/Deals/deal-esign-ui.css"
import { useInvestmentEsignSigning } from "./useInvestmentEsignSigning"

export interface InvestmentEsignSignModalProps {
  open: boolean
  dealId: string
  /** When set, opens signing for this Dropbox Sign request (profile send). */
  signatureRequestId?: string | null
  onClose: () => void
  /** Called after successful sign (refresh documents list). */
  onSignedComplete?: () => void
}

export function InvestmentEsignSignModal({
  open,
  dealId,
  signatureRequestId,
  onClose,
  onSignedComplete,
}: InvestmentEsignSignModalProps) {
  const dealIdTrimmed = dealId.trim()
  const sigRequestId = signatureRequestId?.trim() || undefined
  const {
    phase,
    error,
    activeSession,
    embedKey,
    loadSession,
    reset,
    clearEmbed,
    setError,
  } = useInvestmentEsignSigning(dealIdTrimmed, sigRequestId)

  const signedHandledRef = useRef(false)

  const handleClose = useCallback(() => {
    signedHandledRef.current = false
    reset()
    onClose()
  }, [onClose, reset])

  const handleSigned = useCallback(() => {
    if (signedHandledRef.current) return
    signedHandledRef.current = true
    toast.success(
      "Documents signed",
      "Your signed documents will appear in the E-signatures tab shortly.",
    )
    reset()
    onSignedComplete?.()
    onClose()
  }, [onClose, onSignedComplete, reset])

  useEffect(() => {
    if (!open || !dealIdTrimmed) {
      signedHandledRef.current = false
      reset()
      return
    }

    signedHandledRef.current = false
    void loadSession()

    return () => {
      reset()
    }
  }, [open, dealIdTrimmed, sigRequestId, loadSession, reset])

  if (!open || !dealIdTrimmed) return null

  const showEmbed = phase === "embed" && activeSession && embedKey > 0
  const isLoading = phase === "loading"

  return (
    <div
      className="um_modal_overlay deal_esign_overlay deal_esign_overlay--signing"
      role="presentation"
      onClick={handleClose}
    >
      <div
        className="um_modal deal_esign_modal deal_esign_modal--signing"
        role="dialog"
        aria-modal="true"
        aria-labelledby="investment-esign-sign-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="um_modal_head">
          <h2
            id="investment-esign-sign-title"
            className="um_modal_title um_title_with_icon"
          >
            <FileSignature size={20} aria-hidden />
            <span>Sign documents</span>
          </h2>
          <button
            type="button"
            className="um_modal_close"
            onClick={handleClose}
            aria-label="Close signing"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className="deal_esign_modal_body deal_esign_modal_body--signing">
          <div className="deal_esign_modal_sign_stage">
            {isLoading && !showEmbed ? (
              <p className="deal_esign_status_row deal_esign_sign_loading" role="status">
                <Loader2
                  className="deal_esign_spin"
                  size={18}
                  strokeWidth={2}
                  aria-hidden
                />
                Preparing your signing session…
              </p>
            ) : null}

            {error && phase === "error" ? (
              <p className="deal_esign_notice deal_esign_notice--error" role="alert">
                {error}
              </p>
            ) : null}

            {phase === "completed" ? (
              <p className="deal_esign_notice" role="status">
                You have already completed signing for this deal.
              </p>
            ) : null}

            {phase === "error" ? (
              <div className="deal_esign_sign_actions">
                <button
                  type="button"
                  className="um_btn_primary"
                  onClick={() => void loadSession()}
                >
                  Try again
                </button>
              </div>
            ) : null}

            {showEmbed && activeSession ? (
              <div className="deal_esign_modal_sign_embed">
                <DropboxSignEmbeddedSigner
                  key={`${embedKey}-${activeSession.signUrl}`}
                  signUrl={activeSession.signUrl}
                  clientId={activeSession.clientId}
                  testMode={activeSession.testMode}
                  useInlineContainer
                  onSigned={handleSigned}
                  onCancel={handleClose}
                  onError={(msg) => {
                    setError(msg)
                    clearEmbed()
                    toast.error("Signing error", msg)
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="deal_esign_modal_foot">
          {/* <p className="deal_esign_modal_foot_hint">
            Complete all fields in the signing window, then submit. You can close
            this dialog and return later if you need to finish later.
          </p> */}
          <button type="button" className="um_btn_secondary" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
