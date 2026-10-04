import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { accountPassword } = await req.json();

  if (!accountPassword) return NextResponse.json({ error: "Your account password is required." }, { status: 400 });

  // Verify the user's own login password
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { password: true } });
  if (!user?.password) return NextResponse.json({ error: "Cannot verify identity." }, { status: 400 });

  const valid = await bcrypt.compare(accountPassword, user.password);
  if (!valid) return NextResponse.json({ error: "Incorrect password." }, { status: 403 });

  const entry = await prisma.sharedPassword.findUnique({ where: { id } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ password: decrypt(entry.password) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const entry = await prisma.sharedPassword.findUnique({ where: { id } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = session.user as { role?: string };
  if (entry.creatorId !== session.user.id && user.role !== "admin") {
    return NextResponse.json({ error: "Only the creator or an admin can delete this." }, { status: 403 });
  }

  await prisma.sharedPassword.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
