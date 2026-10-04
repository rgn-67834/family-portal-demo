import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Minimal config used by middleware (Edge runtime — no Prisma/Node APIs allowed).
// Full auth with DB adapter lives in auth.ts.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // authorize is never called in middleware — only JWT verification runs there.
      async authorize() { return null; },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "member";
        token.familyGroup = (user as { familyGroup?: string | null }).familyGroup ?? null;
        token.mustChangePassword = (user as { mustChangePassword?: boolean }).mustChangePassword ?? false;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { familyGroup?: string | null }).familyGroup = token.familyGroup as string | null;
        (session.user as { mustChangePassword?: boolean }).mustChangePassword = token.mustChangePassword as boolean;
      }
      return session;
    },
  },
};
