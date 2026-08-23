import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { canAccess, defaultPath } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEMO_ACCOUNTS = [
  { email: "analyst1-test@test.com", role: "Analyst" },
  { email: "analyst2-test@test.com", role: "Analyst" },
  { email: "manager-test@test.com", role: "Manager" },
  { email: "administrator-test@test.com", role: "Administrator" },
  { email: "viewer-test@test.com", role: "Viewer" },
];

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("analyst1-test@test.com");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (user) return <Navigate to={defaultPath(user.role_access)} replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const loggedIn = await login(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      const next =
        from && from !== "/login" && canAccess(loggedIn.role_access, from)
          ? from
          : defaultPath(loggedIn.role_access);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-[linear-gradient(160deg,#0f4c5c_0%,#163a4a_45%,#f4f8f8_45%)] p-6">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">AuraCom</p>
          <CardTitle className="text-2xl">SLA Tracker</CardTitle>
          <CardDescription>Sign in with a local demo account. Password for every user is password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <div className="mt-6 rounded-md bg-muted p-3 text-xs text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">Demo accounts</p>
            <ul className="space-y-1">
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.email}>
                  <button
                    type="button"
                    className="text-left hover:text-primary hover:underline"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword("password");
                    }}
                  >
                    {account.email} · {account.role}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
