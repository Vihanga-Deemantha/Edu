import twilio from "twilio";

/**
 * SMS service — sends transactional SMS via Twilio.
 *
 * Provider-agnostic interface: only `sendSms(phone, message)` is exported.
 * To swap providers later (Notify.lk, Dialog), replace only the internals of
 * this file — the rest of the codebase never calls Twilio directly.
 *
 * When SMS_API_KEY is not configured (local dev without credentials),
 * falls back to console logging so the app doesn't crash.
 *
 * To configure for real: set SMS_API_KEY (Twilio Account SID),
 * SMS_API_SECRET (Twilio Auth Token), and SMS_SENDER_ID (your Twilio number)
 * in your .env file.
 */

let twilioClient = null;

const getClient = () => {
  if (twilioClient) return twilioClient;

  if (!process.env.SMS_API_KEY || !process.env.SMS_API_SECRET) {
    return null;
  }

  twilioClient = twilio(process.env.SMS_API_KEY, process.env.SMS_API_SECRET);
  return twilioClient;
};

/**
 * Send an SMS message.
 *
 * @param {string} phone   - Recipient phone number (E.164 format preferred: +94XXXXXXXXX)
 * @param {string} message - SMS body text
 */
export const sendSms = async (phone, message) => {
  const client = getClient();

  if (!client) {
    // Dev fallback — log to console instead of sending
    console.log("\n📱 [SMS - DEV MODE - not sent]");
    console.log(`   To      : ${phone}`);
    console.log(`   Message : ${message}`);
    console.log("");
    return;
  }

  await client.messages.create({
    body: message,
    from: process.env.SMS_SENDER_ID, // your Twilio phone number
    to: phone,
  });
};

/**
 * Pre-built OTP SMS message.
 */
export const sendOtpSms = async ({ phone, code, purpose }) => {
  const purposeLabel = {
    signup: "verify your phone",
    login: "log in",
    password_reset: "reset your password",
  }[purpose] || "verify your identity";

  await sendSms(
    phone,
    `Your EduHub code to ${purposeLabel}: ${code}. Valid for 10 minutes. Do not share this code.`
  );
};
