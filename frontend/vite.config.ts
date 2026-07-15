import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// LOCAL:      VITE_BACKEND_URL is empty → proxy handles /api and /socket.io
// PRODUCTION: VITE_BACKEND_URL=https://your-app.up.railway.app → direct calls

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // needed for Docker
    proxy: {
      // Only active in local dev (when VITE_BACKEND_URL is not set)
      
      "/api": {
        target: "http://backend:4000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://backend:4000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap:false,
  },
});
