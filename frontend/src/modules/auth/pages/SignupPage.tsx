import AuthLayout from "../../../common/layout/AuthLayout";
import SignupForm from "../components/SignupForm";

export default function SignupPage() {
  return (
    <AuthLayout
      title="Sign Up"
      caption="Create your investor account"
    >
      <SignupForm />
    </AuthLayout>
  );
}
