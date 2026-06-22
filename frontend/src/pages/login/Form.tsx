import Button from "@/components/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/Card";
import FormInput from "@/components/FormInput";
import FormPasswordInput from "@/components/FormPasswordInput";
import useLogin from "@/hooks/useLogin";

const LoginForm = () => {
  const { register, handleSubmit, errors, isSubmitting } = useLogin();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sign in</CardTitle>
        <CardDescription>
          Enter your credentials to access the dashboard
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput
            label="Username"
            placeholder="Enter username"
            autoComplete="username"
            error={errors.username?.message}
            registration={register("username", {
              required: "Username is required",
            })}
          />

          <FormPasswordInput
            label="Password"
            placeholder="Enter password"
            autoComplete="current-password"
            error={errors.password?.message}
            registration={register("password", {
              required: "Password is required",
            })}
          />

          {errors.root && (
            <p className="text-sm text-destructive">{errors.root.message}</p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign In"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default LoginForm;
