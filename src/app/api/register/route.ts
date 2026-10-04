import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ensureGroups, requestToJoin } from "@/lib/groups";

export async function POST(req: NextRequest) {
  const { name, email, password, familyGroup } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "All fields required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, password: hashed, familyGroup: familyGroup ?? null },
  });

  // Picking a household at sign-up asks to join its calendar group. Someone
  // already in the group approves it, unless the group has nobody in it yet.
  if (familyGroup) {
    await ensureGroups();
    const group = await prisma.calendarGroup.findUnique({ where: { name: String(familyGroup).trim() } });
    if (group) await requestToJoin(user.id, group.id);
  }

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
