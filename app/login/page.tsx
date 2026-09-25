"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Butterfly from "@/components/Butterfly";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        router.replace("/");
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setMessage({
          type: "info",
          text: "Account created. Check your email to confirm, then sign in."
        });
        setMode("signin");
      }
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Butterfly size={30} />
            <h1 className="font-display italic text-4xl gold-text font-medium">deezdex</h1>
          </div>
          <p className="mt-2 text-sm text-inkmuted">Your BCD dupe tracker, across every account.</p>
        </div>

        <div className="bg-surface border border-line rounded-card p-6 shadow-sm">
          <div className="flex mb-6 border border-line rounded-full p-1 bg-paper">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 text-sm py-1.5 rounded-full transition ${
                mode === "signin" ? "bg-violet text-white" : "text-inkmuted"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 text-sm py-1.5 rounded-full transition ${
                mode === "signup" ? "bg-violet text-white" : "text-inkmuted"
              }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-inkmuted mb-1" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-line rounded-lg px-3 py-2 text-sm bg-surface text-ink placeholder-inkmuted focus:border-violet transition"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-inkmuted mb-1" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-line rounded-lg px-3 py-2 text-sm bg-surface text-ink placeholder-inkmuted focus:border-violet transition"
                placeholder="At least 6 characters"
              />
            </div>

            {message && (
              <p className={`text-sm ${message.type === "error" ? "text-red-600" : "text-complete"}`}>
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet hover:bg-violet-dark text-white rounded-lg py-2.5 text-sm font-medium transition disabled:opacity-60"
            >
              {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
                }
