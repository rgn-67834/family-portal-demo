// Demo data. Every household and event here is fictional.
// Replace FAMILY_GROUPS with your own households before using this for real.

// ─── Family group constants ───────────────────────────────────────────────────
const F_GRAND = "Pat & Sam Rivera";
const F_ALEX  = "Alex & Jordan Rivera";
const F_CASEY = "Casey & Morgan Rivera";
const F_TAY   = "Taylor Rivera & Jamie Okafor";
const F_RILEY = "Riley Rivera & Drew Lindqvist";

export const FAMILY_GROUPS = [F_GRAND, F_ALEX, F_CASEY, F_TAY, F_RILEY];

const F_ALL = FAMILY_GROUPS.join(",");

// d(month, day) → Date in the current year, month is 1-based
const d = (month: number, day: number) => new Date(new Date().getFullYear(), month - 1, day);

export type DemoEvent = {
  type?: string; title: string; description?: string;
  start: Date; end?: Date; allDay?: boolean;
  location?: string; family?: string;
};

export const demoEvents = (): DemoEvent[] => [
  { title: "Grandparents' Anniversary Dinner", location: "Lakeside Inn", start: d(5,30), family: F_ALL },
  { type: "RESERVATION", title: "Alex & Jordan – City Weekend", location: "Chicago, IL", start: d(6,6), end: d(6,7), family: F_ALEX },
  { type: "RESERVATION", title: "Okafor Cousin Wedding", location: "Asheville, NC", start: d(6,6), family: F_TAY },
  // Two households together — one multi-day event tagged to both
  { type: "RESERVATION", title: "Siblings Weekend at the Lake House", location: "Lake House", start: d(6,12), end: d(6,14), family: `${F_ALEX},${F_CASEY}` },
  { title: "Taylor – Half Marathon", description: "Race day, cheering section welcome", location: "Riverfront Park", start: d(6,13), family: F_TAY },
  { type: "RESERVATION", title: "Riley & Drew – Lake House", description: "Long weekend at the lake house", location: "Lake House", start: d(6,19), end: d(6,22), family: F_RILEY },
  { type: "RESERVATION", title: "Alex & Jordan – Mountain Cabin", description: "Two-week trip", location: "Estes Park, CO", start: d(7,3), end: d(7,17), family: F_ALEX },
  { title: "4th of July Cookout", description: "Everyone at the lake house, bring a side", location: "Lake House", start: d(7,4), family: F_ALL },
  { type: "RESERVATION", title: "Lake House – Lindqvist Family Week", description: "Drew's parents have the lake house this week", location: "Lake House", start: d(7,11), end: d(7,18), family: F_ALL },
  { title: "Casey's Graduation Party", start: d(8,1), family: F_CASEY },
  { type: "RESERVATION", title: "College Friend Wedding (TBD)", location: "Madison, WI", start: d(8,8), family: F_CASEY },
  { title: "Family Reunion Picnic", location: "Riverfront Park", start: d(8,22), family: F_ALL },
  { title: "Homecoming Football Game", location: "State University", start: d(9,12), family: F_GRAND },
];
