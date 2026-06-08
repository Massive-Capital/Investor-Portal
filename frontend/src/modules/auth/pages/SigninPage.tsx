import AuthLayout from "../../../common/layout/AuthLayout";
import SigninForm from "../components/SigninForm";
// import "./signin.css";

const SigninPage = () => {
 

  // subtitle="Access your portfolio, deals, and secure documents."
  return (
    <AuthLayout title="Sign in" caption="Sign in">
      <SigninForm />
    </AuthLayout>
  );
};

export default SigninPage;