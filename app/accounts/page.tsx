"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { supabase, Account } from "@/lib/supabase/client";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .order("created_at", { ascending: true });
    if (!error) setAccounts(data as Account[]);
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    const { data: userData } = await supabase.auth.getUser();
    const isFirst = accounts.length === 0;
    const { error } = await supabase.from("accounts").insert([
      {
        name: newName.trim(),
        user_id: userData.user?.id,
        is_main: isFirst
      }
    ]);
    if (error) {
      setError(error.message);
    } else {
      setNewName("");
      await load();
    }
    setAdding(false);
  }

  async function handleSetMain(account: Account) {
    // unset current main, then set the chosen one
    await supabase.from("accounts").update({ is_main: false }).eq("is_main", true);
    await supabase.from("accounts").update({ is_main: true }).eq("id", account.id);
    await load();
  }

  async function handleRename(account: Account, name: string) {
    if (!name.trim() || name === account.name) return;
    await supabase.from("accounts").update({ name: name.trim() }).eq("id", account.id);
    await load();
  }

  async function handleDelete(account: Account) {
    if (
      !confirm(
        `Delete "${account.name}"? This removes all card counts recorded for this account. This can't be undone.`
      )
    )
      return;
    await supabase.from("accounts").delete().eq("id", account.id);
    await load();
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h2 className="font-display text-3xl text-ink">Your accounts</h2>
        <p className="text-sm text-inkmuted mt-1">
          Mark one account as <strong>main</strong> — that&apos;s where your dupe goal (2 of
          every card) is tracked. Everything else is just a source of spares.
        </p>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2 mb-6">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Account name, e.g. @cassa"
          className="flex-1 border border-line rounded-lg px-3 py-2 text-sm focus:border-violet"
        />
        <button
          type="submit"
          disabled={adding}
          className="bg-violet hover:bg-violet-dark text-white text-sm px-4 py-2 rounded-lg font-medium transition disabled:opacity-60"
        >
          {adding ? "Adding…" : "+ Add account"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-inkmuted">Loading…</p>
      ) : accounts.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-line rounded-card">
          <p className="text-ink font-medium">No accounts yet</p>
          <p className="text-sm text-inkmuted mt-1">
            Add your main BCD account first, then your side accounts.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((a) => (
            <div
              key={a.id}
              className="bg-surface border border-line rounded-card p-4 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {a.is_main && (
                  <span className="shrink-0 bg-violet text-white text-xs px-2.5 py-1 rounded-full font-medium">
                    Main
                  </span>
                )}
                <input
                  defaultValue={a.name}
                  onBlur={(e) => handleRename(a, e.target.value)}
                  className="font-medium text-ink bg-transparent border-b border-transparent hover:border-line focus:border-violet transition text-sm min-w-0 flex-1"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!a.is_main && (
                  <button
                    onClick={() => handleSetMain(a)}
                    className="text-xs text-violet hover:text-violet-dark transition"
                  >
                    Make main
                  </button>
                )}
                <button
                  onClick={() => handleDelete(a)}
                  className="text-xs text-red-600 hover:text-red-700 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
        }
          
