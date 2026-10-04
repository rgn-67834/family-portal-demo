import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await prisma.sharedPassword.findMany({
    select: {
      id: true, title: true, username: true, url: true,
      notes: true, category: true, family: true, createdAt: true,
      creator: { select: { id: true, name: true, image: true } },
    },
    orderBy: [{ category: "asc" }, { title: "asc" }],
  });

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, username, password, url, notes, category, family } = await req.json();
  if (!title || !password) return NextResponse.json({ error: "title and password are required" }, { status: 400 });

  const entry = await prisma.sharedPassword.create({
    data: {
      title,
      username: username || null,
      password: encrypt(password),
      url: url || null,
      notes: notes || null,
      category: category || "General",
      family: family || null,
      creatorId: session.user.id,
    },
    select: {
      id: true, title: true, username: true, url: true,
      notes: true, category: true, family: true, createdAt: true,
      creator: { select: { id: true, name: true, image: true } },
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
