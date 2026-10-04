import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { defaultGroupColor } from "@/lib/group-colors";
import { ensureGroups } from "@/lib/groups";

// The groups this person may know about: public ones, ones they belong to or
// have asked to join, and ones they are invited to. Site admins see all.
// For each group it returns their own membership, the member list if they
// belong, and the requests and invitations if they can manage it.
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
      invites: { orderBy: { createdAt: "asc" } },
    },
  });

  return NextResponse.json({
    isSiteAdmin,
    groups: groups
      .filter(g => isSiteAdmin || g.isPublic || g.memberships.some(m => m.userId === userId))
      .map(g => {
        const mine = g.memberships.find(m => m.userId === userId);
        const approved = g.memberships.filter(m => m.status === "APPROVED");
        const isMember = mine?.status === "APPROVED";
        const canManage = isSiteAdmin || (isMember && mine?.role === "ADMIN");
        return {
          id: g.id,
          name: g.name,
          isPublic: g.isPublic,
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
          // People an admin has invited who have not answered yet
          invited: canManage
            ? [
                ...g.memberships.filter(m => m.status === "INVITED").map(m => m.user.email),
                ...g.invites.map(i => i.email),
              ]
            : [],
        };
      }),
  });
}

// Create a group. Whoever creates it is its first admin. Groups are private
// (invitation only) unless created as public.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  if (name.length < 2 || name.length > 60) {
    return NextResponse.json({ error: "Group name must be 2 to 60 characters." }, { status: 400 });
  }
  // Events store their groups as a comma-separated list
  if (name.includes(",")) {
    return NextResponse.json({ error: "Group names cannot contain commas." }, { status: 400 });
  }

  await ensureGroups();
  if (await prisma.calendarGroup.findUnique({ where: { name } })) {
    // Deliberately vague: the existing group may be private
    return NextResponse.json({ error: "That name is not available. Try another." }, { status: 409 });
  }

  const group = await prisma.calendarGroup.create({
    data: {
      name,
      isPublic: body.isPublic === true,
      memberships: { create: { userId: session.user.id, status: "APPROVED", role: "ADMIN" } },
    },
  });
  return NextResponse.json({ id: group.id, name: group.name }, { status: 201 });
}
