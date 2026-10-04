import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureGroups, requestToJoin } from "@/lib/groups";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

// One endpoint for everything a person can do with a group.
//   Anyone who can see it: join (public groups), accept / decline (an invitation), leave, color
//   Group admins:          approve, deny, remove, makeAdmin, removeAdmin  (with userId)
//                          invite, uninvite (with email), setPublic (with isPublic)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return bad("Unauthorized", 401);
  const me = session.user.id;
  const isSiteAdmin = (session.user as { role?: string }).role === "admin";

  const { id: groupId } = await params;
  const body = await req.json();
  const action = String(body.action ?? "");

  await ensureGroups();
  const group = await prisma.calendarGroup.findUnique({ where: { id: groupId } });
  const mine = group
    ? await prisma.groupMembership.findUnique({ where: { userId_groupId: { userId: me, groupId } } })
    : null;
  // A private group the person has no connection to looks like it doesn't exist
  if (!group || !(isSiteAdmin || group.isPublic || mine)) return bad("Group not found.", 404);
  const myKey = { userId_groupId: { userId: me, groupId } };

  if (action === "join") {
    if (mine?.status === "INVITED") {
      await prisma.groupMembership.update({ where: myKey, data: { status: "APPROVED" } });
      return NextResponse.json({ status: "APPROVED" });
    }
    if (mine) return bad(mine.status === "PENDING" ? "Your request is already waiting for approval." : "You are already in this group.");
    if (!group.isPublic && !isSiteAdmin) return bad("This group is by invitation only.", 403);
    const membership = await requestToJoin(me, groupId);
    return NextResponse.json({ status: membership.status });
  }

  if (action === "accept") {
    if (mine?.status !== "INVITED") return bad("You have no invitation to this group.");
    await prisma.groupMembership.update({ where: myKey, data: { status: "APPROVED" } });
    return NextResponse.json({ status: "APPROVED" });
  }

  if (action === "decline") {
    if (mine?.status !== "INVITED") return bad("You have no invitation to this group.");
    await prisma.groupMembership.delete({ where: myKey });
    return NextResponse.json({ ok: true });
  }

  if (action === "leave") {
    if (!mine) return bad("You are not in this group.");
    await prisma.groupMembership.delete({ where: myKey });
    // Don't leave a group with members but nobody who can approve requests
    const remaining = await prisma.groupMembership.findMany({
      where: { groupId, status: "APPROVED" }, orderBy: { createdAt: "asc" },
    });
    if (remaining.length && !remaining.some(m => m.role === "ADMIN")) {
      await prisma.groupMembership.update({
        where: { userId_groupId: { userId: remaining[0].userId, groupId } }, data: { role: "ADMIN" },
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "color") {
    if (mine?.status !== "APPROVED") return bad("Join the group before choosing its color.");
    const color = String(body.color ?? "");
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return bad("Color must look like #2563eb.");
    await prisma.groupMembership.update({ where: myKey, data: { color } });
    return NextResponse.json({ ok: true });
  }

  // Everything below is for the group's admins
  const canManage = isSiteAdmin || (mine?.status === "APPROVED" && mine.role === "ADMIN");
  if (!canManage) return bad("Only this group's admins can do that.", 403);

  if (action === "setPublic") {
    await prisma.calendarGroup.update({ where: { id: groupId }, data: { isPublic: body.isPublic === true } });
    return NextResponse.json({ ok: true });
  }

  if (action === "invite" || action === "uninvite") {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("Enter a valid email address.");
    // Accounts keep the capitalisation they registered with, so compare in lower case
    const user = (await prisma.user.findMany({ select: { id: true, email: true } })).find(u => u.email.toLowerCase() === email);

    if (action === "uninvite") {
      await prisma.groupInvite.deleteMany({ where: { groupId, email } });
      if (user) await prisma.groupMembership.deleteMany({ where: { groupId, userId: user.id, status: "INVITED" } });
      return NextResponse.json({ ok: true });
    }

    // The answer is the same whether or not the address has an account, so
    // inviting can't be used to find out who is registered.
    if (user) {
      const existing = await prisma.groupMembership.findUnique({ where: { userId_groupId: { userId: user.id, groupId } } });
      if (existing?.status === "PENDING") {
        // They had already asked to join, so an invitation settles it
        await prisma.groupMembership.update({ where: { userId_groupId: { userId: user.id, groupId } }, data: { status: "APPROVED" } });
      } else if (!existing) {
        await prisma.groupMembership.create({ data: { userId: user.id, groupId, status: "INVITED", role: "MEMBER" } });
      }
    } else {
      await prisma.groupInvite.upsert({
        where: { groupId_email: { groupId, email } },
        update: {},
        create: { groupId, email, invitedById: me },
      });
    }
    return NextResponse.json({ ok: true });
  }

  // The remaining actions change one person's membership
  const userId = String(body.userId ?? "");
  const target = await prisma.groupMembership.findUnique({ where: { userId_groupId: { userId, groupId } } });
  if (!target) return bad("That person has no request or membership in this group.", 404);
  const where = { userId_groupId: { userId, groupId } };

  switch (action) {
    case "approve":
      if (target.status !== "PENDING") return bad("That request was already handled.");
      await prisma.groupMembership.update({ where, data: { status: "APPROVED" } });
      break;
    case "deny":
      if (target.status !== "PENDING") return bad("That request was already handled.");
      await prisma.groupMembership.delete({ where });
      break;
    case "remove":
      if (userId === me) return bad("Use Leave to remove yourself.");
      await prisma.groupMembership.delete({ where });
      break;
    case "makeAdmin":
      if (target.status !== "APPROVED") return bad("They need to be a member first.");
      await prisma.groupMembership.update({ where, data: { role: "ADMIN" } });
      break;
    case "removeAdmin": {
      const admins = await prisma.groupMembership.count({ where: { groupId, status: "APPROVED", role: "ADMIN" } });
      if (target.role === "ADMIN" && admins <= 1) return bad("A group needs at least one admin.");
      await prisma.groupMembership.update({ where, data: { role: "MEMBER" } });
      break;
    }
    default:
      return bad("Unknown action.");
  }
  return NextResponse.json({ ok: true });
}
