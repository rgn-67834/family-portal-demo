import { prisma } from "@/lib/prisma";
import { SEED_GROUPS, SEED_GROUPS_PUBLIC } from "@/lib/seed-groups";
import { splitGroups } from "@/lib/group-colors";

// Calendar groups. An event's `family` field holds the names of the groups it
// belongs to, comma-separated; an event with no group is visible to everyone.
// A person sees a grouped event only if they are an approved member of one of
// its groups, are tagged on it, or created it. Site admins see everything.
//
// Groups themselves are private unless marked public: a person can only see
// (and ask to join) a group that is public, that they already belong to, or
// that they have been invited to.
//
// Membership status: INVITED (an admin asked them) -> APPROVED
//                    PENDING (they asked)          -> APPROVED

let bootstrapped: Promise<void> | null = null;

// Runs once per server start. Creates a group for every group name already in
// use, and, the first time only, makes existing users approved members of the
// group they registered with so nothing disappears from their calendar.
export function ensureGroups(): Promise<void> {
  bootstrapped ??= bootstrap().catch(err => { bootstrapped = null; throw err; });
  return bootstrapped;
}

async function bootstrap() {
  const users = await prisma.user.findMany({
    where: { familyGroup: { not: null } },
    select: { id: true, familyGroup: true },
    orderBy: { createdAt: "asc" },
  });
  const events = await prisma.calendarEvent.findMany({
    where: { family: { not: null } },
    select: { family: true },
  });

  const names = new Set<string>([
    ...SEED_GROUPS,
    ...users.map(u => u.familyGroup!.trim()).filter(Boolean),
    ...events.flatMap(e => splitGroups(e.family)),
  ]);
  for (const name of names) {
    await prisma.calendarGroup.upsert({ where: { name }, update: {}, create: { name } });
  }
  if (SEED_GROUPS_PUBLIC) {
    await prisma.calendarGroup.updateMany({ where: { name: { in: SEED_GROUPS } }, data: { isPublic: true } });
  }

  if (await prisma.groupMembership.count() > 0) return;

  const groups = await prisma.calendarGroup.findMany();
  const idByName = new Map(groups.map(g => [g.name, g.id]));
  const hasAdmin = new Set<string>();
  for (const u of users) {
    const groupId = idByName.get(u.familyGroup!.trim());
    if (!groupId) continue;
    // The longest-standing member of each group becomes its admin
    const role = hasAdmin.has(groupId) ? "MEMBER" : "ADMIN";
    hasAdmin.add(groupId);
    await prisma.groupMembership.create({ data: { userId: u.id, groupId, status: "APPROVED", role } });
  }
}

export async function approvedGroupNames(userId: string): Promise<Set<string>> {
  await ensureGroups();
  const rows = await prisma.groupMembership.findMany({
    where: { userId, status: "APPROVED" },
    select: { group: { select: { name: true } } },
  });
  return new Set(rows.map(r => r.group.name));
}

export function canSeeEvent(
  ev: { family: string | null; creatorId: string; attendeeIds: string[] },
  user: { id: string; isAdmin: boolean },
  myGroups: Set<string>,
): boolean {
  if (user.isAdmin) return true;
  const groups = splitGroups(ev.family);
  if (groups.length === 0) return true;
  if (ev.creatorId === user.id || ev.attendeeIds.includes(user.id)) return true;
  return groups.some(g => myGroups.has(g));
}

// The group names on an event that this person is allowed to know about.
// Someone tagged on an event can see the event without learning which
// private groups it belongs to.
export function visibleGroupNames(family: string | null, isAdmin: boolean, myGroups: Set<string>): string | null {
  if (isAdmin) return family;
  return splitGroups(family).filter(g => myGroups.has(g)).join(",") || null;
}

// A request to join a public group. If the group has no admin yet there is
// nobody to approve it, so the first person in becomes the group's admin.
export async function requestToJoin(userId: string, groupId: string) {
  const admins = await prisma.groupMembership.count({ where: { groupId, status: "APPROVED", role: "ADMIN" } });
  return prisma.groupMembership.create({
    data: admins > 0
      ? { userId, groupId, status: "PENDING", role: "MEMBER" }
      : { userId, groupId, status: "APPROVED", role: "ADMIN" },
  });
}

// Invitations sent to an email address before its owner had an account become
// real invitations when that person registers.
export async function claimInvites(userId: string, email: string) {
  const invites = await prisma.groupInvite.findMany({ where: { email: email.toLowerCase() } });
  for (const inv of invites) {
    await prisma.groupMembership.upsert({
      where: { userId_groupId: { userId, groupId: inv.groupId } },
      update: {},
      create: { userId, groupId: inv.groupId, status: "INVITED", role: "MEMBER" },
    });
  }
  await prisma.groupInvite.deleteMany({ where: { email: email.toLowerCase() } });
}
