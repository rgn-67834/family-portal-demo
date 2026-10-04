// Builds an iCalendar (.ics) feed that Outlook, Google Calendar and Apple
// Calendar can subscribe to.

export type FeedEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startDate: Date;
  endDate: Date | null;
  allDay: boolean;
  recurrence: string;
  recurrenceEnd: Date | null;
  family: string | null;
  createdAt: Date;
};

const pad = (n: number) => String(n).padStart(2, "0");
const dateOnly = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const dateTime = (d: Date) => `${dateOnly(d)}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// Lines longer than 75 bytes must be folded onto continuation lines
function fold(line: string): string {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch);
    if (bytes + size > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

const FREQ: Record<string, string> = { DAILY: "DAILY", WEEKLY: "WEEKLY", MONTHLY: "MONTHLY", YEARLY: "YEARLY" };

export function buildIcs(calendarName: string, events: FeedEvent[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Family Portal//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const ev of events) {
    lines.push("BEGIN:VEVENT", `UID:${ev.id}@family-portal`, `DTSTAMP:${dateTime(ev.createdAt)}`);

    if (ev.allDay) {
      // All-day end dates are exclusive in iCalendar, so add a day
      const last = ev.endDate && ev.endDate > ev.startDate ? ev.endDate : ev.startDate;
      const end = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate() + 1));
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(ev.startDate)}`, `DTEND;VALUE=DATE:${dateOnly(end)}`);
    } else {
      const end = ev.endDate && ev.endDate > ev.startDate ? ev.endDate : new Date(ev.startDate.getTime() + 60 * 60 * 1000);
      lines.push(`DTSTART:${dateTime(ev.startDate)}`, `DTEND:${dateTime(end)}`);
    }

    if (FREQ[ev.recurrence]) {
      let rule = `RRULE:FREQ=${FREQ[ev.recurrence]}`;
      if (ev.recurrenceEnd) {
        rule += ev.allDay ? `;UNTIL=${dateOnly(ev.recurrenceEnd)}` : `;UNTIL=${dateTime(ev.recurrenceEnd)}`;
      }
      lines.push(rule);
    }

    lines.push(`SUMMARY:${escapeText(ev.title)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${escapeText(ev.location)}`);
    if (ev.family) lines.push(`CATEGORIES:${ev.family.split(",").map(g => escapeText(g.trim())).filter(Boolean).join(",")}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
