FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL
ARG VITE_AUTH_USERNAME
ARG VITE_AUTH_PASSWORD
ARG VITE_BASE_URL=/
RUN npm run build


FROM node:22-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 5190
CMD ["serve", "-s", "dist", "-l", "5190"]
