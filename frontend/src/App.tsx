import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import { SESSION_BEARER_KEY } from "./common/auth/sessionKeys";
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
import { DealsListPage } from "./modules/Syndication/InvestorPortal/Deals/DealsListPage";
import Opportunities from "./modules/Investing/InvestorPortal/Opportunities/Opportunities";
import { WorkInProgressPage } from "./common/components/WorkInProgressPage";
import { InvestorEmailsPage } from "./modules/Syndication/InvestorPortal/InvestorEmails/InvestorEmailsPage";
import { ReportingPage } from "./modules/Syndication/InvestorPortal/Reporting/ReportingPage";
import CompanyPage from "./modules/company/CompanyPage";
import MembersLayout from "./modules/usermanagement/MembersLayout";
import UserManagementPage from "./modules/usermanagement/UserManagementPage";

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

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PageLayout />}>
            <Route index element={<SponsorDashboardPage />} />
            <Route path="deals" element={<DealsLayout />}>
              <Route index element={<DealsListPage />} />
              <Route path="investor-emails" element={<InvestorEmailsPage />} />
              <Route path="reporting" element={<ReportingPage />} />
              <Route path="create" element={<CreateDealPage />} />
              <Route path=":dealId" element={<DealDetailPage />} />
            </Route>
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
            <Route path="account" element={<PlaceholderPage title="My account" />} />
            <Route
              path="refer-a-friend"
              element={<PlaceholderPage title="Refer a friend" />}
            />
            <Route path="support" element={<PlaceholderPage title="Support" />} />
            <Route path="company" element={<CompanyRoute />} />
            <Route path="billing" element={<PlaceholderPage title="Billing" />} />
            <Route path="members" element={<MembersLayout />}>
              <Route index element={<UserManagementPage />} />
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
