import { useState, type FormEvent } from "react";
import { Link, Redirect } from "wouter";
import { useAuth } from "@/_core/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Mode = "email" | "phone";

export default function Signup() {
  const { signup, signupPhone, user } = useAuth();
  const [mode, setMode] = useState<Mode>("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Checked here as well as on the server. The server check is the one that
    // counts; this one just saves a round trip and puts the message next to the
    // field the user has to fix.
    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "email") {
        await signup(email, password, name || undefined);
      } else {
        await signupPhone(name, phone, password, confirmPassword);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
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
          <CardTitle>Create your account</CardTitle>
          <CardDescription>It takes a few seconds.</CardDescription>
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
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required={mode === "phone"}
              />
            </div>

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
                <p className="text-xs text-muted-foreground">
                  Nigerian mobile number. You will sign in with this number and your password.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Creating…" : "Sign up"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
