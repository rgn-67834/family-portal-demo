import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT ?? "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export type EventChangeType = "created" | "updated" | "deleted";

interface EventInfo {
  title: string;
  type: string;
  startDate: Date;
  location?: string | null;
  changedBy: string;
}

export async function notifyEventChange(
  eventInfo: EventInfo,
  attendeeUserIds: string[],
  changeType: EventChangeType
) {
  if (!process.env.SMTP_HOST) return; // email not configured

  const users = await prisma.user.findMany({
    where: {
      id: { in: attendeeUserIds },
      emailNotifications: { in: ["immediate", "both"] },
    },
    select: { email: true, name: true },
  });

  if (!users.length) return;

  const actionLabel = changeType === "created" ? "added" : changeType === "updated" ? "updated" : "deleted";
  const dateStr = eventInfo.startDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
      <div style="background:#0C2340;padding:16px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#C99700;margin:0">Family Portal</h2>
      </div>
      <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
        <p style="margin:0 0 12px">A calendar item was <strong>${actionLabel}</strong> by ${eventInfo.changedBy}:</p>
        <div style="background:white;border-left:4px solid #C99700;padding:12px 16px;border-radius:4px">
          <p style="margin:0;font-size:18px;font-weight:bold;color:#0C2340">${eventInfo.title}</p>
          <p style="margin:4px 0 0;color:#6b7280">${dateStr}</p>
          ${eventInfo.location ? `<p style="margin:4px 0 0;color:#6b7280">📍 ${eventInfo.location}</p>` : ""}
        </div>
        <p style="margin:16px 0 0;font-size:12px;color:#9ca3af">
          You're receiving this because you're tagged on this event.
          Update your notification preferences in Family Portal settings.
        </p>
      </div>
    </div>
  `;

  await Promise.all(
    users.map(u =>
      transporter.sendMail({
        from: `"Family Portal" <${process.env.SMTP_USER}>`,
        to: u.email,
        subject: `Family Calendar: "${eventInfo.title}" was ${actionLabel}`,
        html,
      }).catch(err => console.error("Email send failed:", err))
    )
  );
}

export async function sendPasswordResetEmail(email: string, name: string | null, token: string) {
  if (!process.env.SMTP_HOST) return;
  const url = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
      <div style="background:#0C2340;padding:16px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#C99700;margin:0">Family Portal</h2>
      </div>
      <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
        <p>Hi ${name ?? "there"},</p>
        <p>Someone requested a password reset for your Family Portal account. Click below to set a new password:</p>
        <div style="text-align:center;margin:24px 0">
          <a href="${url}" style="background:#0C2340;color:#C99700;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">
            Reset My Password
          </a>
        </div>
        <p style="color:#6b7280;font-size:13px">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      </div>
    </div>
  `;
  await transporter.sendMail({
    from: `"Family Portal" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Family Portal — Password Reset",
    html,
  });
}

export async function sendTempPasswordEmail(email: string, name: string | null, tempPassword: string) {
  if (!process.env.SMTP_HOST) return;
  const loginUrl = `${process.env.NEXTAUTH_URL}/login`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
      <div style="background:#0C2340;padding:16px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#C99700;margin:0">Family Portal</h2>
      </div>
      <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
        <p>Hi ${name ?? "there"},</p>
        <p>Your password has been reset by an admin. Use the temporary password below to sign in — you'll be asked to set a new one immediately.</p>
        <div style="background:white;border-left:4px solid #C99700;padding:12px 16px;border-radius:4px;margin:16px 0">
          <p style="margin:0;font-size:20px;font-family:monospace;color:#0C2340;letter-spacing:2px">${tempPassword}</p>
        </div>
        <div style="text-align:center;margin:24px 0">
          <a href="${loginUrl}" style="background:#0C2340;color:#C99700;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">
            Sign In to Family Portal
          </a>
        </div>
        <p style="color:#6b7280;font-size:13px">This temporary password can only be used once.</p>
      </div>
    </div>
  `;
  await transporter.sendMail({
    from: `"Family Portal" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Family Portal — Your Temporary Password",
    html,
  });
}
