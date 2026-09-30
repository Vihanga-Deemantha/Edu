# Production image for the EduHub API. The same image also runs the
# notification worker — only the command differs (see README below).
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN useradd --system --create-home appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 5067
CMD ["node", "src/server.js"]

# ── Running the worker ───────────────────────────────────────────────────────
# The BullMQ notification worker must run as a SEPARATE, always-on process
# from the API server — it is not started automatically by src/server.js.
# Build this same image once, then run two containers/processes from it:
#   docker run <image>                      # API server (default CMD above)
#   docker run <image> node src/worker.js   # notification worker
