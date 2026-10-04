"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "var(--nd-navy)" }}>
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1 text-center" style={{ color: "var(--nd-navy)" }}>Forgot Password</h1>
        {submitted ? (
          <div className="text-center mt-4">
            <div className="text-4xl mb-3">📬</div>
            <p className="text-gray-700 text-sm mb-4">
              If that email is registered, you&apos;ll receive a reset link shortly. Check your inbox (and spam folder).
            </p>
            <Link href="/login" className="font-semibold text-sm hover:underline" style={{ color: "var(--nd-gold)" }}>
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <p className="text-center text-sm text-gray-400 mb-6">Enter your email and we&apos;ll send a reset link.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full font-semibold py-2 rounded-lg transition hover:opacity-90 text-white"
                style={{ backgroundColor: "var(--nd-navy)" }}
              >
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
            </form>
            <p className="mt-4 text-center text-sm text-gray-500">
              <Link href="/login" className="hover:underline font-medium" style={{ color: "var(--nd-gold)" }}>
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
