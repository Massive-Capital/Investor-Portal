import type { ReactNode } from "react";
import { formatAppDocumentTitle } from "../utils/appDocumentTitle";
import "./auth_layout.css";
import "../../modules/auth/styles/auth_forms.css";
import companyLogo from "@/assets/images/massive-capital-logo.png";
import authPageBackgroundUrl from "@/assets/images/inital_img.webp?url";

interface AuthLayoutProps {
  title?: string;
  caption?: string | null;
  children: ReactNode;
  /** Extra class on `.authPage` (e.g. `authPage--resetPassword`) */
  authPageClassName?: string;
}

export default function AuthLayout({
  title,
  caption,
  children,
  authPageClassName = "",
}: AuthLayoutProps) {
  const rawTitle = title?.trim()
  if (!rawTitle) document.title = formatAppDocumentTitle("Sign in")
  else if (rawTitle.includes("|"))
    document.title = rawTitle
  else document.title = formatAppDocumentTitle(rawTitle)

  const authPageClasses = ["authPage", authPageClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={authPageClasses}
      style={{ backgroundImage: `url(${authPageBackgroundUrl})` }}
    >
      <div className="authContent">
        <div className="loginData">
          <div className="loginCred">
            <div className="loginForm">
              <p className="companyLogo">
                <img src={companyLogo} alt="company logo" className="companyLogo__img" />
              </p>
              {caption && <p className="loginCaption">{caption}</p>}
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}