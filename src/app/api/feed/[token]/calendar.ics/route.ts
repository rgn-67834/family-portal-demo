import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { approvedGroupNames, canSeeEvent } from "@/lib/groups";
import { buildIcs } from "@/lib/ics";

// The calendar subscription feed. There is no login here: the token in the URL
// identifies the person, and the feed holds exactly the events they can see
// in the portal.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const feed = token
    ? await prisma.calendarFeed.findUnique({ where: { token }, select: { user: { select: { id: true, role: true } } } })
    : null;
  const user = feed?.user;
  if (!user) return new NextResponse("Not found", { status: 404 });

  const myGroups = await approvedGroupNames(user.id);
  const events = await prisma.calendarEvent.findMany({
    include: { attendees: { select: { userId: true } } },
    orderBy: { startDate: "asc" },
  });
  const visible = events.filter(ev =>
    canSeeEvent(
      { family: ev.family, creatorId: ev.creatorId, attendeeIds: ev.attendees.map(a => a.userId) },
      { id: user.id, isAdmin: user.role === "admin" },
      myGroups,
    )
  );

  return new NextResponse(buildIcs("Family Portal", visible), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="family-portal.ics"',
      "Cache-Control": "no-store",
    },
  });
}
