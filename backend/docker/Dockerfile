# Build context is the repo root (this Dockerfile lives in backend/docker/,
# so build with: docker build -f backend/docker/Dockerfile -t <tag> .

# --- build stage -----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src ./src
# `npm run build` itself copies db/migrations/*.sql into dist/ (see
# package.json — tsc alone only emits compiled .js, not the raw SQL
# migrate.js reads at runtime), so this stays a plain build with no
# Docker-specific special-casing.
RUN npm run build

# --- runtime stage -----------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
