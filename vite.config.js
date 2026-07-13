import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // sockjs-client still references Node's `global`; map it to the browser global.
  define: { global: "globalThis" },
  plugins: [react()],
  server: {
    port: 5173,
    host: "0.0.0.0"
  }
});
