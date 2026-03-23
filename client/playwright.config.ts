import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@playwright/test";

const configDir = fileURLToPath(new URL(".", import.meta.url));
const serverRoot = path.resolve(configDir, "../server");
const fixtureRoot = path.resolve(serverRoot, "tests/fixtures/scan_root");
const pythonExecutable = path.resolve(configDir, "../.venv/Scripts/python.exe");

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: `"${pythonExecutable}" scripts/start_e2e_server.py`,
      cwd: serverRoot,
      url: "http://127.0.0.1:8001/health",
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        PHOTO_ORGANIZER_DATABASE_URL: "sqlite:///./.tmp/e2e.db",
        PHOTO_ORGANIZER_GENERATED_MEDIA_ROOT: "./.tmp/e2e-media",
        PHOTO_ORGANIZER_SCAN_ROOTS: JSON.stringify([fixtureRoot]),
        PHOTO_ORGANIZER_CORS_ORIGINS: JSON.stringify(["http://127.0.0.1:4173"]),
        PHOTO_ORGANIZER_PREPARE_DEMO_SCAN_ROOT: "1",
        PHOTO_ORGANIZER_PORT: "8001",
        PHOTO_ORGANIZER_RESET_STATE: "1",
      },
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4173",
      cwd: configDir,
      url: "http://127.0.0.1:4173",
      reuseExistingServer: true,
      timeout: 120000,
      env: {
        VITE_API_BASE_URL: "http://127.0.0.1:8001",
      },
    },
  ],
});
