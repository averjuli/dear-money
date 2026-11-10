# Production image: the Next.js standalone server plus bundled migrate and seed scripts.
# Built by .github/workflows/deploy.yml, run on the server by deploy/compose.yaml.
# Secrets and real data never enter it: see .dockerignore.

FROM node:24.22.2-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# The pnpm version from packageManager in package.json
RUN npm install -g "$(node -p 'require("./package.json").packageManager')" \
 && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
# One file per script with every dependency inlined: the runtime image has no full node_modules
RUN pnpm exec esbuild src/db/migrate.ts src/db/seed-cli.ts \
      --bundle --platform=node --format=esm --target=node24 \
      --outdir=dist-scripts --out-extension:.js=.mjs

FROM node:24.22.2-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/dist-scripts ./scripts
# Fictional test data for `dear-money-deploy seed`
COPY --from=build /app/data/sample-seed.json ./data/sample-seed.json

# Commit this image was built from; dear-money-deploy checks it before starting the image
ARG APP_VERSION=dev
LABEL org.opencontainers.image.revision=$APP_VERSION

USER node
EXPOSE 3000
CMD ["node", "server.js"]
