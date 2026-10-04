"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface PasswordEntry {
  id: string;
  title: string;
  username: string | null;
  url: string | null;
  notes: string | null;
  category: string | null;
  family: string | null;
  createdAt: string;
  creator: { id: string; name: string | null; image: string | null };
}

const CATEGORIES = ["General", "Streaming", "WiFi", "Banking", "Shopping", "Travel", "Social", "Other"];

const CATEGORY_ICONS: Record<string, string> = {
  General: "🔑", Streaming: "📺", WiFi: "📶", Banking: "🏦",
  Shopping: "🛍️", Travel: "✈️", Social: "💬", Other: "📁",
};

const EMPTY_FORM = {
  title: "", username: "", password: "", url: "", notes: "", category: "General", family: "",
};

function Avatar({ user, size = 20 }: { user: { name?: string | null; image?: string | null }; size?: number }) {
  const initials = user.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "?";
  return user.image
    ? <Image src={user.image} alt={user.name ?? ""} width={size} height={size} unoptimized
        className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
    : <div className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.38, backgroundColor: "var(--nd-navy)" }}>
        {initials}
      </div>;
}

export default function PasswordsPage() {
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Reveal modal state
  const [revealTarget, setRevealTarget] = useState<PasswordEntry | null>(null);
  const [accountPassword, setAccountPassword] = useState("");
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [revealError, setRevealError] = useState("");
  const [revealing, setRevealing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/passwords").then(r => r.json()).then(setEntries).catch(() => {});
  }, []);

  // Group by category
  const grouped = entries.reduce<Record<string, PasswordEntry[]>>((acc, e) => {
    const cat = e.category ?? "General";
    (acc[cat] ??= []).push(e);
    return acc;
  }, {});

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    const res = await fetch("/api/passwords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      const entry = await res.json();
      setEntries(prev => [...prev, entry].sort((a, b) => (a.category ?? "").localeCompare(b.category ?? "") || a.title.localeCompare(b.title)));
      setForm({ ...EMPTY_FORM });
      setShowAdd(false);
    } else {
      const { error } = await res.json();
      setFormError(error ?? "Failed to save.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this entry?")) return;
    const res = await fetch(`/api/passwords/${id}`, { method: "DELETE" });
    if (res.ok) setEntries(prev => prev.filter(e => e.id !== id));
  }

  function openReveal(entry: PasswordEntry) {
    setRevealTarget(entry);
    setAccountPassword("");
    setRevealedPassword(null);
    setRevealError("");
    setCopied(false);
  }

  async function handleReveal(e: React.FormEvent) {
    e.preventDefault();
    setRevealing(true);
    setRevealError("");
    const res = await fetch(`/api/passwords/${revealTarget!.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountPassword }),
    });
    setRevealing(false);
    if (res.ok) {
      const { password } = await res.json();
      setRevealedPassword(password);
      setAccountPassword("");
    } else {
      const { error } = await res.json();
      setRevealError(error ?? "Verification failed.");
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--nd-navy)" }}>Shared Passwords</h1>
          <p className="text-sm text-gray-500 mt-0.5">Shared credentials vault — passwords require identity verification to view.</p>
        </div>
        <button onClick={() => { setShowAdd(true); setFormError(""); }}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition"
          style={{ backgroundColor: "var(--nd-navy)" }}>
          + Add Entry
        </button>
      </div>

      {entries.length === 0 && (
        <div className="bg-white rounded-2xl shadow p-12 text-center text-gray-400">
          <div className="text-5xl mb-3">🔐</div>
          <p className="font-medium">No shared passwords yet.</p>
          <p className="text-sm mt-1">Add WiFi passwords, streaming logins, and other shared credentials.</p>
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--nd-gold)" }}>
              {CATEGORY_ICONS[cat] ?? "📁"} {cat}
            </h2>
            <div className="space-y-2">
              {items.map(entry => (
                <div key={entry.id} className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex items-center gap-4">
                  <div className="text-2xl w-10 text-center shrink-0">{CATEGORY_ICONS[entry.category ?? "General"] ?? "🔑"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800">{entry.title}</div>
                    {entry.username && <div className="text-xs text-gray-500 mt-0.5">👤 {entry.username}</div>}
                    {entry.url && (
                      <a href={entry.url.startsWith("http") ? entry.url : `https://${entry.url}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-xs mt-0.5 hover:underline block truncate" style={{ color: "var(--nd-gold)" }}>
                        🔗 {entry.url}
                      </a>
                    )}
                    {entry.notes && <div className="text-xs text-gray-400 mt-0.5 italic">{entry.notes}</div>}
                    {entry.family && <div className="text-xs text-gray-400 mt-0.5">🏠 {entry.family}</div>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div title={entry.creator.name ?? ""}>
                      <Avatar user={entry.creator} size={22} />
                    </div>
                    <button onClick={() => openReveal(entry)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition hover:opacity-80"
                      style={{ borderColor: "var(--nd-navy)", color: "var(--nd-navy)" }}>
                      🔓 Reveal
                    </button>
                    <button onClick={() => handleDelete(entry.id)} className="text-xs text-red-400 hover:text-red-600 transition">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add Entry Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4" style={{ color: "var(--nd-navy)" }}>Add Password Entry</h2>
              <form onSubmit={handleAdd} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Netflix, Home WiFi, Hulu"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none">
                    {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username / Email</label>
                  <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                  <div className="relative">
                    <input required type={showPassword ? "text" : "password"}
                      value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none" />
                    <button type="button" onClick={() => setShowPassword(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
                  <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                    placeholder="netflix.com"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2} placeholder="Any extra details…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shared with</label>
                  <input value={form.family} onChange={e => setForm(f => ({ ...f, family: e.target.value }))}
                    placeholder="e.g. All, Alex & Jordan Rivera"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                {formError && <p className="text-red-500 text-sm">{formError}</p>}
                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2 rounded-lg font-semibold text-white text-sm hover:opacity-90 transition"
                    style={{ backgroundColor: "var(--nd-navy)" }}>
                    {saving ? "Saving…" : "Save Entry"}
                  </button>
                  <button type="button" onClick={() => setShowAdd(false)}
                    className="flex-1 py-2 rounded-lg font-semibold text-sm border border-gray-300 hover:bg-gray-50 transition">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Reveal Verification Modal */}
      {revealTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6">
              {revealedPassword === null ? (
                <>
                  <div className="text-center mb-5">
                    <div className="text-4xl mb-2">🔐</div>
                    <h2 className="text-lg font-bold" style={{ color: "var(--nd-navy)" }}>Verify Your Identity</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Enter your account password to reveal <strong>{revealTarget.title}</strong>.
                    </p>
                  </div>
                  <form onSubmit={handleReveal} className="space-y-3">
                    <input
                      type="password"
                      required
                      autoFocus
                      placeholder="Your account password"
                      value={accountPassword}
                      onChange={e => setAccountPassword(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      style={{ "--tw-ring-color": "var(--nd-gold)" } as React.CSSProperties}
                    />
                    {revealError && <p className="text-red-500 text-sm text-center">{revealError}</p>}
                    <div className="flex gap-2">
                      <button type="submit" disabled={revealing}
                        className="flex-1 py-2 rounded-lg font-semibold text-white text-sm hover:opacity-90 transition"
                        style={{ backgroundColor: "var(--nd-navy)" }}>
                        {revealing ? "Verifying…" : "Reveal Password"}
                      </button>
                      <button type="button" onClick={() => setRevealTarget(null)}
                        className="flex-1 py-2 rounded-lg font-semibold text-sm border border-gray-300 hover:bg-gray-50 transition">
                        Cancel
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <div className="text-center mb-4">
                    <div className="text-4xl mb-2">✅</div>
                    <h2 className="text-lg font-bold" style={{ color: "var(--nd-navy)" }}>{revealTarget.title}</h2>
                  </div>
                  <div className="rounded-xl p-4 mb-4 font-mono text-center text-lg break-all select-all"
                    style={{ backgroundColor: "#f0f4ff", color: "var(--nd-navy)", border: "2px solid var(--nd-gold)" }}>
                    {revealedPassword}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => copyToClipboard(revealedPassword)}
                      className="flex-1 py-2 rounded-lg font-semibold text-sm transition"
                      style={{ backgroundColor: copied ? "#16a34a" : "var(--nd-gold)", color: copied ? "white" : "var(--nd-navy)" }}>
                      {copied ? "✓ Copied!" : "Copy to Clipboard"}
                    </button>
                    <button onClick={() => setRevealTarget(null)}
                      className="flex-1 py-2 rounded-lg font-semibold text-sm border border-gray-300 hover:bg-gray-50 transition">
                      Done
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 text-center mt-3">Password will not be stored in your clipboard history.</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
