import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyEventChange } from "@/lib/email";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth()));

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59);

  const events = await prisma.calendarEvent.findMany({
    where: {
      OR: [
        { startDate: { gte: start, lte: end } },
        { endDate: { gte: start, lte: end } },
        { startDate: { lte: start }, endDate: { gte: end } },
      ],
    },
    include: {
      creator: { select: { id: true, name: true, image: true } },
      attendees: { include: { user: { select: { id: true, name: true, image: true, familyGroup: true } } } },
      children: {
        include: {
          creator: { select: { id: true, name: true, image: true } },
          attendees: { include: { user: { select: { id: true, name: true, image: true, familyGroup: true } } } },
        },
        orderBy: { startDate: "asc" },
      },
    },
    orderBy: { startDate: "asc" },
  });

  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type, title, description, startDate, endDate, allDay, location, assignedTo, family, parentId, attendeeIds } = body;

  if (!title || !startDate) {
    return NextResponse.json({ error: "title and startDate are required" }, { status: 400 });
  }

  const validTypes = ["EVENT", "RESERVATION", "CHORE"];
  const eventType = validTypes.includes(type) ? type : "EVENT";
  const { recurrence, recurrenceEnd } = body;
  const validRecurrence = ["NONE","DAILY","WEEKLY","MONTHLY","YEARLY"];

  const event = await prisma.calendarEvent.create({
    data: {
      type: eventType,
      title,
      description: description ?? null,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      allDay: allDay ?? false,
      location: location ?? null,
      assignedTo: assignedTo ?? null,
      family: family ?? null,
      parentId: parentId ?? null,
      recurrence: validRecurrence.includes(recurrence) ? recurrence : "NONE",
      recurrenceEnd: recurrenceEnd ? new Date(recurrenceEnd) : null,
      creatorId: session.user.id,
      attendees: attendeeIds?.length
        ? { createMany: { data: (attendeeIds as string[]).map(uid => ({ userId: uid })) } }
        : undefined,
    },
    include: {
      creator: { select: { id: true, name: true, image: true } },
      attendees: { include: { user: { select: { id: true, name: true, image: true, familyGroup: true } } } },
      children: { include: { creator: { select: { id: true, name: true, image: true } }, attendees: { include: { user: { select: { id: true, name: true, image: true, familyGroup: true } } } } } },
    },
  });

  if (attendeeIds?.length) {
    notifyEventChange(
      { title, type: eventType, startDate: new Date(startDate), location, changedBy: session.user.name ?? "Someone" },
      attendeeIds.filter((id: string) => id !== session.user?.id),
      "created"
    ).catch(console.error);
  }

  return NextResponse.json(event, { status: 201 });
}
