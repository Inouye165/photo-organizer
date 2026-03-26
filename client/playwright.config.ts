import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@playwright/test";

const configDir = fileURLToPath(new URL(".", import.meta.url));
const serverRoot = path.resolve(configDir, "../server");
const fixtureRoot = path.resolve(serverRoot, "tests/fixtures/scan_root");
const pythonExecutable = path.resolve(configDir, "../.venv/Scripts/python.exe");
const backendPort = process.env.PHOTO_ORGANIZER_E2E_BACKEND_PORT ?? "8001";
const frontendPort = process.env.PHOTO_ORGANIZER_E2E_FRONTEND_PORT ?? "4173";
const backendBaseUrl = `http://127.0.0.1:${backendPort}`;
const frontendBaseUrl = `http://127.0.0.1:${frontendPort}`;

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: frontendBaseUrl,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: `"${pythonExecutable}" scripts/start_e2e_server.py`,
      cwd: serverRoot,
      url: `${backendBaseUrl}/health`,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        PHOTO_ORGANIZER_DATABASE_URL: "sqlite:///./.tmp/e2e.db",
        PHOTO_ORGANIZER_GENERATED_MEDIA_ROOT: "./.tmp/e2e-media",
        PHOTO_ORGANIZER_SCAN_ROOTS: JSON.stringify([fixtureRoot]),
        PHOTO_ORGANIZER_CORS_ORIGINS: JSON.stringify([frontendBaseUrl]),
        PHOTO_ORGANIZER_PREPARE_DEMO_SCAN_ROOT: "1",
        PHOTO_ORGANIZER_PORT: backendPort,
        PHOTO_ORGANIZER_RESET_STATE: "1",
      },
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort}`,
      cwd: configDir,
      url: frontendBaseUrl,
      reuseExistingServer: true,
      timeout: 120000,
      env: {
        VITE_API_BASE_URL: backendBaseUrl,
      },
    },
  ],
});
