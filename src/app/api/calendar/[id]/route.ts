import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyEventChange } from "@/lib/email";

type SessionUser = { id: string; name?: string | null; role?: string; familyGroup?: string | null };

function canEdit(user: SessionUser, eventFamily: string | null, attendeeUserIds: string[]): boolean {
  if (user.role === "admin") return true;
  if (attendeeUserIds.includes(user.id)) return true;
  if (!eventFamily) return true;
  if (!user.familyGroup) return false;
  return eventFamily.split(",").map(f => f.trim()).includes(user.familyGroup);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.calendarEvent.findUnique({
    where: { id },
    include: { attendees: { select: { userId: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = session.user as SessionUser;
  const attendeeIds = existing.attendees.map(a => a.userId);
  if (!canEdit(user, existing.family, attendeeIds)) {
    return NextResponse.json({ error: "You can only edit your family's events." }, { status: 403 });
  }

  const validTypes = ["EVENT", "RESERVATION", "CHORE"];
  const validRecurrence = ["NONE","DAILY","WEEKLY","MONTHLY","YEARLY"];
  const newAttendeeIds: string[] | undefined = body.attendeeIds;

  const event = await prisma.calendarEvent.update({
    where: { id },
    data: {
      type: body.type && validTypes.includes(body.type) ? body.type : existing.type,
      title: body.title ?? existing.title,
      description: body.description !== undefined ? body.description : existing.description,
      startDate: body.startDate ? new Date(body.startDate) : existing.startDate,
      endDate: body.endDate ? new Date(body.endDate) : existing.endDate,
      allDay: body.allDay !== undefined ? body.allDay : existing.allDay,
      location: body.location !== undefined ? body.location : existing.location,
      assignedTo: body.assignedTo !== undefined ? body.assignedTo : existing.assignedTo,
      family: body.family !== undefined ? body.family : existing.family,
      recurrence: body.recurrence && validRecurrence.includes(body.recurrence) ? body.recurrence : existing.recurrence,
      recurrenceEnd: body.recurrenceEnd !== undefined ? (body.recurrenceEnd ? new Date(body.recurrenceEnd) : null) : existing.recurrenceEnd,
      ...(newAttendeeIds !== undefined && {
        attendees: {
          deleteMany: {},
          createMany: { data: newAttendeeIds.map(uid => ({ userId: uid })) },
        },
      }),
    },
    include: {
      creator: { select: { id: true, name: true, image: true } },
      attendees: { include: { user: { select: { id: true, name: true, image: true, familyGroup: true } } } },
      children: { include: { creator: { select: { id: true, name: true, image: true } }, attendees: { include: { user: { select: { id: true, name: true, image: true, familyGroup: true } } } } } },
    },
  });

  const notifyIds = (newAttendeeIds ?? attendeeIds).filter(uid => uid !== session.user?.id);
  if (notifyIds.length) {
    notifyEventChange(
      { title: event.title, type: event.type, startDate: event.startDate, location: event.location, changedBy: user.name ?? "Someone" },
      notifyIds,
      "updated"
    ).catch(console.error);
  }

  return NextResponse.json(event);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.calendarEvent.findUnique({
    where: { id },
    include: { attendees: { select: { userId: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = session.user as SessionUser;
  const attendeeIds = existing.attendees.map(a => a.userId);
  if (!canEdit(user, existing.family, attendeeIds)) {
    return NextResponse.json({ error: "You can only delete your family's events." }, { status: 403 });
  }

  const notifyIds = attendeeIds.filter(uid => uid !== session.user?.id);
  if (notifyIds.length) {
    notifyEventChange(
      { title: existing.title, type: existing.type, startDate: existing.startDate, location: existing.location, changedBy: user.name ?? "Someone" },
      notifyIds,
      "deleted"
    ).catch(console.error);
  }

  await prisma.calendarEvent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
