import LoginForm from "@/pages/login/Form";

const Login = () => (
  <div className="flex min-h-screen items-center justify-center bg-background px-4">
    <div className="w-full max-w-sm space-y-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <img
          src="https://www.ondc.org/assets/theme/images/ondc_registered_logo.svg?v=71cbd96390"
          alt="ONDC Logo"
          className="h-[120px] w-[200px]"
        />

        <h1 className="text-2xl font-semibold tracking-tight">
          ONDC Automation Monitor
        </h1>
      </div>

      <LoginForm />
    </div>
  </div>
);

export default Login;
