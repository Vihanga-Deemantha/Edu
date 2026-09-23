import Stripe from "stripe";

/**
 * A function (not a module-level constant) so the env-var read happens at
 * first real use, not at import time — the same ESM import-hoisting problem
 * corsOriginCheck.js's own comment documents (a static top-level `new
 * Stripe(process.env.STRIPE_SECRET_KEY)` would run before server.js's
 * dotenv.config() has populated process.env, and cache `undefined` forever).
 */
let client = null;
export const getStripeClient = () => {
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return client;
};
