/**
 * Google Sign-In service — verifies Google ID tokens from the frontend.
 *
 * FEATURE FLAG: This entire module is gated on GOOGLE_SIGNIN_ENABLED=true in .env.
 * When the flag is off, this file exports null and the route is never registered.
 *
 * Flow: frontend uses Google Identity Services to get an idToken, sends it to
 * POST /api/auth/google. This backend verifies the token — it never redirects
 * to Google's OAuth consent screen.
 *
 * Requires: GOOGLE_CLIENT_ID in .env
 */

import { OAuth2Client } from "google-auth-library";

let googleClient = null;

const getClient = () => {
  if (googleClient) return googleClient;
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not set in .env");
  }
  googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  return googleClient;
};

/**
 * Verify a Google ID token and extract user payload.
 *
 * @param {string} idToken - The ID token from the frontend Google Sign-In
 * @returns {{ email, name, sub, email_verified }}
 */
export const verifyGoogleIdToken = async (idToken) => {
  const client = getClient();

  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  return {
    email: payload.email,
    name: payload.name,
    sub: payload.sub,           // Google's unique user ID
    email_verified: payload.email_verified,
  };
};
