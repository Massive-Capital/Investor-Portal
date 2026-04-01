import type { FormEvent } from "react"
import { useCallback, useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { AtSign, Mail, Phone, User } from "lucide-react"
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
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const loadFromSession = useCallback(() => {
    const u = readSessionUser()
    if (!u) return
    setFirstName(str(u, "firstName"))
    setLastName(str(u, "lastName"))
    setPhone(str(u, "phone"))
    setEmail(str(u, "email"))
    setUsername(str(u, "username"))
  }, [])

  useEffect(() => {
    loadFromSession()
  }, [location.pathname, loadFromSession])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setIsSaving(true)
    try {
      const { user } = await patchMyProfile({
        firstName,
        lastName,
        phone,
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
          <input
            id="myaccount-phone"
            name="phone"
            type="text"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              if (error) setError("")
            }}
            disabled={isSaving}
            aria-invalid={!!error}
          />
        </div>
        <div className="myaccount_actions">
          <button
            type="submit"
            className="um_btn_primary"
            disabled={isSaving}
          >
            {isSaving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  )
}
