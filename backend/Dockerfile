FROM node:20-alpine AS base
WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json* tsconfig.base.json ./
COPY backend/package.json ./backend/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm install --workspace=@sixsync/backend --include-workspace-root

COPY packages/shared ./packages/shared
RUN npm run build --workspace=@sixsync/shared

COPY backend ./backend

WORKDIR /app/backend
RUN if [ -f prisma/schema.prisma ]; then npx prisma generate; fi
RUN npm run build

EXPOSE 4000
CMD ["sh", "-c", "if [ -f prisma/schema.prisma ]; then npx prisma migrate deploy && npx prisma db seed; fi && node dist/index.js"]
