"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get("error") === "link" ? "That sign-in link is invalid or expired." : "");
  const [notice, setNotice] = useState("");

  const next = params.get("next") ?? "/plan";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const supabase = createClient();
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else {
        router.replace(next);
        router.refresh();
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        },
      });
      if (error) setError(error.message);
      else if (data.session) {
        router.replace("/onboarding");
        router.refresh();
      } else setNotice("Check your email to confirm your account, then come back here.");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm font-semibold tracking-wide text-accent uppercase">
          One-Hour Break Planner
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
      </div>
      <form onSubmit={submit} className="space-y-4">
        {mode === "signup" && (
          <div>
            <label className="label" htmlFor="name">
              Name
            </label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">
            School email
          </label>
          <input
            id="email"
            type="email"
            className="input"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="input"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
        {notice && <p className="rounded-lg bg-good-soft px-3 py-2 text-sm text-good">{notice}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "One sec…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
      </form>
      <p className="text-center text-sm text-muted">
        {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
        <button
          type="button"
          className="font-semibold text-accent"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
