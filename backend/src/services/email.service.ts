import nodemailer from "nodemailer";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

const transporter = nodemailer.createTransport({
  host: config.BREVO_SMTP_HOST,
  port: config.BREVO_SMTP_PORT,
  secure: false, // Brevo uses STARTTLS on 587
  auth: {
    user: config.BREVO_SMTP_USER,
    pass: config.BREVO_SMTP_PASS,
  },
});

// Verify SMTP connection on startup
transporter.verify((err) => {
  if (err) {
    logger.error("SMTP connection failed", { message: err.message });
  } else {
    logger.info("SMTP ready — Brevo connected");
  }
});

// ─── Types ─────────────────────────────────────────────────────────────
type DBMessage = {
  role: string;
  content: string;
  createdAt: Date;
};

// ─── HTML Builders ─────────────────────────────────────────────────────
function transcriptHTML(messages: DBMessage[]): string {
  const rows = messages
    .filter((m) => m.role !== "SYSTEM")
    .map((m) => {
      const label =
        m.role === "USER" ? "You" : m.role === "AI" ? "AI Bot" : "Support Agent";
      const color =
        m.role === "USER" ? "#185FA5" : m.role === "AI" ? "#534AB7" : "#0F6E56";
      const time = new Date(m.createdAt).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `
        <tr>
          <td style="padding:10px 14px;color:${color};font-weight:600;white-space:nowrap;width:110px;vertical-align:top">${label}</td>
          <td style="padding:10px 14px;color:#2C2C2A;line-height:1.5">${m.content}</td>
          <td style="padding:10px 14px;color:#888780;font-size:12px;white-space:nowrap;vertical-align:top">${time}</td>
        </tr>`;
    })
    .join("");

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:620px;margin:0 auto;padding:24px">
    <div style="background:#185FA5;padding:24px;border-radius:12px 12px 0 0">
      <h1 style="margin:0;color:#fff;font-size:20px">Your Support Chat Transcript</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px">Here is your conversation with our support team.</p>
    </div>
    <div style="border:1px solid #D3D1C7;border-top:none;border-radius:0 0 12px 12px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse;background:#FAFAF9">
        <thead>
          <tr style="background:#F1EFE8;border-bottom:1px solid #D3D1C7">
            <th style="padding:10px 14px;text-align:left;color:#5F5E5A;font-size:12px;font-weight:600;text-transform:uppercase">From</th>
            <th style="padding:10px 14px;text-align:left;color:#5F5E5A;font-size:12px;font-weight:600;text-transform:uppercase">Message</th>
            <th style="padding:10px 14px;text-align:left;color:#5F5E5A;font-size:12px;font-weight:600;text-transform:uppercase">Time</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p style="color:#888780;font-size:12px;text-align:center;margin-top:20px">
      Thank you for contacting us. Reply to this email if you need further help.
    </p>
  </div>`;
}

function csatHTML(sessionId: string): string {
  const base = config.FRONTEND_URL;
  const ratings = [1, 2, 3, 4, 5]
    .map((n) => {
      const stars = "★".repeat(n) + "☆".repeat(5 - n);
      const colors = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#27ae60"];
      return `
        <a href="${base}/csat/${sessionId}/${n}"
          style="display:inline-block;margin:6px;padding:12px 18px;
                 background:${colors[n - 1]}20;color:${colors[n - 1]};
                 border:2px solid ${colors[n - 1]};border-radius:10px;
                 text-decoration:none;font-size:20px;font-weight:500">
          ${stars}
        </a>`;
    })
    .join("");

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:500px;margin:0 auto;padding:24px;text-align:center">
    <div style="background:#185FA5;padding:24px;border-radius:12px 12px 0 0">
      <h1 style="margin:0;color:#fff;font-size:20px">How was your experience?</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px">Your feedback helps us improve.</p>
    </div>
    <div style="border:1px solid #D3D1C7;border-top:none;border-radius:0 0 12px 12px;padding:32px">
      <p style="color:#5F5E5A;margin:0 0 20px">Click a rating to submit — it only takes a second.</p>
      <div>${ratings}</div>
      <p style="color:#888780;font-size:12px;margin-top:24px">
        This link expires in 7 days.
      </p>
    </div>
  </div>`;
}

function agentAlertHTML(agentName: string, sessionId: string, lastMessage: string): string {
  const dashboardUrl = `${config.FRONTEND_URL}/agent`;
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:500px;margin:0 auto;padding:24px">
    <div style="background:#0F6E56;padding:24px;border-radius:12px 12px 0 0">
      <h1 style="margin:0;color:#fff;font-size:20px">New Chat Assigned</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px">Hi ${agentName}, a user needs your help.</p>
    </div>
    <div style="border:1px solid #D3D1C7;border-top:none;border-radius:0 0 12px 12px;padding:24px">
      <p style="color:#5F5E5A;font-size:14px;margin:0 0 12px">Last message from user:</p>
      <div style="background:#E1F5EE;border-left:4px solid #0F6E56;padding:14px 16px;border-radius:0 8px 8px 0;margin-bottom:24px">
        <p style="margin:0;color:#085041;font-style:italic;line-height:1.5">"${lastMessage}"</p>
      </div>
      <a href="${dashboardUrl}"
        style="display:inline-block;padding:13px 28px;background:#0F6E56;color:#fff;
               border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
        Open Agent Dashboard →
      </a>
    </div>
  </div>`;
}

// ─── Exported functions ─────────────────────────────────────────────────

export async function sendTranscriptEmail(
  toEmail: string,
  toName: string,
  messages: DBMessage[]
): Promise<void> {
  try {
    await transporter.sendMail({
      from: `"${config.FROM_NAME}" <${config.FROM_EMAIL}>`,
      to: `"${toName}" <${toEmail}>`,
      subject: "Your support chat transcript",
      html: transcriptHTML(messages),
    });
    logger.info("Transcript email sent", { toEmail });
  } catch (err) {
    logger.error("Failed to send transcript email", { err });
  }
}

export async function sendCSATEmail(
  toEmail: string,
  toName: string,
  sessionId: string
): Promise<void> {
  try {
    await transporter.sendMail({
      from: `"${config.FROM_NAME}" <${config.FROM_EMAIL}>`,
      to: `"${toName}" <${toEmail}>`,
      subject: "Rate your support experience",
      html: csatHTML(sessionId),
    });
    logger.info("CSAT email sent", { toEmail, sessionId });
  } catch (err) {
    logger.error("Failed to send CSAT email", { err });
  }
}

export async function sendAgentAssignedEmail(
  agentEmail: string,
  agentName: string,
  sessionId: string,
  lastMessage: string
): Promise<void> {
  try {
    await transporter.sendMail({
      from: `"${config.FROM_NAME}" <${config.FROM_EMAIL}>`,
      to: `"${agentName}" <${agentEmail}>`,
      subject: "New chat assigned to you",
      html: agentAlertHTML(agentName, sessionId, lastMessage),
    });
    logger.info("Agent alert email sent", { agentEmail, sessionId });
  } catch (err) {
    logger.error("Failed to send agent alert email", { err });
  }
}
