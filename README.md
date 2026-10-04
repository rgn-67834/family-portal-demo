# Schedule Portal

Shared calendars for the groups you belong to: households, teams, clubs, or
any set of people who plan things together. Each group has its own calendar,
members choose their own colors, and everyone can subscribe from Outlook,
Google or Apple Calendar. It also includes an encrypted vault for shared
passwords. Built with Next.js, Prisma, and Auth.js.

This is the public demo version. All groups and events in the seed data are
fictional.

**Live demo:** <https://schedule-portal-demo.up.railway.app>. Register with any
email (nothing is verified or sent), then open **Groups** to join one of the
demo's public groups and see its calendar. It is a public sandbox that anyone
can sign up to, so do not store real passwords or personal details in it.

Built with [Claude Code](https://claude.com/claude-code). It started as a
portal for my own family, which I still run privately; this repository is the
same app with the real data replaced.

## Features

- **Group calendars**: an event on a group's calendar is seen only by that
  group's members, the people tagged on it and its creator. Events with no
  group are seen by everyone.
- **Private by default**: a group is visible only to its members and the
  people its admins invite by email. A group marked public can be seen by
  anyone signed in, who can then ask to join and wait for an admin's approval.
- **Invitations**: admins invite by email address. The invitation is waiting
  on the Groups page, including for someone who registers later with that
  address. Names of private groups are never shown to non-members, even on
  events they are tagged on.
- **Your own colors**: each member picks the color every group shows in on
  their calendar
- **Subscribe from Outlook, Google or Apple Calendar**: a private link (an
  iCalendar feed) that shows exactly the events you can see in the portal, and
  can be replaced or turned off
- **Events**: one-off and repeating events, reservations and tasks, with
  attendees and optional email notifications
- **Accounts**: admin user management, password reset by email, forced change
  of temporary passwords
- **Password vault**: shared credentials encrypted at rest with a key you supply

## Local setup

```bash
npm install
cp .env.example .env      # then fill in the values
npx prisma db push
npx tsx prisma/seed.ts    # optional: loads the demo calendar
npm run dev
```

Open <http://localhost:3000>.

There are no default credentials. The seed creates an admin account only when
`ADMIN_EMAIL` and `ADMIN_PASSWORD` are both set.

`ENCRYPTION_KEY` must be 64 hex characters: `openssl rand -hex 32`.

## Making it yours

[`src/lib/seed-groups.ts`](src/lib/seed-groups.ts) lists the groups that exist
from the first start and whether they are public. The demo seeds five public
groups so a visitor has something to join; for real use, set the list to `[]`
and `SEED_GROUPS_PUBLIC` to `false`, then create groups and invite people from
the Groups page.

The first person to join a group with no admin becomes its admin. Site admins
can see and manage every group.

## Locked out without email

If password-reset email is not configured, a site owner can recover an account
with the `SEED_SECRET`:

```
/api/admin/seed/reset-password?secret=YOUR_SEED_SECRET&email=you@example.com
```

It returns a temporary password for that one account, which must be changed at
the next sign-in. Nothing else is touched.

## Deploy on Railway

`railway.toml` builds with Nixpacks and runs `prisma db push` before starting.
Set the variables from `.env.example` in the Railway service, and attach a
volume or a hosted libSQL database so data survives redeploys.
