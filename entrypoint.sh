#!/usr/bin/env bash
set -euo pipefail

echo "[BOOT] entrypoint running. pwd=$(pwd)"
mkdir -p /app/secrets

KEY_PATH="/app/secrets/gen-lang-client-0412493534-def18059d5a5.json"

if [[ -n "${GCP_SERVICE_ACCOUNT_JSON:-}" ]]; then
  printf '%s' "$GCP_SERVICE_ACCOUNT_JSON" > "$KEY_PATH"
  echo "[BOOT] wrote GCP json to $KEY_PATH (bytes=$(wc -c < "$KEY_PATH"))"
else
  echo "[BOOT] GCP_SERVICE_ACCOUNT_JSON is EMPTY / missing"
fi

ls -la /app/secrets || true

exec npm run worker
