import { Loader2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "@/common/components/Toast"
import { fetchMyProfileBook, postInvestorProfile } from "./investingProfileBookApi"
import { AddInvestorProfileModal } from "./AddInvestorProfileModal"
import type { NewInvestorProfilePayload } from "./investor-profiles.types"
import type { SavedAddress } from "./address.types"
import "@/modules/usermanagement/user_management.css"
import "@/modules/Syndication/InvestorPortal/Deals/deals-list.css"
import "@/modules/Syndication/InvestorPortal/Deals/deals-create.css"
import "./add-investor-profile-modal.css"

/**
 * Full-page add profile (same shell as Create deal) — route `/investing/profiles/add`.
 * Layout, header, stepper, and section are rendered by `AddInvestorProfileModal` (page variant).
 */
export function AddInvestorProfilePage() {
  const navigate = useNavigate()
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const book = await fetchMyProfileBook()
        if (!cancelled) setSavedAddresses(book.addresses)
      } catch {
        if (!cancelled) {
          setSavedAddresses([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const goBack = useCallback(() => {
    navigate("/investing/profiles")
  }, [navigate])

  const onProfileCreated = useCallback(
    async (p: NewInvestorProfilePayload) => {
      await postInvestorProfile(p)
      toast.success("Profile added", "Your new profile was saved.")
      navigate("/investing/profiles")
    },
    [navigate],
  )

  if (loading) {
    return (
      <div className="deals_list_page deals_detail_page deals_add_investor_class_page deals_add_deal_asset_page deals_create_flow">
        <section
          className="deals_create_loading_panel"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2
            className="deals_create_loading_icon"
            size={28}
            strokeWidth={2}
            aria-hidden
          />
          <p className="deals_create_loading_text">Loading…</p>
        </section>
      </div>
    )
  }

  return (
    <AddInvestorProfileModal
      open
      variant="page"
      onClose={goBack}
      savedAddresses={savedAddresses}
      onProfileCreated={onProfileCreated}
    />
  )
}
