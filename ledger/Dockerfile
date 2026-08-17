FROM node:20-alpine AS base
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* tsconfig.base.json ./
COPY ledger/package.json ./ledger/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm install --workspace=@sixsync/ledger --include-workspace-root

COPY packages/shared ./packages/shared
COPY ledger ./ledger

WORKDIR /app/ledger
RUN npm run build

EXPOSE 4100
CMD ["node", "dist/index.js"]
