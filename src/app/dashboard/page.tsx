import { auth } from "@/lib/auth";
import Link from "next/link";

const features = [
  { href: "/dashboard/calendar", label: "Calendar", icon: "📅", desc: "Shared family events, tasks & reservations" },
  { href: "/dashboard/passwords", label: "Passwords", icon: "🔐", desc: "Shared family credentials vault" },
];

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--nd-navy)" }}>
        Welcome back, {session?.user?.name?.split(" ")[0]}!
      </h1>
      <p className="text-gray-500 mb-8">Here&apos;s what&apos;s happening with the family.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {features.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className="bg-white rounded-2xl shadow p-6 hover:shadow-md transition flex flex-col gap-2 border-t-4"
            style={{ borderColor: "var(--nd-gold)" }}
          >
            <span className="text-4xl">{f.icon}</span>
            <h2 className="text-lg font-semibold" style={{ color: "var(--nd-navy)" }}>{f.label}</h2>
            <p className="text-sm text-gray-500">{f.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
