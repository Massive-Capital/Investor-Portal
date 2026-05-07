import AuthLayout from "../../../common/layout/AuthLayout";
import SigninForm from "../components/SigninForm";
// import "./signin.css";

const SigninPage = () => {
 

  return (
    <AuthLayout title="Signin" caption="Sign in to your account">
     <SigninForm/>
    </AuthLayout>
  );
};

export default SigninPage;