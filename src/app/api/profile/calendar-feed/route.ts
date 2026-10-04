import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// The subscription link contains a secret token instead of a login, because
// calendar apps fetch the feed without being signed in. Anyone holding the
// link can read the calendar, so it can be replaced or switched off here.

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const feed = await prisma.calendarFeed.findUnique({ where: { userId: session.user.id } });
  return NextResponse.json({ token: feed?.token ?? null });
}

// Create the link, or replace it (the old link stops working)
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = crypto.randomBytes(24).toString("base64url");
  await prisma.calendarFeed.deleteMany({ where: { userId: session.user.id } });
  await prisma.calendarFeed.create({ data: { token, userId: session.user.id } });
  return NextResponse.json({ token });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.calendarFeed.deleteMany({ where: { userId: session.user.id } });
  return NextResponse.json({ token: null });
}
