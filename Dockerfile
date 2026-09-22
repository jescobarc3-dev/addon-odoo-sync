# ─── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Capa cacheada: solo se reinstala si package.json / package-lock.json cambian
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Eliminar devDependencies in-place — más rápido que reinstalar en runner
RUN npm prune --omit=dev

# pdfjs-dist solo necesita 2 archivos .mjs en runtime; el resto (~100 MB) sobra.
RUN mkdir -p /pdfjs-slim/legacy/build && \
    cp node_modules/pdfjs-dist/package.json /pdfjs-slim/ && \
    cp node_modules/pdfjs-dist/legacy/build/pdf.mjs /pdfjs-slim/legacy/build/ && \
    cp node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs /pdfjs-slim/legacy/build/

# ─── Stage 2: runner ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Copiar node_modules ya depurados del builder (sin devDeps, sin segundo npm ci)
COPY --from=builder /app/node_modules ./node_modules
# Reemplazar pdfjs-dist gordo por solo los 2 archivos runtime
COPY --from=builder /pdfjs-slim ./node_modules/pdfjs-dist

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/main"]
