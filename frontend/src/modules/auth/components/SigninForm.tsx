import React from "react";
import FooterForm from "../../../common/components/FooterForm";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle,
  CircleAlert,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { useState } from "react";
import Input from "../../../common/components/Input";
import {
  AUTH_RETURN_NEXT_KEY,
  SESSION_ACTIVITY_SESSION_ID_KEY,
  SESSION_BEARER_KEY,
  SESSION_USER_DETAILS_KEY,
} from "../../../common/auth/sessionKeys";
import { isPlatformAdmin } from "../../../common/auth/roleUtils";
import { getApiV1Base } from "../../../common/utils/apiBaseUrl";
import { dealInvestNowPath } from "../../Syndication/Deals/utils/dealInvestNowPath";
import { consumeInvestNowIntent } from "../../Syndication/Deals/utils/investNowIntent";
import { parseSafeNextPath } from "../../../common/auth/parseSafeNextPath";
import { toast } from "../../../common/components/Toast";
import { ensureActiveCompanyInitialized } from "../../../common/auth/setActiveCompany";
import "./signin_form.css";

const SigninForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const resetSuccess = location.state?.resetSuccess;
  const apiV1 = getApiV1Base();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [isError, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const passwordVisible = () => setIsVisible((prev) => !prev);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!apiV1) {
      setError("API base URL is not configured (VITE_BASE_URL).");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiV1}/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const rawBody = await response.text().catch(() => "");
      let data: {
        message?: string;
        token?: string;
        userDetails?: unknown;
        activitySessionId?: string;
      } = {};
      if (rawBody.trim()) {
        try {
          data = JSON.parse(rawBody) as typeof data;
        } catch {
          data = {};
        }
      }

      if (!response.ok) {
        if (response.status === 502 || response.status === 503) {
          setError(
            "Cannot reach the API. Start the backend (npm run dev in the backend folder) and ensure BACKEND_PORT in backend/.env.local matches the Vite proxy (default 5004).",
          );
          return;
        }
        const msg =
          data.message?.trim() ||
          (rawBody.trim() && !rawBody.trim().startsWith("{")
            ? rawBody.trim().slice(0, 240)
            : "") ||
          "Sign in failed. Please try again.";
        if (response.status === 403) {
          setError(
            data.message ||
              "Sign in forbidden (403). Check that the backend is running and Vite’s `/api` proxy target matches BACKEND_PORT (set VITE_DEV_API_PROXY if needed).",
          );
          return;
        }
        setError(msg);
        if (/user not found/i.test(msg)) {
          toast.error(
            "User not found",
            "No account matches that email. Check your details or sign up.",
          );
        }
        return;
      }
      if (data.token) {
        sessionStorage.setItem(SESSION_BEARER_KEY, data.token);
      }
      if (data.userDetails != null) {
        sessionStorage.setItem(
          SESSION_USER_DETAILS_KEY,
          JSON.stringify(data.userDetails),
        );
        ensureActiveCompanyInitialized();
      } else {
        sessionStorage.removeItem(SESSION_USER_DETAILS_KEY);
      }
      if (typeof data.activitySessionId === "string" && data.activitySessionId.trim()) {
        sessionStorage.setItem(
          SESSION_ACTIVITY_SESSION_ID_KEY,
          data.activitySessionId.trim(),
        );
      } else {
        sessionStorage.removeItem(SESSION_ACTIVITY_SESSION_ID_KEY);
      }
      const state = location.state as
        | { from?: string; investNow?: boolean }
        | undefined;
      const storedIntent = consumeInvestNowIntent();
      const from =
        parseSafeNextPath(state?.from) ??
        parseSafeNextPath(new URLSearchParams(location.search).get("next")) ??
        parseSafeNextPath(sessionStorage.getItem(AUTH_RETURN_NEXT_KEY));
      sessionStorage.removeItem(AUTH_RETURN_NEXT_KEY);
      let redirectTo = from
        ? from
        : isPlatformAdmin()
          ? "/metrics"
          : "/dashboard";
      if (!from && storedIntent?.dealId) {
        redirectTo = dealInvestNowPath(storedIntent.dealId);
      }
      if (redirectTo === "/") {
        redirectTo = isPlatformAdmin() ? "/metrics" : "/dashboard";
      }
      const wantsInvestNow =
        state?.investNow === true || Boolean(storedIntent?.dealId);
      const postSignInState = wantsInvestNow
        ? { investNow: true as const }
        : undefined;
      navigate(redirectTo, { replace: true, state: postSignInState });
    } catch {
      setError(
        "Unable to connect to the API. Start the backend with npm run dev in the backend folder (port 5004 by default), then refresh this page.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const isDisabledBtn = !email.trim() || !password.trim() || isLoading;

  const pendingEsignReturn =
    parseSafeNextPath(new URLSearchParams(location.search).get("next"))?.includes(
      "/esign",
    ) ?? false;

  return (
    <>
      {pendingEsignReturn ? (
        <p className="authMessage" role="status">
          Sign in with the email that received the eSign request. After sign-in you
          will be taken to the document signing page.
        </p>
      ) : null}
      <form autoComplete="off" onSubmit={handleSubmit}>
        <div className="emailData">
          <Input
            labelName="Email"
            id="loginEmail"
            icon={<Mail width={20} strokeWidth={1.5} aria-hidden />}
            type="email"
            name="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (isError) setError("");
            }}
            aria-invalid={!!isError}
            required
            requiredIndicator={false}
            disabled={isLoading}
          />
        </div>

        <div className="passwordData">
          <Input
            labelName="Password"
            id="loginPassword"
            icon={<LockKeyhole width={20} strokeWidth={1.5} aria-hidden />}
            type={isVisible ? "text" : "password"}
            name="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (isError) setError("");
            }}
            placeholder="......."
            aria-invalid={!!isError}
            required
            requiredIndicator={false}
            disabled={isLoading}
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

        {resetSuccess && (
          <div className="authMessage authMessage--success">
            <CheckCircle className="authMessage__icon" size={16} aria-hidden />
            <p className="loginSuccess">
              Password reset successfully. You can sign in with your new
              password.
            </p>
          </div>
        )}
        {isError && (
          <div
            className="authMessage authMessage--error"
            style={{ marginTop: "0.5em", marginBottom: 0 }}
          >
            <CircleAlert className="authMessage__icon" size={16} aria-hidden />
            <p className="orgError">{isError}</p>
          </div>
        )}

        <div className="loginBtn">
          <button
            type="submit"
            className={`login-btn ${isDisabledBtn ? "disabled_css" : ""} ${isLoading ? "auth_btn_loading" : ""}`}
            disabled={isDisabledBtn}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                Signing in…
                <Loader2 className="auth_spinner" size={20} aria-hidden />
              </>
            ) : (
              <>
                Sign in <ArrowRight width={20} />
              </>
            )}
          </button>
        </div>

        {/* <div>
          <p className="forgotPassword">
            <Link to="/forgotPassword">
              <span>Forgot Password?</span>
            </Link>
          </p>
        </div> */}
        <div>
          <p className="forgotPassword">
            Don't have an account?
            <Link to="/signup">
              <span> Sign up</span>
            </Link>
          </p>
        </div>

        <div className="companyContent">
          <div className="contentOne">
            <p>
              Welcome to the SyndicationX Investor Portal where you can
              access a wide range of investor information and documentation.
            </p>
            <p className="contentTwo">
              Please log in to the Investor Portal using your email address and
              password. If you have trouble logging in, you can reset your
              password using the{" "}
              <Link to="/forgotPassword" className="forgot-password">
                <span>Forgot Password?</span>
              </Link>{" "}
              link.
            </p>
            <FooterForm />
          </div>
        </div>
      </form>
    </>
  );
};

export default SigninForm;
