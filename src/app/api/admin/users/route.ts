import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SessionUser = { id: string; role?: string };

export async function GET() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user?.id || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, familyGroup: true, role: true, mustChangePassword: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(users);
}
