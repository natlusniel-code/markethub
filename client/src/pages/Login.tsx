import { useState, type FormEvent } from "react";
import { Link, Redirect } from "wouter";
import { useAuth } from "@/_core/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Mode = "email" | "phone";

export default function Login() {
  const { login, loginPhone, user } = useAuth();
  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "email") await login(email, password);
      else await loginPhone(phone, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  // Declarative, not `navigate()` straight after the await. The auth query's
  // cache update and this component's re-render are not the same tick, so an
  // imperative jump reaches the guarded route while `user` is still null, and
  // <Protected> bounces it right back here — the user has signed up or logged
  // in successfully and is looking at a login form. Rendering a Redirect once
  // `user` actually exists waits for the state to arrive.
  if (user) return <Redirect to="/" />;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Log in to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "email"}
              onClick={() => {
                setMode("email");
                setError(null);
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "email" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Email
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "phone"}
              onClick={() => {
                setMode("phone");
                setError(null);
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "phone" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Phone number
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "email" ? (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="0803 000 0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Logging in…" : "Log in"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link to="/signup" className="underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
