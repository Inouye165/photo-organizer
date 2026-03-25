import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config";

export default defineConfig((env) =>
  mergeConfig(
    typeof viteConfig === "function" ? viteConfig(env) : viteConfig,
    {
      test: {
        environment: "jsdom",
        setupFiles: "./src/test/setup.ts",
        globals: true,
        css: true,
        exclude: ["e2e/**", "node_modules/**", "dist/**"],
      },
    },
  ),
);
