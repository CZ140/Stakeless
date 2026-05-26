# Single-origin image: builds the React SPA and serves it from the Express backend.
# Runs TypeScript directly with tsx (no compile step — sidesteps the shared package
# having no build output). Designed for a single always-on instance (the poker
# manager holds live hand state in memory and cannot be horizontally scaled).
FROM node:20-slim
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Optional: bake the Google sign-in client ID into the SPA at build time.
# Pass with `--build-arg VITE_GOOGLE_CLIENT_ID=...`; leave empty to hide the button.
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

# Install deps first (manifests only) for better layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# Copy the source, then build the SPA into the backend's static dir.
COPY . .
RUN pnpm --filter frontend build && cp -r apps/frontend/dist apps/backend/public

ENV NODE_ENV=production
EXPOSE 3000

# Apply migrations, then start. Safe for a single instance.
CMD ["sh", "-c", "pnpm --filter backend db:migrate && pnpm --filter backend start"]
