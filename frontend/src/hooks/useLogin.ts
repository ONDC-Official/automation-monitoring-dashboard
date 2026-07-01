import { useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { login as loginAction } from "@/store/authSlice";
import { login as loginRequest } from "@/services/auth";
import { ApiError } from "@/services/httpClient";
import type { AppDispatch } from "@/store";
import type { ILoginForm } from "@/pages/login/types";

const useLogin = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ILoginForm>();

  async function onSubmit(data: ILoginForm) {
    try {
      // Credentials are validated by the backend — never in the browser bundle.
      const { username, token } = await loginRequest(data.username, data.password);
      dispatch(loginAction({ username, token }));
      navigate("/", { replace: true });
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 401
          ? "Invalid username or password."
          : "Unable to sign in. Please try again.";
      setError("root", { message });
    }
  }

  return {
    register,
    handleSubmit: handleSubmit(onSubmit),
    errors,
    isSubmitting,
  };
};

export default useLogin;
