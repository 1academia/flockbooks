import { defineConfig } from "vitest/config";
import path from "path";

// Unit tests only — pure business logic (date/week/month math, role
// permissions, authorization checks) that doesn't need a real database.
// Anything that touches Supabase belongs in a separate integration suite
// against a staging project, not here (see TESTING.md).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
