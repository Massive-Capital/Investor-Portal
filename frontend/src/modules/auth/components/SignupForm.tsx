import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle,
  CircleAlert,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  User,
} from "lucide-react";
import FooterForm from "../../../common/components/FooterForm";
import Input from "../../../common/components/Input";
import { getApiV1Base } from "../../../common/utils/apiBaseUrl";
import "./signup_form.css";
import { decodeJwtPayload } from "../utils/decode-jwt-payload";

const LOGIN_PATH = "/signin";

const PHONE_MIN_DIGITS = 7;
const PHONE_MAX_DIGITS = 15;

function digitsOnlyPhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, PHONE_MAX_DIGITS);
}

export default function SignupForm() {
  const apiV1 = getApiV1Base();
  const navigate = useNavigate();
  const { token } = useParams();

  const [isVisible, setIsVisible] = useState(false);
  const [isVisibleConfirm, setIsVisibleConfirm] = useState(false);
  const [isConfirmSignup, setIsConfirmSignup] = useState(false);
  const [isError, setIsError] = useState("");
  const [linkExpired, setLinkExpired] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const decode = token
    ? decodeJwtPayload<{ email?: string; companyName?: string; exp?: number }>(
        token,
      )
    : null;
  const decodeEmail = decode?.email ?? "";
  const decodeCompanyName = (decode?.companyName ?? "").trim();

  useEffect(() => {
    if (decodeEmail) {
      setSignUpFormData((prev) => ({ ...prev, email: decodeEmail }));
    }
  }, [decodeEmail]);

  useEffect(() => {
    if (decodeCompanyName) {
      setSignUpFormData((prev) => ({
        ...prev,
        companyName: decodeCompanyName,
      }));
    }
  }, [decodeCompanyName]);

  useEffect(() => {
    if (!token) {
      setLinkExpired(false);
      return;
    }
    const d = decodeJwtPayload<{ exp?: number }>(token);
    if (!d) {
      setLinkExpired(true);
      return;
    }
    if (d.exp != null && d.exp < Date.now() / 1000) {
      setLinkExpired(true);
      return;
    }
    setLinkExpired(false);
  }, [token]);

  const REDIRECT_DELAY_MS = 5000;
  useEffect(() => {
    if (!isConfirmSignup) return;
    const timer = setTimeout(() => {
      navigate(LOGIN_PATH, { replace: true });
    }, REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isConfirmSignup, navigate]);

  const [signUpFormData, setSignUpFormData] = useState<SignUpFormState>({
    email: decodeEmail,
    companyName: "",
    phone: "",
    firstName: "",
    lastName: "",
    userName: "",
    newPassword: "",
    confirmPassword: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    if (name === "phone") {
      setSignUpFormData((prev) => ({
        ...prev,
        phone: digitsOnlyPhone(value),
      }));
    } else {
      setSignUpFormData((prev) => ({ ...prev, [name]: value }));
    }
    if (isError) setIsError("");
  }

  function passwordVisible() {
    setIsVisible((prev) => !prev);
  }

  function confirmPasswordVisible() {
    setIsVisibleConfirm((prev) => !prev);
  }

  const phoneOk =
    signUpFormData.phone.length >= PHONE_MIN_DIGITS &&
    signUpFormData.phone.length <= PHONE_MAX_DIGITS &&
    /^\d+$/.test(signUpFormData.phone);

  const isDisabledBtn =
    Object.values(signUpFormData).some((val) => val.trim() === "") ||
    !phoneOk ||
    isConfirmSignup ||
    isLoading ||
    !termsAccepted;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!apiV1) {
      setIsError("API base URL is not configured (VITE_BASE_URL).");
      return;
    }
    const phoneDigits = digitsOnlyPhone(signUpFormData.phone);
    if (
      phoneDigits.length < PHONE_MIN_DIGITS ||
      phoneDigits.length > PHONE_MAX_DIGITS
    ) {
      setIsError(
        `Phone number must be ${PHONE_MIN_DIGITS}–${PHONE_MAX_DIGITS} digits (numbers only).`,
      );
      return;
    }
    setIsLoading(true);
    setIsError("");
    try {
      const path = token
        ? `${apiV1}/auth/signup/${encodeURIComponent(token)}`
        : `${apiV1}/auth/signup`;
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: signUpFormData.email.trim().toLowerCase(),
          companyName: signUpFormData.companyName.trim(),
          userName: signUpFormData.userName.trim(),
          phone: phoneDigits,
          firstName: signUpFormData.firstName.trim(),
          lastName: signUpFormData.lastName.trim(),
          newPassword: signUpFormData.newPassword,
          confirmPassword: signUpFormData.confirmPassword,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok) {
        setIsError(
          data.message || "Could not create your account. Please try again.",
        );
        return;
      }
      setIsConfirmSignup(true);
    } catch {
      setIsError("Unable to connect. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }

  if (linkExpired) {
    return (
      <>
        <div
          className="authMessage authMessage--error"
          style={{ marginTop: "0.5em", marginBottom: 0 }}
        >
          <CircleAlert className="authMessage__icon" size={16} aria-hidden />
          <p className="orgError">
            Signup link has expired or is invalid. This link is valid for 7 days
            from when it was sent. Please ask your administrator to resend the
            invite.
          </p>
        </div>
        <p className="forgotPassword" style={{ marginTop: "1rem" }}>
          <Link to={LOGIN_PATH}>
            <span>Back to sign in</span>
          </Link>
        </p>
      </>
    );
  }

  if (isConfirmSignup) {
    return (
      <div
        className="authMessage authMessage--success"
        style={{
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: "1rem",
        }}
      >
        <CheckCircle size={48} aria-hidden className="authMessage__icon" />
        <p className="loginSuccess" style={{ fontSize: "1rem" }}>
          Your account has been{" "}
          <span style={{ fontWeight: 600 }}>successfully activated.</span>
        </p>
        <p className="contentTwo">Redirecting to sign in in a few seconds…</p>
        <Link to={LOGIN_PATH} className="login-btn signup_success_signin_btn">
          Sign in <ArrowRight width={20} aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="signup_page">
        <div className="signup_modal_content">
          <form
            className="settings_form"
            autoComplete="off"
            onSubmit={handleSubmit}
          >
        <div className="signupForm_row">
          <div className="emailData">
            <Input
              labelName="Email"
              id="signup-email"
              icon={<Mail width={20} strokeWidth={1.5} aria-hidden />}
              type="email"
              name="email"
              value={signUpFormData.email}
              onChange={handleChange}
              readOnly={Boolean(token && decodeEmail)}
              disabled={isLoading}
              aria-invalid={!!isError}
              required
            />
          </div>
          <div className="emailData">
            <Input
              labelName="Company name"
              id="signup-companyName"
              icon={<Building2 width={20} strokeWidth={1.5} aria-hidden />}
              type="text"
              name="companyName"
              value={signUpFormData.companyName}
              onChange={handleChange}
              readOnly={Boolean(token && decodeCompanyName)}
              disabled={isLoading}
              aria-invalid={!!isError}
              required
            />
          </div>
        </div>

        <div className="signupForm_row">
          <div className="emailData">
            <Input
              labelName="User name"
              id="signup-userName"
              icon={<User width={20} strokeWidth={1.5} aria-hidden />}
              type="text"
              name="userName"
              value={signUpFormData.userName}
              onChange={handleChange}
              disabled={isLoading}
              aria-invalid={!!isError}
              required
            />
          </div>
          <div className="emailData">
            <Input
              labelName="Phone number"
              id="signup-phone"
              icon={<Phone width={20} strokeWidth={1.5} aria-hidden />}
              type="text"
              inputMode="numeric"
              autoComplete="tel"
              name="phone"
              value={signUpFormData.phone}
              onChange={handleChange}
              maxLength={PHONE_MAX_DIGITS}
              disabled={isLoading}
              aria-invalid={!!isError}
              required
            />
          </div>
        </div>

        <div className="signupForm_row">
          <div className="emailData">
            <Input
              labelName="First name"
              id="signup-firstName"
              icon={<User width={20} strokeWidth={1.5} aria-hidden />}
              type="text"
              name="firstName"
              value={signUpFormData.firstName}
              onChange={handleChange}
              disabled={isLoading}
              aria-invalid={!!isError}
              required
            />
          </div>
          <div className="emailData">
            <Input
              labelName="Last name"
              id="signup-lastName"
              icon={<User width={20} strokeWidth={1.5} aria-hidden />}
              type="text"
              name="lastName"
              value={signUpFormData.lastName}
              onChange={handleChange}
              disabled={isLoading}
              aria-invalid={!!isError}
              required
            />
          </div>
        </div>

        <div className="signupForm_row">
          <div className="passwordData">
            <Input
              labelName="New password"
              id="signup-newPassword"
              icon={<LockKeyhole width={20} strokeWidth={1.5} aria-hidden />}
              type={isVisible ? "text" : "password"}
              name="newPassword"
              value={signUpFormData.newPassword}
              onChange={handleChange}
              placeholder="......."
              maxLength={16}
              disabled={isLoading}
              aria-invalid={!!isError}
              required
              suffix={
                <span
                  onClick={passwordVisible}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      passwordVisible();
                    }
                  }}
                  className="passwordVisible"
                  role="button"
                  tabIndex={0}
                  aria-label={isVisible ? "Hide password" : "Show password"}
                >
                  {isVisible ? (
                    <Eye size={20} strokeWidth={1.5} aria-hidden />
                  ) : (
                    <EyeOff size={20} strokeWidth={1.5} aria-hidden />
                  )}
                </span>
              }
            />
          </div>
          <div className="passwordData">
            <Input
              labelName="Confirm password"
              id="signup-confirmPassword"
              icon={<LockKeyhole width={20} strokeWidth={1.5} aria-hidden />}
              type={isVisibleConfirm ? "text" : "password"}
              name="confirmPassword"
              value={signUpFormData.confirmPassword}
              onChange={handleChange}
              placeholder="......."
              maxLength={16}
              disabled={isLoading}
              aria-invalid={!!isError}
              required
              suffix={
                <span
                  onClick={confirmPasswordVisible}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      confirmPasswordVisible();
                    }
                  }}
                  className="passwordVisible"
                  role="button"
                  tabIndex={0}
                  aria-label={
                    isVisibleConfirm ? "Hide password" : "Show password"
                  }
                >
                  {isVisibleConfirm ? (
                    <Eye size={20} strokeWidth={1.5} aria-hidden />
                  ) : (
                    <EyeOff size={20} strokeWidth={1.5} aria-hidden />
                  )}
                </span>
              }
            />
          </div>
        </div>

        <div className="terms_policy">
          <input
            type="checkbox"
            id="termsandpolicy"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            disabled={isLoading}
          />
          <label htmlFor="termsandpolicy">
            I agree to the{" "}
            <Link to="/termsandservices" className="terms">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link className="policy" to="/privacypolicy">
              Privacy Policy
            </Link>
          </label>
        </div>

        {isError ? (
          <div
            className="authMessage authMessage--error"
            style={{ marginTop: "0.5em", marginBottom: 0 }}
          >
            <CircleAlert className="authMessage__icon" size={16} aria-hidden />
            <p className="orgError">{isError}</p>
          </div>
        ) : null}

        <div className="loginBtn">
          <button
            type="submit"
            className={`login-btn ${isDisabledBtn ? "disabled_css" : ""} ${isLoading ? "auth_btn_loading" : ""}`}
            disabled={isDisabledBtn}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <Loader2 className="auth_spinner" size={20} aria-hidden />
            ) : (
              <>
                Create account <ArrowRight width={20} aria-hidden />
              </>
            )}
          </button>
        </div>
          <div>
                  <p className="forgotPassword">
                    Already have an account!
                    <Link to="/signin">
                      <span>Signin</span>
                    </Link>
                  </p>
                </div>

        <div className="companyContent">
          <div className="contentOne">
            <FooterForm />
          </div>
        </div>
          </form>
        </div>
      </div>
    </>
  );
}

interface SignUpFormState {
  email: string;
  companyName: string;
  firstName: string;
  lastName: string;
  userName: string;
  phone: string;
  newPassword: string;
  confirmPassword: string;
}
