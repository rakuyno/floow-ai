FROM node:20-bookworm

# ffmpeg para render de vídeo
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala deps
COPY package*.json ./
RUN npm ci

# Copia el resto del repo
COPY . .

# Build (si tienes build; si no, no pasa nada)
RUN npm run build || echo "build skipped"

# Entrypoint que crea /app/secrets y escribe el JSON
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
