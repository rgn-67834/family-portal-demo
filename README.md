# Family Portal

A private hub for an extended family: a shared calendar for trips and
reservations, announcements, photos, and an encrypted vault for shared
passwords. Built with Next.js, Prisma, and Auth.js.

This is the public demo version. All households and events in the seed data are
fictional.

**Live demo:** <https://family-portal-demo.up.railway.app>. Register
with any email (nothing is verified or sent) and pick a household to see the
shared calendar. It is a public sandbox that anyone can sign up to, so do not
store real passwords or personal details in it.

Built with [Claude Code](https://claude.com/claude-code). I run a private
instance of this for my own family; this repository is the same app with the
real data replaced.

## Features

- **Shared calendar**: events and reservations tagged by household, with
  attendees and optional email notifications
- **Accounts**: registration by household, admin user management, password
  reset by email, forced change of temporary passwords
- **Password vault**: shared credentials encrypted at rest with a key you supply
- **Announcements and photos**

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

Edit `FAMILY_GROUPS` in [`src/lib/demo-data.ts`](src/lib/demo-data.ts). That
list drives the household picker at registration and the tags on calendar
events.

## Deploy on Railway

`railway.toml` builds with Nixpacks and runs `prisma db push` before starting.
Set the variables from `.env.example` in the Railway service, and attach a
volume or a hosted libSQL database so data survives redeploys.
