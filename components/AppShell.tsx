"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import Butterfly from "./Butterfly";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/collections", label: "Collections" },
  { href: "/needed", label: "Needed" },
  { href: "/import", label: "Import" },
  { href: "/accounts", label: "Accounts" }
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null | "loading">("loading");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
      } else {
        setSession(data.session);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!newSession) {
        router.replace("/login");
      }
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (session === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-inkmuted text-sm">Loading…</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      <header className="border-b border-line bg-surface/85 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Butterfly size={22} />
            <h1 className="font-display italic text-2xl gold-text font-medium">deezdex</h1>
          </div>
          <nav className="flex gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`text-sm px-3 py-1.5 rounded-full whitespace-nowrap transition ${
                  pathname === item.href
                    ? "bg-violet text-white"
                    : "text-inkmuted hover:bg-surfaceraised"
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <button
            onClick={handleSignOut}
            className="text-sm text-inkmuted hover:text-ink transition shrink-0"
          >
            Sign out
          </button>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">{children}</div>
    </div>
  );
                  }
