import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import useAuth from "../../hooks/useAuth.js";
import { apiError } from "../../lib/format.js";
import { Divider } from "./AuthLayout.jsx";

export const GOOGLE_ENABLED = import.meta.env.VITE_GOOGLE_SIGNIN_ENABLED === "true";

/**
 * Google's own button (the backend verifies a Google ID token, which only the
 * official widget issues), under the design's "or continue with" divider.
 */
const GoogleSignIn = ({ text = "continue_with" }) => {
  const { googleLogin } = useAuth();
  const navigate = useNavigate();
  if (!GOOGLE_ENABLED) return null;

  const onSuccess = async ({ credential }) => {
    try {
      const data = await googleLogin(credential);
      navigate(data?.profileIncomplete ? "/complete-profile" : "/dashboard");
    } catch (err) {
      toast.error(apiError(err, "Google sign-in failed. Please try again."));
    }
  };

  return (
    <>
      <Divider>or continue with</Divider>
      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={onSuccess}
          onError={() => toast.error("Google sign-in failed. Please try again.")}
          size="large"
          shape="rectangular"
          theme="outline"
          text={text}
          width="380"
        />
      </div>
    </>
  );
};

export default GoogleSignIn;
