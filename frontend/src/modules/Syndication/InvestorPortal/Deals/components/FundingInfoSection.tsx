import { useId, useState } from "react"
import { InfoIconPanel } from "./FieldInfoHeading"

type FundingToggleProps = {
  checked: boolean
  onChange: (next: boolean) => void
  id: string
  labelId: string
}

function FundingToggle({ checked, onChange, id, labelId }: FundingToggleProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      className={`deal_fi_toggle${checked ? " deal_fi_toggle_on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="deal_fi_toggle_track" aria-hidden>
        <span className="deal_fi_toggle_thumb" />
      </span>
    </button>
  )
}

const INVESTMENT_FEE_OPTIONS = [
  { value: "none", label: "No fee" },
  { value: "flat", label: "Flat amount" },
  { value: "percent", label: "Percentage of commitment" },
] as const

const INVESTMENT_FEE_HELP_P1 =
  'Investment fees are additional charges for an investment that does not count toward the investment amount. For example, this could be a flat fee charged for an investment payment, or a "true up" as a result of a previous tranche.'
const INVESTMENT_FEE_HELP_P2 =
  'Investment fees are not enforced with wire transfers. For wire transfers, please indicate the fee amount within the "Wire transfer details" section.'

export function FundingInfoSection() {
  const baseId = useId()
  const [achEnabled, setAchEnabled] = useState(false)
  const [wireEnabled, setWireEnabled] = useState(true)
  const [checksEnabled, setChecksEnabled] = useState(false)
  const [receivingBankAccount, setReceivingBankAccount] = useState("")
  const [investmentFeeMethod, setInvestmentFeeMethod] = useState("none")
  const [checkInstructions, setCheckInstructions] = useState("")

  const achTitleId = `${baseId}-ach-title`
  const wireTitleId = `${baseId}-wire-title`
  const checksTitleId = `${baseId}-checks-title`
  const feeTitleId = `${baseId}-fee-title`

  return (
    <div className="deal_fi_root">
      <div className="deal_fi_stack">
        {/* Integrated ACH */}
        <section className="deal_fi_card" aria-labelledby={achTitleId}>
          <div className="deal_fi_card_main">
            <FundingToggle
              id={`${baseId}-ach-switch`}
              labelId={achTitleId}
              checked={achEnabled}
              onChange={setAchEnabled}
            />
            <div className="deal_fi_card_body">
              <div className="deal_fi_title_row">
                <h3 className="deal_fi_card_title" id={achTitleId}>
                  Integrated ACH payments
                </h3>
                <span className="deal_fi_badge deal_fi_badge_recommended">
                  Recommended
                </span>
              </div>
              <p className="deal_fi_desc">
                Payments are linked to the investment and tracked automatically,
                with email notifications when payments are initiated and
                completed.{" "}
                <button type="button" className="deal_fi_inline_link">
                  Fee details
                </button>
                .
              </p>
              {achEnabled ? (
                <button type="button" className="deal_fi_text_link">
                  Connect external account
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {/* Wire */}
        <section className="deal_fi_card" aria-labelledby={wireTitleId}>
          <div className="deal_fi_card_main">
            <FundingToggle
              id={`${baseId}-wire-switch`}
              labelId={wireTitleId}
              checked={wireEnabled}
              onChange={setWireEnabled}
            />
            <div className="deal_fi_card_body">
              <h3 className="deal_fi_card_title" id={wireTitleId}>
                Wire transfers
              </h3>
              <p className="deal_fi_desc">
                Our system will generate a PDF of these instructions for your
                LPs. You can also upload your own PDF in Offering documents.
              </p>
              {wireEnabled ? (
                <>
                  <div className="deal_fi_field_block">
                    <label
                      className="deal_fi_label"
                      htmlFor={`${baseId}-receiving-bank`}
                    >
                      Receiving bank account
                    </label>
                    <input
                      id={`${baseId}-receiving-bank`}
                      type="text"
                      className="deal_fi_input"
                      autoComplete="off"
                      placeholder="Account name or reference"
                      value={receivingBankAccount}
                      onChange={(e) => setReceivingBankAccount(e.target.value)}
                    />
                  </div>
                  <p className="deal_fi_footnote">
                    When no wire instructions have been provided, LPs will be
                    asked to contact their sponsor for wire details.
                  </p>
                </>
              ) : null}
            </div>
          </div>
        </section>

        {/* Checks */}
        <section className="deal_fi_card" aria-labelledby={checksTitleId}>
          <div className="deal_fi_card_main">
            <FundingToggle
              id={`${baseId}-checks-switch`}
              labelId={checksTitleId}
              checked={checksEnabled}
              onChange={setChecksEnabled}
            />
            <div className="deal_fi_card_body">
              <h3 className="deal_fi_card_title" id={checksTitleId}>
                Checks
              </h3>
              <p className="deal_fi_desc">
                Enter instructions for mailing a check. This is not recommended
                for most use cases.
              </p>
              {checksEnabled ? (
                <div className="deal_fi_field_block">
                  <label
                    className="deal_fi_label"
                    htmlFor={`${baseId}-check-notes`}
                  >
                    Mailing instructions
                  </label>
                  <textarea
                    id={`${baseId}-check-notes`}
                    className="deal_fi_textarea"
                    rows={4}
                    placeholder="Payee name, address, memo line, etc."
                    value={checkInstructions}
                    onChange={(e) => setCheckInstructions(e.target.value)}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* Investment fee */}
        <section className="deal_fi_card" aria-labelledby={feeTitleId}>
          <div className="deal_fi_card_main deal_fi_card_main_no_toggle">
            <div className="deal_fi_card_body deal_fi_card_body_full">
              <h3 className="deal_fi_card_title" id={feeTitleId}>
                Investment fee (advanced)
              </h3>
              <p className="deal_fi_desc">
                Configure an additional fee charged to the investor upon funding
                the investment. This is not for use as an acquisition fee.
              </p>
              <div className="deal_fi_field_block">
                <div className="deal_fi_label_row">
                  <label
                    className="deal_fi_label"
                    htmlFor={`${baseId}-fee-method`}
                  >
                    Investment fee method
                  </label>
                  <InfoIconPanel
                    ariaLabel="More information: investment fee method"
                    infoContent={
                      <>
                        <p>{INVESTMENT_FEE_HELP_P1}</p>
                        <p>{INVESTMENT_FEE_HELP_P2}</p>
                      </>
                    }
                  />
                </div>
                <select
                  id={`${baseId}-fee-method`}
                  className="deal_fi_select"
                  value={investmentFeeMethod}
                  onChange={(e) => setInvestmentFeeMethod(e.target.value)}
                >
                  {INVESTMENT_FEE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
