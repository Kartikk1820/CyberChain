FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY frontend/package.json ./frontend/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm install --workspace=@sixsync/frontend --include-workspace-root

COPY packages/shared ./packages/shared
RUN npm run build --workspace=@sixsync/shared

COPY frontend ./frontend

ARG VITE_API_URL=http://localhost:4000
ARG VITE_WS_URL=ws://localhost:4000/ws
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

WORKDIR /app/frontend
RUN npm run build

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
