"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface FamilyUser {
  id: string;
  name: string | null;
  email: string;
  familyGroup: string | null;
  role: string;
  mustChangePassword: boolean;
  createdAt: string;
}

export default function AdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const me = session?.user as { role?: string } | undefined;

  const [users, setUsers] = useState<FamilyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetResult, setResetResult] = useState<Record<string, string>>({});
  const [resetting, setResetting] = useState<string | null>(null);

  useEffect(() => {
    if (session && me?.role !== "admin") router.push("/dashboard");
  }, [session, me, router]);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleReset(userId: string) {
    setResetting(userId);
    setResetResult(prev => ({ ...prev, [userId]: "" }));
    const res = await fetch("/api/admin/reset-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setResetting(null);
    const data = await res.json();
    if (res.ok) {
      setResetResult(prev => ({ ...prev, [userId]: `Temp password: ${data.tempPassword}` }));
      fetchUsers();
    } else {
      setResetResult(prev => ({ ...prev, [userId]: data.error ?? "Error" }));
    }
  }

  if (me?.role !== "admin") return null;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--nd-navy)" }}>Admin — Users</h1>
      <p className="text-sm text-gray-500 mb-6">Issue password resets for any member. They'll be emailed a temporary password and prompted to change it on next login.</p>

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-3">
          {users.map(u => (
            <div key={u.id} className="bg-white rounded-xl shadow p-4 flex flex-col sm:flex-row sm:items-center gap-3 border-l-4"
              style={{ borderColor: u.mustChangePassword ? "#f59e0b" : "var(--nd-gold)" }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm" style={{ color: "var(--nd-navy)" }}>{u.name ?? "(no name)"}</span>
                  {u.role === "admin" && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "var(--nd-navy)", color: "var(--nd-gold)" }}>Admin</span>
                  )}
                  {u.mustChangePassword && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">Must change password</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{u.email}</div>
                <div className="text-xs text-gray-400">{u.familyGroup ?? "No family group"}</div>
                {resetResult[u.id] && (
                  <div className="mt-1 text-xs font-mono rounded px-2 py-1 bg-green-50 text-green-800 border border-green-200 break-all">
                    {resetResult[u.id]}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleReset(u.id)}
                disabled={resetting === u.id}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white shrink-0 hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: "var(--nd-navy)" }}
              >
                {resetting === u.id ? "Resetting…" : "Reset Password"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
