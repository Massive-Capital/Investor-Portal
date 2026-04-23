import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchPublicCompanyBranding,
  withBrandingVersionOnUrl,
  type CompanyBranding,
} from "@/modules/company/companyBranding";
import { formatAppDocumentTitle } from "../utils/appDocumentTitle";
import { normalizeDealGallerySrc } from "../utils/apiBaseUrl";
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
  const [searchParams] = useSearchParams();
  const [branding, setBranding] = useState<CompanyBranding | null>(null);

  const brandingCompanyId = useMemo(() => {
    return (
      searchParams.get("companyId")?.trim() ||
      (import.meta.env.VITE_BRANDING_COMPANY_ID as string | undefined)?.trim() ||
      ""
    );
  }, [searchParams]);

  useEffect(() => {
    if (!brandingCompanyId) {
      setBranding(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const b = await fetchPublicCompanyBranding(brandingCompanyId);
      if (!cancelled) setBranding(b);
    })();
    return () => {
      cancelled = true;
    };
  }, [brandingCompanyId]);

  const rawTitle = title?.trim();
  useEffect(() => {
    if (!rawTitle) document.title = formatAppDocumentTitle("Sign in");
    else if (rawTitle.includes("|")) document.title = rawTitle;
    else document.title = formatAppDocumentTitle(rawTitle);
  }, [rawTitle]);

  useEffect(() => {
    const u = branding?.logoIconUrl;
    if (!u) return;
    const href = withBrandingVersionOnUrl(
      normalizeDealGallerySrc(u),
      branding?.settingsTabUpdatedAt,
    );
    if (!href) return;
    let link = document.querySelector(
      "link[rel~='icon']",
    ) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [branding?.logoIconUrl, branding?.settingsTabUpdatedAt]);

  const backgroundStyle = useMemo(() => {
    const u = branding?.backgroundImageUrl;
    if (u) {
      const href = withBrandingVersionOnUrl(
        normalizeDealGallerySrc(u),
        branding?.settingsTabUpdatedAt,
      );
      return `url(${href})` as const;
    }
    return `url(${authPageBackgroundUrl})` as const;
  }, [branding?.backgroundImageUrl, branding?.settingsTabUpdatedAt]);

  const logoSrc = useMemo(() => {
    const u = branding?.logoImageUrl;
    if (u) {
      return withBrandingVersionOnUrl(
        normalizeDealGallerySrc(u),
        branding?.settingsTabUpdatedAt,
      );
    }
    return companyLogo;
  }, [branding?.logoImageUrl, branding?.settingsTabUpdatedAt]);

  const authPageClasses = ["authPage", authPageClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={authPageClasses}
      style={{ backgroundImage: backgroundStyle }}
    >
      <div className="authContent">
        <div className="loginData">
          <div className="loginCred">
            <div className="loginForm">
              <p className="companyLogo">
                <img
                  src={logoSrc}
                  alt="Company logo"
                  className="companyLogo__img"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
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
