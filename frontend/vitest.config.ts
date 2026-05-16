import { defineConfig } from "vitest/config";
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    tsconfigPaths()
  ],
  test: {
    include: ['src/**/__tests__/**/*.{js,ts,jsx,tsx}'],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      all: true,
      include: ["src/**/*.{js,ts,jsx,tsx}"],
      exclude: ["src/**/*.msw.ts", "src/**/*.d.ts"],
    },
  },
});
