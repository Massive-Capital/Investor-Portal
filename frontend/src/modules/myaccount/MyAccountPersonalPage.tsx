import type { FormEvent } from "react"
import { useCallback, useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { AtSign, Loader2, Mail, Phone, Save, User } from "lucide-react"
import { UsPhoneInput } from "../../common/components/UsPhoneInput"
import {
  national10ToE164,
  nationalDigitsFromStoredPhone,
  nationalTenDigitsFromRawInput,
} from "../../common/phone/usPhoneNumber"
import { toast } from "../../common/components/Toast"
import { patchMyProfile } from "./accountApi"
import { mergeSessionUserDetails, readSessionUser } from "./sessionUser"

function str(u: Record<string, unknown>, key: string): string {
  return String(u[key] ?? "").trim()
}

export function MyAccountPersonalPage() {
  const location = useLocation()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phoneNationalDigits, setPhoneNationalDigits] = useState("")
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const loadFromSession = useCallback(() => {
    const u = readSessionUser()
    if (!u) return
    setFirstName(str(u, "firstName"))
    setLastName(str(u, "lastName"))
    setPhoneNationalDigits(nationalDigitsFromStoredPhone(str(u, "phone")))
    setEmail(str(u, "email"))
    setUsername(str(u, "username"))
  }, [])

  useEffect(() => {
    loadFromSession()
  }, [location.pathname, loadFromSession])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    const d = nationalTenDigitsFromRawInput(phoneNationalDigits)
    if (d.length > 0 && d.length < 10) {
      setError("Enter a complete 10-digit U.S. phone number.")
      return
    }
    if (d.length === 10) {
      const e164 = national10ToE164(phoneNationalDigits)
      if (!e164) {
        setError(
          "That is not a valid U.S. area code or exchange. Update the number or clear the field.",
        )
        return
      }
    }
    setIsSaving(true)
    try {
      const phonePayload =
        d.length === 0 ? "" : national10ToE164(phoneNationalDigits) ?? ""
      const { user } = await patchMyProfile({
        firstName,
        lastName,
        phone: phonePayload,
      })
      mergeSessionUserDetails(user)
      loadFromSession()
      toast.success("Personal details saved", "Your details were updated.")
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save personal details.",
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <h2 className="myaccount_section_title">Personal details</h2>
      <p className="myaccount_readonly_note">
        Email and username are managed by your administrator and cannot be
        changed here. Use Save changes to update your first name, last name,
        and phone in your profile (stored on the server).
      </p>
      {error ? (
        <p className="um_msg_error" role="alert">
          {error}
        </p>
      ) : null}
      <form onSubmit={handleSubmit}>
        <div className="um_field">
          <label htmlFor="myaccount-email" className="um_field_label_row">
            <Mail className="um_field_label_icon" size={17} aria-hidden />
            <span>Email</span>
          </label>
          <input
            id="myaccount-email"
            name="email"
            type="email"
            value={email}
            onChange={() => {}}
            placeholder="name@company.com"
            readOnly
          />
        </div>
        <div className="um_field">
          <label htmlFor="myaccount-username" className="um_field_label_row">
            <AtSign className="um_field_label_icon" size={17} aria-hidden />
            <span>Username</span>
          </label>
          <input
            id="myaccount-username"
            name="username"
            type="text"
            value={username}
            onChange={() => {}}
            readOnly
          />
        </div>
        <div className="um_field">
          <label htmlFor="myaccount-firstName" className="um_field_label_row">
            <User className="um_field_label_icon" size={17} aria-hidden />
            <span>First name</span>
          </label>
          <input
            id="myaccount-firstName"
            name="firstName"
            type="text"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value)
              if (error) setError("")
            }}
            disabled={isSaving}
            aria-invalid={!!error}
          />
        </div>
        <div className="um_field">
          <label htmlFor="myaccount-lastName" className="um_field_label_row">
            <User className="um_field_label_icon" size={17} aria-hidden />
            <span>Last name</span>
          </label>
          <input
            id="myaccount-lastName"
            name="lastName"
            type="text"
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value)
              if (error) setError("")
            }}
            disabled={isSaving}
            aria-invalid={!!error}
          />
        </div>
        <div className="um_field">
          <label htmlFor="myaccount-phone" className="um_field_label_row">
            <Phone className="um_field_label_icon" size={17} aria-hidden />
            <span>Phone</span>
          </label>
          <UsPhoneInput
            id="myaccount-phone"
            name="phone"
            nationalDigits={phoneNationalDigits}
            onNationalDigitsChange={(next) => {
              setPhoneNationalDigits(next)
              if (error) setError("")
            }}
            disabled={isSaving}
            className="um_field_input"
            invalidClassName="um_field_input_invalid"
            aria-invalid={!!error}
          />
        </div>
        <div className="myaccount_actions">
          <button
            type="submit"
            className="um_btn_primary"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2
                  size={16}
                  strokeWidth={2}
                  className="myaccount_btn_spin"
                  aria-hidden
                />
                Saving…
              </>
            ) : (
              <>
                <Save size={16} strokeWidth={2} aria-hidden />
                Save changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
