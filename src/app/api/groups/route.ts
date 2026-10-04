import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { defaultGroupColor } from "@/lib/group-colors";
import { ensureGroups } from "@/lib/groups";

// Every group, with what the current user is allowed to know about it:
// their own membership, the member list if they belong, and the pending
// requests if they can approve them.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const isSiteAdmin = (session.user as { role?: string }).role === "admin";

  await ensureGroups();
  const groups = await prisma.calendarGroup.findMany({
    orderBy: { name: "asc" },
    include: {
      memberships: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return NextResponse.json({
    isSiteAdmin,
    groups: groups.map(g => {
      const mine = g.memberships.find(m => m.userId === userId);
      const approved = g.memberships.filter(m => m.status === "APPROVED");
      const isMember = mine?.status === "APPROVED";
      const canManage = isSiteAdmin || (isMember && mine?.role === "ADMIN");
      return {
        id: g.id,
        name: g.name,
        memberCount: approved.length,
        myStatus: mine?.status ?? "NONE",
        myRole: isMember ? mine!.role : null,
        color: mine?.color ?? defaultGroupColor(g.name),
        canManage,
        members: isMember || canManage
          ? approved.map(m => ({ userId: m.userId, name: m.user.name, role: m.role, isMe: m.userId === userId }))
          : [],
        pending: canManage
          ? g.memberships.filter(m => m.status === "PENDING").map(m => ({ userId: m.userId, name: m.user.name, email: m.user.email }))
          : [],
      };
    }),
  });
}

// Create a group. Whoever creates it is its first admin.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const name = String((await req.json()).name ?? "").trim();
  if (name.length < 2 || name.length > 60) {
    return NextResponse.json({ error: "Group name must be 2 to 60 characters." }, { status: 400 });
  }
  // Events store their groups as a comma-separated list
  if (name.includes(",")) {
    return NextResponse.json({ error: "Group names cannot contain commas." }, { status: 400 });
  }

  await ensureGroups();
  if (await prisma.calendarGroup.findUnique({ where: { name } })) {
    return NextResponse.json({ error: "A group with that name already exists." }, { status: 409 });
  }

  const group = await prisma.calendarGroup.create({
    data: { name, memberships: { create: { userId: session.user.id, status: "APPROVED", role: "ADMIN" } } },
  });
  return NextResponse.json({ id: group.id, name: group.name }, { status: 201 });
}
