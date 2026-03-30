import AuthLayout from "../../../common/layout/AuthLayout";
import ResetPasswordForm from "../components/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <AuthLayout
      title="Investor Portal LLC | Reset Password"
      caption="Reset Password"
      authPageClassName="authPage--resetPassword"
    >
      <ResetPasswordForm />
    </AuthLayout>
  );
}
