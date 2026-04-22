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
  SESSION_BEARER_KEY,
  SESSION_USER_DETAILS_KEY,
} from "../../../common/auth/sessionKeys";
import { getApiV1Base } from "../../../common/utils/apiBaseUrl";
import "./signin_form.css";

const SigninForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const resetSuccess = location.state?.resetSuccess;
  const apiV1 = getApiV1Base();

  const [emailOrUsername, setEmailOrUsername] = useState("");
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
          emailOrUsername: emailOrUsername.trim(),
          password,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        token?: string;
        userDetails?: unknown;
      };
      if (!response.ok) {
        setError(data.message || "Sign in failed. Please try again.");
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
      } else {
        sessionStorage.removeItem(SESSION_USER_DETAILS_KEY);
      }
      const state = location.state as { from?: string } | undefined;
      const from = state?.from;
      const redirectTo =
        typeof from === "string" &&
        from.startsWith("/") &&
        !from.startsWith("//") &&
        from !== "/signin"
          ? from
          : "/";
      navigate(redirectTo, { replace: true });
    } catch {
      setError("Unable to connect. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }

  const isDisabledBtn =
    !emailOrUsername.trim() || !password.trim() || isLoading;

  return (
    <>
      <form autoComplete="off" onSubmit={handleSubmit}>
        <div className="emailData">
          <Input
            labelName="Email or username"
            id="loginEmail"
            icon={<Mail width={20} strokeWidth={1.5} aria-hidden />}
            type="text"
            name="emailOrUsername"
            value={emailOrUsername}
            onChange={(e) => {
              setEmailOrUsername(e.target.value);
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
              Welcome to the Massive Capital Investor Portal where you can
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
