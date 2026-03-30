import AuthLayout from "../../../common/layout/AuthLayout";
import ForgotPasswordForm from "../components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Investor Portal LLC | Forgot Password"
      caption="Account recovery"
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
