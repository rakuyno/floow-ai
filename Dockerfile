FROM node:20-bookworm

# ffmpeg para render de vídeo
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala deps
COPY package*.json ./
RUN npm ci

# Copia el resto
COPY . .

# Build (si tu worker usa ts-node puede no ser necesario, pero mejor compilar si tienes build)
# Si esto falla, lo quitamos luego
RUN npm run build || echo "build skipped"

# Comando del worker
CMD ["bash", "-lc", "mkdir -p /app/secrets && if [ -n \"$GCP_SERVICE_ACCOUNT_JSON\" ]; then echo \"$GCP_SERVICE_ACCOUNT_JSON\" > /app/secrets/gen-lang-client-0412493534-def18059d5a5.json; fi && npm run worker"]

