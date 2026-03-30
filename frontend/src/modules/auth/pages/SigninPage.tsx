import AuthLayout from "../../../common/layout/AuthLayout";
import SigninForm from "../components/SigninForm";
// import "./signin.css";

const SigninPage = () => {
 

  return (
    <AuthLayout title="Investor Portal LLC | Signin" caption="Sign in to your account">
     <SigninForm/>
    </AuthLayout>
  );
};

export default SigninPage;