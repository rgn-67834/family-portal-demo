// Shared by server and browser code, so it must not import the database.

export const GROUP_COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#dc2626", "#d97706",
  "#16a34a", "#0891b2", "#0C2340", "#C99700", "#64748b",
];

// An event's `family` field holds its group names, comma-separated
export function splitGroups(family: string | null | undefined): string[] {
  return (family ?? "").split(",").map(s => s.trim()).filter(Boolean);
}

// Used until a member picks their own color for a group
export function defaultGroupColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return GROUP_COLORS[h % GROUP_COLORS.length];
}
