import { useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { login } from "@/store/authSlice";
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

  function onSubmit(data: ILoginForm) {
    const validUsername = import.meta.env.VITE_AUTH_USERNAME;
    const validPassword = import.meta.env.VITE_AUTH_PASSWORD;

    if (data.username === validUsername && data.password === validPassword) {
      dispatch(login(data.username));
      navigate("/", { replace: true });
    } else {
      setError("root", { message: "Invalid username or password." });
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
