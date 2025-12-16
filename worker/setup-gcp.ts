import fs from "fs";
import path from "path";

export function setupGCP() {
  const gcpJson = process.env.GCP_SERVICE_ACCOUNT_JSON;

  if (!gcpJson) {
    console.warn("[GCP] No GCP_SERVICE_ACCOUNT_JSON found");
    return;
  }

  const secretsDir = path.join(process.cwd(), "secrets");
  if (!fs.existsSync(secretsDir)) {
    fs.mkdirSync(secretsDir, { recursive: true });
  }

  const keyPath = path.join(
    secretsDir,
    "gen-lang-client-0412493534-def18059d5a5.json"
  );

  if (!fs.existsSync(keyPath)) {
    fs.writeFileSync(keyPath, gcpJson);
    console.log("[GCP] Service account written to", keyPath);
  }

  process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
}
