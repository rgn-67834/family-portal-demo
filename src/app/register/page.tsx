"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FAMILY_GROUPS } from "@/lib/demo-data";

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [familyGroup, setFamilyGroup] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const mi = middleInitial.trim().replace(/\.$/, "");
    const name = [firstName.trim(), mi ? `${mi.toUpperCase()}.` : "", lastName.trim()].filter(Boolean).join(" ");

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, familyGroup }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong.");
    } else {
      router.push("/login");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "var(--nd-navy)" }}>
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1 text-center" style={{ color: "var(--nd-navy)" }}>Join the Family Portal</h1>
        <p className="text-center text-sm text-gray-400 mb-6">Create your family account</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
                placeholder="First name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Middle Initial</label>
              <input
                type="text"
                maxLength={2}
                value={middleInitial}
                onChange={(e) => setMiddleInitial(e.target.value.replace(/[^a-zA-Z]/, ""))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
                placeholder="Optional"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
              placeholder="Last name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Family Group</label>
            <select
              required
              value={familyGroup}
              onChange={(e) => setFamilyGroup(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 bg-white"
            >
              <option value="">Select your family…</option>
              {FAMILY_GROUPS.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Someone already in that group approves your request to see its calendar.</p>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full font-semibold py-2 rounded-lg transition hover:opacity-90 text-white"
            style={{ backgroundColor: "var(--nd-navy)" }}
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="hover:underline font-medium" style={{ color: "var(--nd-gold)" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
