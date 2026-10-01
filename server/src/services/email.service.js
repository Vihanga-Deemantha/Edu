import nodemailer from "nodemailer";

/**
 * Email service — sends transactional email via Brevo's HTTP API when
 * BREVO_API_KEY is set, Nodemailer/SMTP otherwise, or logs to console if
 * neither is configured.
 *
 * Why two delivery paths: several free-tier hosts (Render among them, since
 * September 2025) block outbound traffic to SMTP ports 25/465/587 entirely
 * to stop spam abuse of free compute — a connection to ANY SMTP host,
 * Gmail or otherwise, just hangs until it times out. Brevo's HTTP API sends
 * the same email as a plain HTTPS POST on port 443 instead, which no such
 * policy blocks (blocking 443 would break the host entirely). Nodemailer
 * stays as the path for hosts that don't block SMTP (e.g. local dev).
 *
 * Priority: BREVO_API_KEY (HTTP API) > SMTP_HOST (Nodemailer) > console-log.
 */

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

/** Splits "Name <email@x.com>" into parts; Brevo's API wants them separate. */
const parseFrom = (raw) => {
  const fallback = { name: "EduHub", email: "no-reply@eduhub.lk" };
  if (!raw) return fallback;
  const match = raw.match(/^\s*(.*?)\s*<(.+)>\s*$/);
  if (match) return { name: match[1] || fallback.name, email: match[2] };
  return { name: fallback.name, email: raw.trim() };
};

const sendViaBrevoApi = async ({ to, subject, html, text }) => {
  const { name, email } = parseFrom(process.env.SMTP_FROM);
  const res = await fetch(BREVO_SEND_URL, {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name, email },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text || html.replace(/<[^>]+>/g, ""),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo API send failed (${res.status}): ${body}`);
  }
};

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST) {
    // No credentials configured — return null so callers use the log fallback
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465, // true for port 465 (SSL)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

/**
 * Send a transactional email.
 *
 * @param {object} options
 * @param {string} options.to      - Recipient email address
 * @param {string} options.subject - Email subject line
 * @param {string} options.html    - HTML body
 * @param {string} [options.text]  - Plain-text fallback (auto-generated if omitted)
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  if (process.env.BREVO_API_KEY) {
    await sendViaBrevoApi({ to, subject, html, text });
    return;
  }

  const mail = getTransporter();

  if (!mail) {
    // Dev fallback — log to console instead of sending
    console.log("\n📧 [EMAIL - DEV MODE - not sent]");
    console.log(`   To      : ${to}`);
    console.log(`   Subject : ${subject}`);
    console.log(`   Body    : ${text || html}`);
    console.log("");
    return;
  }

  await mail.sendMail({
    from: process.env.SMTP_FROM || "EduHub <no-reply@eduhub.lk>",
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ""), // strip tags for plain-text version
  });
};

/**
 * Pre-built OTP email template.
 */
export const sendOtpEmail = async ({ to, code, purpose }) => {
  const purposeLabel = {
    signup: "verify your email address",
    login: "log in to your account",
    password_reset: "reset your password",
  }[purpose] || "verify your identity";

  await sendEmail({
    to,
    subject: `Your EduHub verification code: ${code}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
        <h2 style="color: #4f46e5;">EduHub Verification</h2>
        <p>Use the code below to ${purposeLabel}. It expires in <strong>10 minutes</strong>.</p>
        <div style="
          font-size: 2rem;
          font-weight: bold;
          letter-spacing: 0.3em;
          background: #f3f4f6;
          border-radius: 8px;
          padding: 16px 24px;
          text-align: center;
          color: #111827;
          margin: 24px 0;
        ">${code}</div>
        <p style="color: #6b7280; font-size: 0.875rem;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
};
