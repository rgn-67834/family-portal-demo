import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SYSTEM_EMAIL, migrateSystemAccount } from "@/lib/system-account";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await migrateSystemAccount();
  const users = await prisma.user.findMany({
    where: { email: { not: SYSTEM_EMAIL } },
    // Group names are private, so the people list carries no group labels
    select: { id: true, name: true, email: true, image: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}
