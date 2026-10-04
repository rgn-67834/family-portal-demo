import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { migrateSystemAccount } from "@/lib/system-account";
import { demoEvents } from "@/lib/demo-data";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Protected by SEED_SECRET env var — call with ?secret=YOUR_SECRET
// Safe to call multiple times: clears events then re-seeds, never overwrites existing users.

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Ensure the admin account — credentials come from ADMIN_EMAIL / ADMIN_PASSWORD,
  // there is no default password.
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!admin) {
      await prisma.user.create({
        data: { name: "Admin", email: adminEmail, password: await bcrypt.hash(adminPassword, 10), role: "admin" },
      });
    } else {
      await prisma.user.update({ where: { email: adminEmail }, data: { role: "admin" } });
    }
  }

  // System user for seeded events — random password, so it can never be logged into
  await migrateSystemAccount();
  let sys = await prisma.user.findUnique({ where: { email: "system@scheduleportal.local" } });
  if (!sys) {
    sys = await prisma.user.create({
      data: { name: "Schedule Portal", email: "system@scheduleportal.local", password: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10) },
    });
  }
  const uid = sys.id;

  // Clear and re-seed events
  await prisma.calendarEvent.deleteMany({});

  const events = demoEvents();
  for (const data of events) {
    await prisma.calendarEvent.create({
      data: {
        type: data.type ?? "EVENT",
        title: data.title,
        description: data.description ?? null,
        startDate: data.start,
        endDate: data.end ?? null,
        allDay: data.allDay ?? true,
        location: data.location ?? null,
        family: data.family ?? null,
        creatorId: uid,
      },
    });
  }

  return NextResponse.json({ ok: true, message: `Seeded ${events.length} demo events.` });
}
