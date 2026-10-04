"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";

type NotifPref = "none" | "immediate" | "weekly" | "both";

const NOTIF_OPTIONS: { value: NotifPref; label: string; desc: string }[] = [
  { value: "none",      label: "None",           desc: "No email notifications" },
  { value: "immediate", label: "Immediate",       desc: "Email whenever a calendar item is added, changed, or deleted" },
  { value: "weekly",    label: "Weekly Summary",  desc: "One email every Sunday with a recap of the week's changes" },
  { value: "both",      label: "Both",            desc: "Immediate emails + weekly summary" },
];

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const user = session?.user as { id?: string; name?: string; email?: string; image?: string; emailNotifications?: string } | undefined;

  const [avatarSrc, setAvatarSrc] = useState(user?.image ?? null);
  const [uploading, setUploading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState("");
  const [notif, setNotif] = useState<NotifPref>((user?.emailNotifications as NotifPref) ?? "none");
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg, setNotifMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.image) setAvatarSrc(user.image);
    if (user?.emailNotifications) setNotif(user.emailNotifications as NotifPref);
  }, [user?.image, user?.emailNotifications]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setAvatarMsg("");
    const fd = new FormData();
    fd.append("avatar", file);
    const res = await fetch("/api/profile/avatar", { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) {
      const { imageUrl } = await res.json();
      setAvatarSrc(imageUrl + `?t=${Date.now()}`);
      setAvatarMsg("Profile picture updated!");
      await update();
    } else {
      const { error } = await res.json();
      setAvatarMsg(error ?? "Upload failed.");
    }
  }

  async function saveNotif() {
    setNotifSaving(true);
    setNotifMsg("");
    const res = await fetch("/api/profile/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailNotifications: notif }),
    });
    setNotifSaving(false);
    setNotifMsg(res.ok ? "Saved!" : "Failed to save.");
  }

  const initials = user?.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "?";

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--nd-navy)" }}>Settings</h1>

      {/* Avatar */}
      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--nd-navy)" }}>Profile Picture</h2>
        <div className="flex items-center gap-5">
          <div
            className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-2xl font-bold text-white shrink-0"
            style={{ backgroundColor: "var(--nd-navy)" }}
          >
            {avatarSrc ? (
              <Image src={avatarSrc} alt="Avatar" width={80} height={80} className="object-cover w-full h-full" unoptimized />
            ) : initials}
          </div>
          <div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition"
              style={{ backgroundColor: "var(--nd-navy)" }}
            >
              {uploading ? "Uploading…" : "Upload Photo"}
            </button>
            <p className="text-xs text-gray-400 mt-1">JPG, PNG or GIF · Max 5 MB</p>
            {avatarMsg && <p className="text-xs mt-1" style={{ color: avatarMsg.includes("!") ? "green" : "red" }}>{avatarMsg}</p>}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
        </div>
      </div>

      {/* Email notifications */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--nd-navy)" }}>Email Notifications</h2>
        <p className="text-sm text-gray-500 mb-4">Get notified when tagged calendar items change.</p>
        <div className="space-y-2 mb-4">
          {NOTIF_OPTIONS.map(opt => (
            <label
              key={opt.value}
              className="flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition"
              style={{ borderColor: notif === opt.value ? "var(--nd-navy)" : "#e5e7eb", backgroundColor: notif === opt.value ? "#f0f4ff" : "white" }}
            >
              <input
                type="radio"
                name="notif"
                value={opt.value}
                checked={notif === opt.value}
                onChange={() => setNotif(opt.value)}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--nd-navy)" }}>{opt.label}</div>
                <div className="text-xs text-gray-500">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
        <button
          onClick={saveNotif}
          disabled={notifSaving}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition"
          style={{ backgroundColor: "var(--nd-navy)" }}
        >
          {notifSaving ? "Saving…" : "Save Preferences"}
        </button>
        {notifMsg && <span className="ml-3 text-sm" style={{ color: notifMsg === "Saved!" ? "green" : "red" }}>{notifMsg}</span>}

        {!process.env.NEXT_PUBLIC_EMAIL_CONFIGURED && (
          <p className="mt-4 text-xs text-amber-600 bg-amber-50 rounded-lg p-3">
            ⚠️ Email delivery requires SMTP configuration in your <code>.env</code> file
            (SMTP_HOST, SMTP_USER, SMTP_PASS). Preferences are saved but emails won&apos;t send until configured.
          </p>
        )}
      </div>
    </div>
  );
}
