import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { emailNotifications } = await req.json();
  const valid = ["none", "immediate", "weekly", "both"];
  if (!valid.includes(emailNotifications)) {
    return NextResponse.json({ error: "Invalid value" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { emailNotifications },
    select: { id: true, emailNotifications: true },
  });

  return NextResponse.json(user);
}
