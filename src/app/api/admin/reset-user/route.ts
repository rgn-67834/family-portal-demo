import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendTempPasswordEmail } from "@/lib/email";
import bcrypt from "bcryptjs";
import crypto from "crypto";

type SessionUser = { id: string; role?: string };

function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(crypto.randomBytes(10)).map(b => chars[b % chars.length]).join("");
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user?.id || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const tempPassword = generateTempPassword();
  const hashed = await bcrypt.hash(tempPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed, mustChangePassword: true },
  });

  await sendTempPasswordEmail(target.email, target.name, tempPassword).catch(console.error);

  return NextResponse.json({ ok: true, tempPassword });
}
