import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import SessionProvider from "@/components/SessionProvider";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const userWithRole = session.user as typeof session.user & { role?: string; mustChangePassword?: boolean };

  return (
    <SessionProvider>
      <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>
        <NavBar user={userWithRole} />
        <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8">{children}</main>
      </div>
    </SessionProvider>
  );
}
