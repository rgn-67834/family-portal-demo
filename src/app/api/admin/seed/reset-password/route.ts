import crypto from "crypto";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Account recovery for when password-reset email is not set up.
// Call with ?secret=SEED_SECRET&email=you@example.com
// It sets a temporary password for that one account and changes nothing else;
// the account must choose a new password at its next sign-in.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.SEED_SECRET || secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const email = (req.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase();
  const user = (await prisma.user.findMany({ select: { id: true, email: true } })).find(u => u.email.toLowerCase() === email);
  if (!user) return NextResponse.json({ error: "No account with that email." }, { status: 404 });

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const tempPassword = Array.from(crypto.randomBytes(12)).map(b => chars[b % chars.length]).join("");
  await prisma.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(tempPassword, 12), mustChangePassword: true, resetToken: null, resetTokenExpires: null },
  });

  return NextResponse.json({ email: user.email, tempPassword, note: "Sign in with this, then choose a new password." });
}
