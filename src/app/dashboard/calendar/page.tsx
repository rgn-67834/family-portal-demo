"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { splitGroups } from "@/lib/group-colors";

type EventType = "EVENT" | "RESERVATION" | "CHORE";
type Recurrence = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

interface FamilyUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface CalendarEvent {
  id: string;
  type: EventType;
  title: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  allDay: boolean;
  location?: string | null;
  assignedTo?: string | null;
  family?: string | null;
  parentId?: string | null;
  recurrence: Recurrence;
  recurrenceEnd?: string | null;
  children: CalendarEvent[];
  creator: { id: string; name: string | null; image: string | null };
  attendees: { user: FamilyUser }[];
}

const TYPE_META: Record<EventType, { label: string; color: string; bg: string; border: string; icon: string }> = {
  EVENT:       { label: "Event",       color: "#0C2340", bg: "#dbeafe", border: "#93c5fd", icon: "📅" },
  RESERVATION: { label: "Reservation", color: "#7c3aed", bg: "#ede9fe", border: "#c4b5fd", icon: "🏨" },
  CHORE:       { label: "Task",        color: "#b45309", bg: "#fef3c7", border: "#fcd34d", icon: "✅" },
};

const RECURRENCE_OPTS: { value: Recurrence; label: string }[] = [
  { value: "NONE",    label: "Does not repeat" },
  { value: "DAILY",   label: "Daily" },
  { value: "WEEKLY",  label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY",  label: "Yearly" },
];

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function occursOn(ev: CalendarEvent, target: Date): boolean {
  const start = new Date(ev.startDate);
  const end = ev.endDate ? new Date(ev.endDate) : new Date(ev.startDate);
  const recEnd = ev.recurrenceEnd ? new Date(ev.recurrenceEnd) : null;

  const tDay = new Date(target); tDay.setHours(12, 0, 0, 0);
  const sDay = new Date(start);  sDay.setHours(0, 0, 0, 0);
  const eDay = new Date(end);    eDay.setHours(23, 59, 59, 999);

  if (ev.recurrence === "NONE") {
    return tDay >= sDay && tDay <= eDay;
  }

  // Recurring: target must be on or after start
  if (tDay < sDay) return false;
  // And on or before recurrenceEnd if set
  if (recEnd) { const re = new Date(recEnd); re.setHours(23,59,59,999); if (tDay > re) return false; }

  switch (ev.recurrence) {
    case "DAILY":   return true;
    case "WEEKLY":  return target.getDay() === start.getDay();
    case "MONTHLY": return target.getDate() === start.getDate();
    case "YEARLY":  return target.getMonth() === start.getMonth() && target.getDate() === start.getDate();
    default:        return false;
  }
}

function Avatar({ user, size = 24 }: { user: { name?: string | null; image?: string | null }; size?: number }) {
  const initials = user.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "?";
  return user.image
    ? <Image src={user.image} alt={user.name ?? ""} width={size} height={size} unoptimized
        className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
    : <div className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.35, backgroundColor: "var(--nd-navy)" }}>
        {initials}
      </div>;
}

const EMPTY_FORM = {
  type: "EVENT" as EventType,
  title: "",
  description: "",
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
  allDay: false,
  location: "",
  assignedTo: "",
  attendeeIds: [] as string[],
  groups: [] as string[],
  recurrence: "NONE" as Recurrence,
  recurrenceEnd: "",
};

// Minimal Google Maps types
declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          Autocomplete: new (
            input: HTMLInputElement,
            opts?: { types?: string[] }
          ) => { addListener: (event: string, cb: () => void) => void; getPlace: () => { formatted_address?: string; name?: string } };
        };
      };
    };
    initGoogleMaps?: () => void;
  }
}

let mapsLoaded = false;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (mapsLoaded || window.google?.maps) { mapsLoaded = true; return Promise.resolve(); }
  return new Promise((resolve) => {
    window.initGoogleMaps = () => { mapsLoaded = true; resolve(); };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`;
    script.async = true;
    document.head.appendChild(script);
  });
}

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [allUsers, setAllUsers] = useState<FamilyUser[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  // The groups I belong to, and the color I chose for each
  const [myGroups, setMyGroups] = useState<{ name: string; color: string }[]>([]);
  const locationRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autocompleteRef = useRef<any>(null);

  const fetchEvents = useCallback(async () => {
    const res = await fetch(`/api/calendar?year=${year}&month=${month}`);
    if (res.ok) setEvents(await res.json());
  }, [year, month]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(setAllUsers).catch(() => {});
    fetch("/api/groups").then(r => r.json()).then(d =>
      setMyGroups((d.groups ?? []).filter((g: { myStatus: string }) => g.myStatus === "APPROVED"))
    ).catch(() => {});
  }, []);

  // An event takes the color of the first of its groups that I belong to
  function groupColor(ev: CalendarEvent): string | null {
    for (const name of splitGroups(ev.family)) {
      const mine = myGroups.find(g => g.name === name);
      if (mine) return mine.color;
    }
    return null;
  }

  // Init Google Places autocomplete when modal opens and input is ready
  useEffect(() => {
    if (!showModal) return;
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!key) return;

    const init = () => {
      if (!locationRef.current || !window.google?.maps?.places) return;
      if (autocompleteRef.current) return; // already attached
      const ac = new window.google.maps.places.Autocomplete(locationRef.current, { types: ["establishment", "geocode"] });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        const loc = place.name || place.formatted_address || "";
        setForm(f => ({ ...f, location: loc }));
      });
      autocompleteRef.current = ac;
    };

    if (window.google?.maps) {
      init();
    } else {
      loadGoogleMaps(key).then(init);
    }
  }, [showModal]);

  // Reset autocomplete ref when modal closes
  useEffect(() => { if (!showModal) autocompleteRef.current = null; }, [showModal]);

  function prevMonth() { month === 0 ? (setYear(y => y-1), setMonth(11)) : setMonth(m => m-1); }
  function nextMonth() { month === 11 ? (setYear(y => y+1), setMonth(0)) : setMonth(m => m+1); }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function eventsForDay(day: number) {
    const target = new Date(year, month, day);
    return events.filter(e => occursOn(e, target));
  }

  function openAdd(day?: Date) {
    setEditingEvent(null);
    const base = day ?? selectedDay ?? today;
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${base.getFullYear()}-${pad(base.getMonth()+1)}-${pad(base.getDate())}`;
    setForm({ ...EMPTY_FORM, startDate: dateStr });
    setUserSearch("");
    setShowModal(true);
  }

  function openEdit(ev: CalendarEvent) {
    setEditingEvent(ev);
    const sd = new Date(ev.startDate);
    const ed = ev.endDate ? new Date(ev.endDate) : null;
    const re = ev.recurrenceEnd ? new Date(ev.recurrenceEnd) : null;
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const fmtT = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setForm({
      type: ev.type,
      title: ev.title,
      description: ev.description ?? "",
      startDate: fmtDate(sd),
      startTime: fmtT(sd),
      endDate: ed ? fmtDate(ed) : "",
      endTime: ed ? fmtT(ed) : "",
      allDay: ev.allDay,
      location: ev.location ?? "",
      assignedTo: ev.assignedTo ?? "",
      attendeeIds: ev.attendees.map(a => a.user.id),
      groups: splitGroups(ev.family),
      recurrence: ev.recurrence ?? "NONE",
      recurrenceEnd: re ? fmtDate(re) : "",
    });
    setUserSearch("");
    setShowModal(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/calendar/${id}`, { method: "DELETE" });
    fetchEvents();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const buildDt = (date: string, time: string) =>
      date ? new Date(`${date}T${time || "00:00"}:00`).toISOString() : null;

    const family = form.groups.join(",") || null;

    const payload = {
      type: form.type,
      title: form.title,
      description: form.description || null,
      startDate: buildDt(form.startDate, form.startTime),
      endDate: buildDt(form.endDate, form.endTime),
      allDay: form.allDay,
      location: form.location || null,
      assignedTo: form.assignedTo || null,
      family,
      attendeeIds: form.attendeeIds,
      recurrence: form.recurrence,
      recurrenceEnd: form.recurrence !== "NONE" && form.recurrenceEnd ? new Date(form.recurrenceEnd).toISOString() : null,
    };

    const res = editingEvent
      ? await fetch(`/api/calendar/${editingEvent.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch("/api/calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

    setLoading(false);
    if (res.ok) { setShowModal(false); fetchEvents(); }
  }

  function toggleAttendee(uid: string) {
    setForm(f => ({
      ...f,
      attendeeIds: f.attendeeIds.includes(uid) ? f.attendeeIds.filter(id => id !== uid) : [...f.attendeeIds, uid],
    }));
  }

  function toggleGroup(name: string) {
    setForm(f => ({ ...f, groups: f.groups.includes(name) ? f.groups.filter(g => g !== name) : [...f.groups, name] }));
  }

  function toggleExpand(id: string) {
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const dayEvents = selectedDay ? events.filter(e => occursOn(e, selectedDay)) : [];
  const grouped = (["EVENT","RESERVATION","CHORE"] as EventType[]).reduce<Record<EventType, CalendarEvent[]>>(
    (acc, t) => { acc[t] = dayEvents.filter(e => e.type === t); return acc; },
    {} as Record<EventType, CalendarEvent[]>
  );

  const filteredUsers = allUsers.filter(u =>
    !userSearch || u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  function EventCard({ ev, indent = false }: { ev: CalendarEvent; indent?: boolean }) {
    const meta = TYPE_META[ev.type];
    const hasChildren = ev.children?.length > 0;
    const expanded = expandedIds.has(ev.id);
    const isRecurring = ev.recurrence && ev.recurrence !== "NONE";
    return (
      <div className={indent ? "ml-4 border-l-2 pl-2 mb-1" : "mb-2"} style={indent ? { borderColor: meta.border } : {}}>
        <div className="rounded-lg p-2.5 text-sm" style={{ backgroundColor: meta.bg, border: `1px solid ${meta.border}`, borderLeft: `5px solid ${groupColor(ev) ?? meta.border}` }}>
          <div className="flex items-start justify-between gap-1">
            <div className="flex-1 min-w-0">
              <div className="font-semibold leading-snug flex items-center gap-1" style={{ color: meta.color }}>
                {ev.title}
                {isRecurring && <span className="text-xs opacity-60" title={`Repeats ${ev.recurrence?.toLowerCase()}`}>🔁</span>}
              </div>
              {ev.description && <div className="text-xs text-gray-600 mt-0.5">{ev.description}</div>}
              {ev.location && <div className="text-xs text-gray-500 mt-0.5">📍 {ev.location}</div>}
              {ev.assignedTo && <div className="text-xs text-gray-500 mt-0.5">👤 {ev.assignedTo}</div>}
              {ev.family && <div className="text-xs text-gray-500 mt-0.5">👥 {splitGroups(ev.family).join(", ")}</div>}
              {!ev.allDay && (
                <div className="text-xs text-gray-500 mt-0.5">
                  🕐 {fmtTime(ev.startDate)}{ev.endDate && ` – ${fmtTime(ev.endDate)}`}
                </div>
              )}
              {ev.endDate && ev.allDay && ev.recurrence === "NONE" && new Date(ev.endDate).toDateString() !== new Date(ev.startDate).toDateString() && (
                <div className="text-xs text-gray-500 mt-0.5">
                  📆 Through {new Date(ev.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              )}
              {ev.attendees.length > 0 && (
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {ev.attendees.map(a => (
                    <div key={a.user.id} className="flex items-center gap-1" title={a.user.name ?? ""}>
                      <Avatar user={a.user} size={18} />
                      <span className="text-xs" style={{ color: meta.color }}>{a.user.name?.split(" ")[0]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0">
              {hasChildren && (
                <button onClick={() => toggleExpand(ev.id)} className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ color: meta.color, backgroundColor: meta.border + "55" }}>
                  {expanded ? "▲" : `▼ ${ev.children.length}`}
                </button>
              )}
              <button onClick={() => openEdit(ev)} className="text-xs underline" style={{ color: meta.color }}>Edit</button>
              <button onClick={() => handleDelete(ev.id)} className="text-xs underline text-red-400">Del</button>
            </div>
          </div>
        </div>
        {hasChildren && expanded && (
          <div className="mt-1">{ev.children.map(child => <EventCard key={child.id} ev={child} indent />)}</div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Calendar Grid */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4 gap-2">
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--nd-navy)" }}>Calendar</h1>
          <button onClick={() => openAdd()} className="px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition shrink-0" style={{ backgroundColor: "var(--nd-navy)" }}>
            + Add
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <button onClick={prevMonth} className="p-2 rounded hover:bg-gray-200 transition text-xl font-bold" style={{ color: "var(--nd-navy)" }}>‹</button>
          <h2 className="text-base sm:text-lg font-semibold flex-1 text-center" style={{ color: "var(--nd-navy)" }}>{MONTHS[month]} {year}</h2>
          <button onClick={nextMonth} className="p-2 rounded hover:bg-gray-200 transition text-xl font-bold" style={{ color: "var(--nd-navy)" }}>›</button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-xs font-bold py-1" style={{ color: "var(--nd-gold)" }}>
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{d[0]}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden" style={{ backgroundColor: "#d1d5db" }}>
          {cells.map((day, i) => {
            if (!day) return <div key={i} className="min-h-[56px] sm:min-h-[88px]" style={{ backgroundColor: "#f9fafb" }} />;
            const date = new Date(year, month, day);
            const isToday = isSameDay(date, today);
            const isSelected = selectedDay ? isSameDay(date, selectedDay) : false;
            const dayEvs = eventsForDay(day);
            return (
              <div key={i} onClick={() => setSelectedDay(date)} className="bg-white min-h-[56px] sm:min-h-[88px] p-0.5 sm:p-1 cursor-pointer transition"
                style={isSelected ? { backgroundColor: "#e8f0fe", outline: "2px solid var(--nd-navy)" } : {}}>
                <div className="text-xs font-bold w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full mb-0.5"
                  style={isToday ? { backgroundColor: "var(--nd-gold)", color: "white" } : { color: "#374151" }}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {dayEvs.slice(0, 2).map(ev => {
                    const meta = TYPE_META[ev.type];
                    const gc = groupColor(ev);
                    return (
                      <div key={ev.id} className="text-xs px-0.5 sm:px-1 rounded truncate leading-4 hidden sm:block"
                        style={{ backgroundColor: gc ? gc + "22" : meta.bg, color: meta.color, borderLeft: `3px solid ${gc ?? meta.color}` }}>
                        {ev.recurrence !== "NONE" ? "🔁" : meta.icon} {ev.title}
                      </div>
                    );
                  })}
                  {dayEvs.length > 0 && (
                    <div className="flex gap-0.5 flex-wrap sm:hidden">
                      {dayEvs.slice(0, 3).map(ev => (
                        <span key={ev.id} className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: groupColor(ev) ?? TYPE_META[ev.type].color }} />
                      ))}
                    </div>
                  )}
                  {dayEvs.length > 2 && <div className="text-xs text-gray-400 pl-1 hidden sm:block">+{dayEvs.length - 2} more</div>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 mt-3 flex-wrap">
          {(Object.entries(TYPE_META) as [EventType, typeof TYPE_META[EventType]][]).map(([type, meta]) => (
            <div key={type} className="flex items-center gap-1 text-xs">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: meta.bg, border: `1px solid ${meta.color}` }} />
              <span style={{ color: meta.color }} className="font-medium">{meta.icon} {meta.label}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-2 flex-wrap items-center">
          {myGroups.map(g => (
            <div key={g.name} className="flex items-center gap-1 text-xs text-gray-600">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: g.color }} />
              {g.name}
            </div>
          ))}
          <Link href="/dashboard/groups" className="text-xs underline" style={{ color: "var(--nd-navy)" }}>
            Groups, colors &amp; subscribe
          </Link>
        </div>
      </div>

      {/* Day Detail Panel */}
      <div className="lg:w-80 lg:shrink-0">
        {selectedDay ? (
          <div className="bg-white rounded-2xl shadow p-4 lg:sticky lg:top-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm" style={{ color: "var(--nd-navy)" }}>
                {selectedDay.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </h3>
              <div className="flex gap-2">
                <button onClick={() => openAdd(selectedDay)} className="text-xs px-2 py-1 rounded font-semibold text-white" style={{ backgroundColor: "var(--nd-navy)" }}>
                  + Add
                </button>
                <button onClick={() => setSelectedDay(null)} className="text-xs px-2 py-1 rounded font-semibold border border-gray-300 text-gray-500 lg:hidden">
                  ✕
                </button>
              </div>
            </div>
            {dayEvents.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Nothing planned.</p>}
            {(["EVENT","RESERVATION","CHORE"] as EventType[]).map(type => {
              const items = grouped[type];
              if (!items.length) return null;
              const meta = TYPE_META[type];
              return (
                <div key={type} className="mb-4">
                  <div className="text-xs font-bold mb-1.5 uppercase tracking-wide" style={{ color: meta.color }}>
                    {meta.icon} {meta.label}s
                  </div>
                  {items.map(ev => <EventCard key={ev.id} ev={ev} />)}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow p-4 text-center text-gray-400 text-sm hidden lg:block">
            <p className="mt-8">Select a day to see details.</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4" style={{ color: "var(--nd-navy)" }}>
                {editingEvent ? "Edit Item" : "Add to Calendar"}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Type selector */}
                <div className="grid grid-cols-3 gap-1">
                  {(["EVENT","RESERVATION","CHORE"] as EventType[]).map(t => {
                    const meta = TYPE_META[t];
                    const active = form.type === t;
                    return (
                      <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                        className="py-2 px-1 rounded-lg text-xs font-semibold border-2 transition text-center"
                        style={{ borderColor: active ? meta.color : "#e5e7eb", backgroundColor: active ? meta.bg : "white", color: active ? meta.color : "#6b7280" }}>
                        <div>{meta.icon}</div><div>{meta.label}</div>
                      </button>
                    );
                  })}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
                </div>

                <div className="flex items-center gap-2">
                  <input type="checkbox" id="allDay" checked={form.allDay} onChange={e => setForm(f => ({ ...f, allDay: e.target.checked }))} />
                  <label htmlFor="allDay" className="text-sm text-gray-700">All day</label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start date *</label>
                    <input type="date" required value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  {!form.allDay && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start time</label>
                      <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
                    <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  {!form.allDay && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End time</label>
                      <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  )}
                </div>

                {/* Recurrence */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Repeat</label>
                  <select value={form.recurrence} onChange={e => setForm(f => ({ ...f, recurrence: e.target.value as Recurrence }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                    {RECURRENCE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                {form.recurrence !== "NONE" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Repeat until (optional)</label>
                    <input type="date" value={form.recurrenceEnd} onChange={e => setForm(f => ({ ...f, recurrenceEnd: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                )}

                {/* Location with Google Places */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    ref={locationRef}
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ? "Start typing to search…" : "e.g. Community Center"}
                    autoComplete="off"
                  />
                </div>

                {form.type === "CHORE" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assigned to</label>
                    <input value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                )}

                {/* Which calendars the event is on */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Calendar</label>
                  {myGroups.length === 0 && form.groups.length === 0 ? (
                    <p className="text-xs text-gray-400">Everyone in the portal will see this. Join or create a group to post to its calendar only.</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {[...new Set([...myGroups.map(g => g.name), ...form.groups])].map(name => {
                          const on = form.groups.includes(name);
                          const color = myGroups.find(g => g.name === name)?.color ?? "#6b7280";
                          return (
                            <button key={name} type="button" onClick={() => toggleGroup(name)}
                              className="px-2.5 py-1 rounded-full text-xs font-semibold border-2 transition"
                              style={{ borderColor: color, backgroundColor: on ? color : "white", color: on ? "white" : color }}>
                              {name}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {form.groups.length === 0 ? "No group selected: everyone in the portal will see this." : "Only members of the selected groups, and anyone you tag, will see this."}
                      </p>
                    </>
                  )}
                </div>

                {/* Attendee picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tag people</label>
                  {form.attendeeIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {form.attendeeIds.map(uid => {
                        const u = allUsers.find(u => u.id === uid);
                        if (!u) return null;
                        return (
                          <div key={uid} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white font-medium"
                            style={{ backgroundColor: "var(--nd-navy)" }}>
                            <Avatar user={u} size={14} />
                            <span>{u.name?.split(" ")[0]}</span>
                            <button type="button" onClick={() => toggleAttendee(uid)} className="ml-0.5 opacity-70 hover:opacity-100">×</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Search people…"
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-1 focus:outline-none"
                  />
                  <div className="border border-gray-200 rounded-lg max-h-36 overflow-y-auto">
                    {filteredUsers.map(u => {
                      const checked = form.attendeeIds.includes(u.id);
                      return (
                        <label key={u.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                          <input type="checkbox" checked={checked} onChange={() => toggleAttendee(u.id)} />
                          <Avatar user={u} size={22} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800 truncate">{u.name}</div>
                          </div>
                        </label>
                      );
                    })}
                    {filteredUsers.length === 0 && <p className="text-xs text-gray-400 px-3 py-2">No members found.</p>}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="submit" disabled={loading}
                    className="flex-1 py-2 rounded-lg font-semibold text-white text-sm hover:opacity-90 transition"
                    style={{ backgroundColor: "var(--nd-navy)" }}>
                    {loading ? "Saving…" : editingEvent ? "Save Changes" : "Add to Calendar"}
                  </button>
                  <button type="button" onClick={() => setShowModal(false)}
                    className="flex-1 py-2 rounded-lg font-semibold text-sm border border-gray-300 hover:bg-gray-50 transition">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
