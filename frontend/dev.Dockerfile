FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY src ./src
# COPY public ./public
COPY next.config.ts .
COPY tsconfig.json .
COPY postcss.config.mjs .
COPY eslint.config.mjs .
COPY types.d.ts .

ENV NEXT_TELEMETRY_DISABLED=1

CMD ["npm", "run", "dev"]