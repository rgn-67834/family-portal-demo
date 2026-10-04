"use client";

import Link from "next/link";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { useState } from "react";

interface Props {
  user?: { name?: string | null; email?: string | null; image?: string | null; role?: string };
}

export default function NavBar({ user }: Props) {
  const initials = user?.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "?";
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="text-white px-4 py-3 shadow" style={{ backgroundColor: "var(--nd-navy)" }}>
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-xl font-bold tracking-tight" style={{ color: "var(--nd-gold)" }}>
          Schedule Portal
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-5 text-sm font-medium">
          <Link href="/dashboard/calendar" className="hover:opacity-75 transition">Calendar</Link>
          <Link href="/dashboard/groups" className="hover:opacity-75 transition">Groups</Link>
          <Link href="/dashboard/passwords" className="hover:opacity-75 transition">Passwords</Link>
          {user?.role === "admin" && (
            <Link href="/dashboard/admin" className="hover:opacity-75 transition" style={{ color: "var(--nd-gold)" }}>Admin</Link>
          )}
          <span className="opacity-30">|</span>
          <Link href="/dashboard/settings" className="flex items-center gap-2 hover:opacity-80 transition">
            <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: "var(--nd-gold)", color: "var(--nd-navy)" }}>
              {user?.image
                ? <Image src={user.image} alt="Avatar" width={32} height={32} className="object-cover w-full h-full" unoptimized />
                : initials}
            </div>
            <span className="opacity-80">{user?.name?.split(" ")[0]}</span>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="px-3 py-1 rounded-lg transition hover:opacity-80 font-semibold text-sm"
            style={{ backgroundColor: "var(--nd-gold)", color: "var(--nd-navy)" }}
          >
            Sign out
          </button>
        </div>

        {/* Mobile: avatar + hamburger */}
        <div className="flex sm:hidden items-center gap-3">
          <Link href="/dashboard/settings">
            <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: "var(--nd-gold)", color: "var(--nd-navy)" }}>
              {user?.image
                ? <Image src={user.image} alt="Avatar" width={32} height={32} className="object-cover w-full h-full" unoptimized />
                : initials}
            </div>
          </Link>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="p-1 rounded focus:outline-none"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="sm:hidden mt-3 border-t border-white/20 pt-3 flex flex-col gap-3 text-sm font-medium pb-1">
          <Link href="/dashboard/calendar" onClick={() => setMenuOpen(false)} className="hover:opacity-75">Calendar</Link>
          <Link href="/dashboard/groups" onClick={() => setMenuOpen(false)} className="hover:opacity-75">Groups</Link>
          <Link href="/dashboard/passwords" onClick={() => setMenuOpen(false)} className="hover:opacity-75">Passwords</Link>
          {user?.role === "admin" && (
            <Link href="/dashboard/admin" onClick={() => setMenuOpen(false)} className="hover:opacity-75" style={{ color: "var(--nd-gold)" }}>Admin</Link>
          )}
          <Link href="/dashboard/settings" onClick={() => setMenuOpen(false)} className="hover:opacity-75">Settings</Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-left hover:opacity-75"
            style={{ color: "var(--nd-gold)" }}
          >
            Sign out
          </button>
        </div>
      )}
    </nav>
  );
}
