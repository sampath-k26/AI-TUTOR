import { CheckCircle2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { AuthLayout } from "../../components/layout/AuthLayout";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";

export function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    setSubmitting(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // If email confirmation is required, Supabase returns no session yet.
    if (data.session) {
      navigate("/", { replace: true });
    } else {
      setConfirmationSent(true);
    }
  }

  if (confirmationSent) {
    return (
      <AuthLayout title="Check your email" subtitle="One more step before you can log in.">
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-muted">
            <CheckCircle2 className="h-5 w-5 text-success" />
          </div>
          <p className="text-[13.5px] text-foreground">
            We've sent a confirmation link to <span className="font-medium">{email}</span>. Confirm your account, then log in.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account" subtitle="Start learning with material-grounded answers.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </div>
        {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Signing up…" : "Sign up"}
        </Button>
      </form>
      <p className="mt-4 text-[13px] text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="text-primary hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
