import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureGroups, requestToJoin } from "@/lib/groups";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

// One endpoint for everything a person can do with a group.
//   Anyone:       join, leave, color
//   Group admins: approve, deny, remove, makeAdmin, removeAdmin  (with userId)
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
  if (!group) return bad("Group not found.", 404);

  const mine = await prisma.groupMembership.findUnique({ where: { userId_groupId: { userId: me, groupId } } });

  if (action === "join") {
    if (mine) return bad(mine.status === "PENDING" ? "Your request is already waiting for approval." : "You are already in this group.");
    const membership = await requestToJoin(me, groupId);
    return NextResponse.json({ status: membership.status });
  }

  if (action === "leave") {
    if (!mine) return bad("You are not in this group.");
    await prisma.groupMembership.delete({ where: { userId_groupId: { userId: me, groupId } } });
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
    await prisma.groupMembership.update({ where: { userId_groupId: { userId: me, groupId } }, data: { color } });
    return NextResponse.json({ ok: true });
  }

  // Everything below changes someone else's membership
  const canManage = isSiteAdmin || (mine?.status === "APPROVED" && mine.role === "ADMIN");
  if (!canManage) return bad("Only this group's admins can do that.", 403);

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
      if (target.status !== "APPROVED") return bad("Approve the request first.");
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
