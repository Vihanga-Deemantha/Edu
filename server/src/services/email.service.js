import nodemailer from "nodemailer";

/**
 * Email service — sends transactional emails via Nodemailer (Gmail SMTP).
 *
 * When SMTP_HOST is not configured (local dev without credentials),
 * falls back to console logging so the app doesn't crash.
 *
 * To configure for real: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
 * and SMTP_FROM in your .env file.
 */

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
