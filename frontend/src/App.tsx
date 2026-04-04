import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import { SESSION_BEARER_KEY } from "./common/auth/sessionKeys";
import { RequireAuth } from "./common/auth/RequireAuth";
import { canAccessCompanyPage } from "./common/auth/roleUtils";
import SigninPage from "./modules/auth/pages/SigninPage";
import SignupPage from "./modules/auth/pages/SignupPage";
import ForgotPasswordPage from "./modules/auth/pages/ForgotPasswordPage";
import ResetPasswordPage from "./modules/auth/pages/ResetPasswordPage";
import PrivacyPolicy from "./modules/auth/components/PrivacyPolicy";
import TermsService from "./modules/auth/components/TermsService";
import PageNotFound from "./common/PageNotFound";
import PageLayout from "./common/layout/PageLayout";
import SponsorDashboardPage from "./modules/Syndication/InvestorPortal/Dashboard/SponsorDashboardPage";
import DealsLayout from "./modules/Syndication/InvestorPortal/Deals/DealsLayout";
import { CreateDealPage } from "./modules/Syndication/InvestorPortal/Deals/CreateDealPage";
import { DealDetailPage } from "./modules/Syndication/InvestorPortal/Deals/DealDetailPage";
import { DealOfferingPortfolioPage } from "./modules/Syndication/InvestorPortal/Deals/DealOfferingPortfolioPage";
import { DealsListPage } from "./modules/Syndication/InvestorPortal/Deals/DealsListPage";
import Opportunities from "./modules/Investing/InvestorPortal/Opportunities/Opportunities";
import { WorkInProgressPage } from "./common/components/WorkInProgressPage";
import { InvestorEmailsPage } from "./modules/Syndication/InvestorPortal/InvestorEmails/InvestorEmailsPage";
import { ReportingPage } from "./modules/Syndication/InvestorPortal/Reporting/ReportingPage";
import CompanyPage from "./modules/company/CompanyPage";
import CompanyMembersPage from "./modules/company/CompanyMembersPage";
import CompanyDealsPage from "./modules/company/CompanyDealsPage";
import CustomerCompanyLayout from "./modules/company/CustomerCompanyLayout";
import MembersLayout from "./modules/usermanagement/MembersLayout";
import UserManagementPage from "./modules/usermanagement/UserManagementPage";
import ContactsPage from "./modules/contacts/ContactsPage";
import { MyAccountLayout } from "./modules/myaccount/MyAccountLayout";
import { MyAccountCompanyPage } from "./modules/myaccount/MyAccountCompanyPage";
import { MyAccountPersonalPage } from "./modules/myaccount/MyAccountPersonalPage";
import { MyAccountPasswordPage } from "./modules/myaccount/MyAccountPasswordPage";

type PlaceholderPageProps = {
  title: string;
};

const PlaceholderPage = ({ title }: PlaceholderPageProps) => {
  return (
    <section className="section_placeholder">
      <h3>{title}</h3>
    </section>
  );
};

function CompanyRoute() {
  const token = sessionStorage.getItem(SESSION_BEARER_KEY);
  if (!token) return <Navigate to="/signin" replace />;
  if (!canAccessCompanyPage()) return <Navigate to="/" replace />;
  return <CompanyPage />;
}

function CustomersRoute() {
  const token = sessionStorage.getItem(SESSION_BEARER_KEY);
  if (!token) return <Navigate to="/signin" replace />;
  if (!canAccessCompanyPage()) return <Navigate to="/" replace />;
  return <CompanyPage variant="customers" />;
}

/** Match React Router to Vite `base` (`import.meta.env.BASE_URL`) for subpath deploys. */
function routerBasename(): string | undefined {
  const raw = import.meta.env.BASE_URL ?? "/";
  if (raw === "/" || raw === "./") return undefined;
  const trimmed = raw.replace(/\/+$/, "");
  return trimmed || undefined;
}

function App() {
  return (
    <>
      <BrowserRouter basename={routerBasename()}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/" element={<PageLayout />}>
              <Route index element={<SponsorDashboardPage />} />
            <Route path="deals" element={<DealsLayout />}>
              <Route index element={<DealsListPage />} />
              <Route path="investor-emails" element={<InvestorEmailsPage />} />
              <Route path="reporting" element={<ReportingPage />} />
              <Route path="create" element={<CreateDealPage />} />
              <Route
                path=":dealId/offering-portfolio"
                element={<DealOfferingPortfolioPage />}
              />
              <Route path=":dealId" element={<DealDetailPage />} />
            </Route>
            <Route
              path="leads"
              element={
                <WorkInProgressPage
                  title="Leads"
                  backTo="/"
                  backLabel="Dashboard"
                />
              }
            />
            <Route path="investing/opportunities" element={<Opportunities />} />
            <Route
              path="investing/investments"
              element={
                <WorkInProgressPage
                  title="Investments"
                  backTo="/"
                  backLabel="Dashboard"
                />
              }
            />
            <Route
              path="investing/documents"
              element={
                <WorkInProgressPage
                  title="Documents"
                  backTo="/"
                  backLabel="Dashboard"
                />
              }
            />
            <Route
              path="investing/profiles"
              element={
                <WorkInProgressPage
                  title="Profiles"
                  backTo="/"
                  backLabel="Dashboard"
                />
              }
            />
            <Route
              path="investing/deals"
              element={
                <WorkInProgressPage
                  title="Deals"
                  backTo="/"
                  backLabel="Dashboard"
                />
              }
            />
            <Route
              path="investing/settings"
              element={
                <WorkInProgressPage
                  title="Settings"
                  backTo="/"
                  backLabel="Dashboard"
                />
              }
            />
            <Route
              path="investing/review"
              element={
                <WorkInProgressPage
                  title="Leave a review"
                  backTo="/"
                  backLabel="Dashboard"
                />
              }
            />
            <Route path="account" element={<MyAccountLayout />}>
              <Route index element={<Navigate to="/account/company" replace />} />
              <Route path="company" element={<MyAccountCompanyPage />} />
              <Route path="personal" element={<MyAccountPersonalPage />} />
              <Route path="password" element={<MyAccountPasswordPage />} />
            </Route>
            <Route
              path="refer-a-friend"
              element={<PlaceholderPage title="Refer a friend" />}
            />
            <Route path="support" element={<PlaceholderPage title="Support" />} />
            <Route path="settings" element={<CompanyRoute />} />
            <Route path="customers/:companyId" element={<CustomerCompanyLayout />}>
              <Route
                index
                element={<Navigate to="members" replace />}
              />
              <Route path="members" element={<CompanyMembersPage />} />
              <Route path="deals" element={<CompanyDealsPage />} />
            </Route>
            <Route path="customers" element={<CustomersRoute />} />
            <Route path="billing" element={<PlaceholderPage title="Billing" />} />
            <Route path="members" element={<MembersLayout />}>
              <Route index element={<UserManagementPage />} />
            </Route>
            <Route path="contacts" element={<ContactsPage />} />
            </Route>
          </Route>
          <Route path="/signin" element={<SigninPage />} />
          <Route path="/signup/:token" element={<SignupPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgotPassword" element={<ForgotPasswordPage />} />
          <Route path="/resetPassword" element={<ResetPasswordPage />} />
          <Route path="/termsandservices" element={<TermsService />} />
          <Route path="/privacypolicy" element={<PrivacyPolicy />} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
