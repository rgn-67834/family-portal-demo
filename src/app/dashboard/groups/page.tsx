"use client";

import { useCallback, useEffect, useState } from "react";
import { GROUP_COLORS } from "@/lib/group-colors";

interface Group {
  id: string;
  name: string;
  isPublic: boolean;
  memberCount: number;
  myStatus: "NONE" | "PENDING" | "INVITED" | "APPROVED";
  myRole: "ADMIN" | "MEMBER" | null;
  color: string;
  canManage: boolean;
  members: { userId: string; name: string | null; role: "ADMIN" | "MEMBER"; isMe: boolean }[];
  pending: { userId: string; name: string | null; email: string }[];
  invited: string[];
}

const navy = { color: "var(--nd-navy)" };
const navyBg = { backgroundColor: "var(--nd-navy)" };
const card = "bg-white rounded-2xl shadow p-4 sm:p-5";
const smallBtn = "text-xs px-2.5 py-1 rounded-lg font-semibold border border-gray-300 hover:bg-gray-50 transition";
const row = "flex items-center justify-between gap-2 py-2 border-t border-gray-100 first:border-t-0";

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newPublic, setNewPublic] = useState(false);
  const [inviteEmail, setInviteEmail] = useState<Record<string, string>>({});
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/groups");
    if (res.ok) setGroups((await res.json()).groups);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    fetch("/api/profile/calendar-feed").then(r => r.json()).then(d => setToken(d.token ?? null)).catch(() => {});
  }, [load]);

  async function act(groupId: string, body: Record<string, string | boolean>) {
    setError("");
    const res = await fetch(`/api/groups/${groupId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!res.ok) setError((await res.json()).error ?? "Something went wrong.");
    await load();
    return res.ok;
  }

  async function invite(e: React.FormEvent, groupId: string) {
    e.preventDefault();
    const email = (inviteEmail[groupId] ?? "").trim();
    if (!email) return;
    if (await act(groupId, { action: "invite", email })) setInviteEmail(v => ({ ...v, [groupId]: "" }));
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/groups", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName, isPublic: newPublic }),
    });
    if (!res.ok) { setError((await res.json()).error ?? "Something went wrong."); return; }
    setNewName("");
    setNewPublic(false);
    await load();
  }

  async function feed(method: "POST" | "DELETE") {
    if (method === "POST" && token && !confirm("Replace the link? The old link will stop working everywhere it is used.")) return;
    if (method === "DELETE" && !confirm("Turn off the link? Calendars subscribed to it will stop updating.")) return;
    const res = await fetch("/api/profile/calendar-feed", { method });
    if (res.ok) setToken((await res.json()).token ?? null);
    setCopied(false);
  }

  const mine = groups.filter(g => g.myStatus === "APPROVED");
  const invitations = groups.filter(g => g.myStatus === "INVITED");
  const waiting = groups.filter(g => g.myStatus === "PENDING");
  const others = groups.filter(g => g.myStatus === "NONE");
  const toApprove = groups.filter(g => g.canManage && g.pending.length > 0);

  const feedPath = token ? `/api/feed/${token}/calendar.ics` : "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const httpsUrl = origin + feedPath;
  const webcalUrl = httpsUrl.replace(/^https?:/, "webcal:");

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold" style={navy}>Groups</h1>
        <p className="text-sm text-gray-500 mt-1">
          Events on a group&apos;s calendar are seen only by its members. You can see a group here if it is public,
          if you belong to it, or if one of its admins invited you.
        </p>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      {invitations.length > 0 && (
        <div className={card} style={{ borderTop: "4px solid var(--nd-gold)" }}>
          <h2 className="font-bold mb-3" style={navy}>You are invited</h2>
          {invitations.map(g => (
            <div key={g.id} className={row + " flex-wrap"}>
              <div className="text-sm min-w-0">
                <span className="font-semibold">{g.name}</span>
                <span className="text-xs text-gray-400"> · {g.memberCount} {g.memberCount === 1 ? "member" : "members"}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => act(g.id, { action: "accept" })} className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={navyBg}>Join</button>
                <button onClick={() => act(g.id, { action: "decline" })} className={smallBtn}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {toApprove.length > 0 && (
        <div className={card} style={{ borderTop: "4px solid var(--nd-gold)" }}>
          <h2 className="font-bold mb-3" style={navy}>Requests waiting for you</h2>
          {toApprove.map(g => g.pending.map(p => (
            <div key={g.id + p.userId} className={row + " flex-wrap"}>
              <div className="text-sm min-w-0">
                <span className="font-semibold">{p.name ?? p.email}</span>
                <span className="text-gray-500"> wants to join </span>
                <span className="font-semibold">{g.name}</span>
                <div className="text-xs text-gray-400 truncate">{p.email}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => act(g.id, { action: "approve", userId: p.userId })}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={navyBg}>Approve</button>
                <button onClick={() => act(g.id, { action: "deny", userId: p.userId })} className={smallBtn}>Deny</button>
              </div>
            </div>
          )))}
        </div>
      )}

      <div className={card}>
        <h2 className="font-bold mb-1" style={navy}>Your groups</h2>
        <p className="text-xs text-gray-500 mb-3">Pick the color each group&apos;s events show in on your calendar. Colors are yours alone.</p>
        {loaded && mine.length === 0 && <p className="text-sm text-gray-400">You are not in any group yet. Create one below, or ask a group&apos;s admin to invite you.</p>}
        {mine.map(g => (
          <div key={g.id} className="py-3 border-t border-gray-100 first:border-t-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                <span className="font-semibold text-sm truncate">{g.name}</span>
                {g.myRole === "ADMIN" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">ADMIN</span>}
                <span className={"text-[10px] font-bold px-1.5 py-0.5 rounded-full " + (g.isPublic ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600")}>
                  {g.isPublic ? "PUBLIC" : "PRIVATE"}
                </span>
              </div>
              <button onClick={() => { if (confirm(`Leave ${g.name}?`)) act(g.id, { action: "leave" }); }} className={smallBtn}>Leave</button>
            </div>

            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {GROUP_COLORS.map(c => (
                <button key={c} aria-label={`Use color ${c}`} onClick={() => act(g.id, { action: "color", color: c })}
                  className="w-7 h-7 rounded-full transition"
                  style={{ backgroundColor: c, outline: g.color.toLowerCase() === c.toLowerCase() ? "2px solid #111827" : "none", outlineOffset: 2 }} />
              ))}
              <label className="text-xs text-gray-500 flex items-center gap-1 ml-1">
                Custom
                <input type="color" value={g.color} onChange={e => act(g.id, { action: "color", color: e.target.value })}
                  className="w-7 h-7 p-0 border border-gray-300 rounded cursor-pointer bg-white" />
              </label>
            </div>

            <div className="mt-2 text-xs text-gray-500">
              {g.members.map((m, i) => (
                <span key={m.userId} className="inline-flex items-center gap-1 mr-2 mb-1">
                  {m.isMe ? "You" : m.name ?? "Member"}{m.role === "ADMIN" ? " (admin)" : ""}
                  {g.canManage && !m.isMe && (
                    <>
                      <button className="underline" onClick={() => act(g.id, { action: m.role === "ADMIN" ? "removeAdmin" : "makeAdmin", userId: m.userId })}>
                        {m.role === "ADMIN" ? "remove admin" : "make admin"}
                      </button>
                      <button className="underline text-red-500" onClick={() => { if (confirm(`Remove ${m.name ?? "this member"} from ${g.name}?`)) act(g.id, { action: "remove", userId: m.userId }); }}>
                        remove
                      </button>
                    </>
                  )}
                  {i < g.members.length - 1 ? "·" : ""}
                </span>
              ))}
            </div>

            {g.canManage && (
              <div className="mt-2 rounded-lg bg-gray-50 p-3 space-y-2">
                <form onSubmit={e => invite(e, g.id)} className="flex gap-2">
                  <input type="email" value={inviteEmail[g.id] ?? ""} onChange={e => setInviteEmail(v => ({ ...v, [g.id]: e.target.value }))}
                    placeholder="Invite someone by email"
                    className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none" />
                  <button type="submit" className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={navyBg}>Invite</button>
                </form>
                {g.invited.length > 0 && (
                  <div className="text-xs text-gray-500">
                    Invited, not yet joined:{" "}
                    {g.invited.map(email => (
                      <span key={email} className="inline-flex items-center gap-1 mr-2">
                        {email}
                        <button className="underline text-red-500" onClick={() => act(g.id, { action: "uninvite", email })}>cancel</button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400">
                  The invitation appears on this page when they sign in. If they have no account yet, it will be waiting when they register with that email. No email is sent.
                </p>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input type="checkbox" checked={g.isPublic} onChange={e => act(g.id, { action: "setPublic", isPublic: e.target.checked })} />
                  Public: anyone signed in can see this group and ask to join. Its events stay members-only.
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      {waiting.length > 0 && (
        <div className={card}>
          <h2 className="font-bold mb-3" style={navy}>Waiting for approval</h2>
          {waiting.map(g => (
            <div key={g.id} className={row}>
              <span className="text-sm font-semibold">{g.name}</span>
              <button onClick={() => act(g.id, { action: "leave" })} className={smallBtn}>Cancel request</button>
            </div>
          ))}
        </div>
      )}

      <div className={card}>
        <h2 className="font-bold mb-3" style={navy}>Public groups</h2>
        {loaded && others.length === 0 && <p className="text-sm text-gray-400">There are no public groups to join right now.</p>}
        {others.map(g => (
          <div key={g.id} className={row}>
            <div className="text-sm min-w-0">
              <span className="font-semibold">{g.name}</span>
              <span className="text-xs text-gray-400"> · {g.memberCount} {g.memberCount === 1 ? "member" : "members"}{g.isPublic ? "" : " · private"}</span>
            </div>
            <button onClick={() => act(g.id, { action: "join" })} className={smallBtn}>
              {g.memberCount === 0 ? "Join" : "Ask to join"}
            </button>
          </div>
        ))}
        <form onSubmit={createGroup} className="mt-4 pt-4 border-t border-gray-100 space-y-2">
          <div className="flex gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New group name, e.g. Book Club"
              className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            <button type="submit" disabled={newName.trim().length < 2}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40" style={navyBg}>
              Create
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={newPublic} onChange={e => setNewPublic(e.target.checked)} />
            Make it public. Leave unticked for an invitation-only group that others cannot see.
          </label>
        </form>
      </div>

      <div className={card}>
        <h2 className="font-bold mb-1" style={navy}>Subscribe from Outlook, Google or Apple Calendar</h2>
        <p className="text-sm text-gray-500 mb-3">
          A subscription link shows your portal calendar inside your own calendar app and keeps it up to date.
          It includes exactly the events you can see here. Anyone who has the link can read them, so share it only with yourself.
        </p>
        {!token ? (
          <button onClick={() => feed("POST")} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={navyBg}>
            Create my subscription link
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input readOnly value={httpsUrl} onFocus={e => e.target.select()}
                className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono bg-gray-50" />
              <button onClick={() => { navigator.clipboard.writeText(httpsUrl); setCopied(true); }} className={smallBtn}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <a href={webcalUrl} className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={navyBg}>
                Open in my calendar app
              </a>
              <a href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`} target="_blank" rel="noopener" className={smallBtn}>
                Add to Google Calendar
              </a>
              <button onClick={() => feed("POST")} className={smallBtn}>Replace link</button>
              <button onClick={() => feed("DELETE")} className={smallBtn + " text-red-500"}>Turn off</button>
            </div>
            <ul className="text-xs text-gray-500 space-y-1 list-disc pl-4">
              <li><strong>Outlook:</strong> Calendar, then Add calendar, then Subscribe from web, and paste the link.</li>
              <li><strong>Google Calendar:</strong> use the button above, or Other calendars, then +, then From URL, and paste the link.</li>
              <li><strong>iPhone, iPad or Mac:</strong> tap &quot;Open in my calendar app&quot;.</li>
              <li>Calendar apps check for changes on their own schedule, so new events can take a few hours to appear (Google can take a day).</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
