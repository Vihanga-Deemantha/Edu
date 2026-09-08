import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env") });

import connectDB from "./config/db.js";
import app from "./app.js";

const PORT = process.env.PORT || 5000;

const start = async () => {
  // Connect to DB first — fail fast if DB is unreachable
  await connectDB();

  // Only start accepting requests after DB is connected
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
};

start();
