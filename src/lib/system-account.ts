import { prisma } from "@/lib/prisma";

// The internal account that owns seeded events. Nobody signs in as it and it
// is left out of the people list.
export const SYSTEM_EMAIL = "system@scheduleportal.local";
const OLD_SYSTEM_EMAIL = "system@familyportal.local";

// Databases created before the rename still have the account under its old
// address. Move it, unless an account with the new address already exists.
export async function migrateSystemAccount() {
  if (await prisma.user.findUnique({ where: { email: SYSTEM_EMAIL } })) return;
  await prisma.user.updateMany({
    where: { email: OLD_SYSTEM_EMAIL },
    data: { email: SYSTEM_EMAIL, name: "Schedule Portal" },
  });
}
