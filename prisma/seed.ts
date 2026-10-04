import "dotenv/config";
import crypto from "crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";
import { demoEvents } from "../src/lib/demo-data";

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

async function main() {
  // ── Ensure the admin account exists ───────────────────────────────────────
  // Credentials come from ADMIN_EMAIL / ADMIN_PASSWORD. There is no default
  // password; without both variables no admin is created.
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!admin) {
      await prisma.user.create({
        data: { name: "Admin", email: adminEmail, password: await bcrypt.hash(adminPassword, 10), role: "admin" },
      });
      console.log(`Created admin account for ${adminEmail}`);
    } else {
      await prisma.user.update({ where: { email: adminEmail }, data: { role: "admin" } });
    }
  } else {
    console.log("ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin account.");
  }

  // ── System user owns seeded events ───────────────────────────────────────
  // Gets a random password nobody knows, so it can never be logged into.
  let sys = await prisma.user.findUnique({ where: { email: "system@familyportal.local" } });
  if (!sys) {
    sys = await prisma.user.create({
      data: { name: "Schedule Portal", email: "system@familyportal.local", password: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10) },
    });
  }
  const uid = sys.id;

  // ── Clear existing events ─────────────────────────────────────────────────
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

  console.log(`✅ Seed complete! ${events.length} demo events.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
