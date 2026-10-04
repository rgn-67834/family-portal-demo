import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    where: { email: { not: "system@familyportal.local" } },
    select: { id: true, name: true, email: true, image: true, familyGroup: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}
