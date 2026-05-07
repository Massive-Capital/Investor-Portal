interface LpDealStickyCtaProps {
  label: string
  onInvest: () => void
  busy?: boolean
}

export function LpDealStickyCta({
  label,
  onInvest,
  busy = false,
}: LpDealStickyCtaProps) {
  return (
    <div className="lpdd_sticky_cta" role="complementary" aria-label="Quick invest">
      <div className="lpdd_sticky_cta_inner">
        <button
          type="button"
          className="lpdd_btn_primary lpdd_sticky_cta_btn"
          onClick={onInvest}
          disabled={busy}
        >
          {label}
        </button>
      </div>
    </div>
  )
}
