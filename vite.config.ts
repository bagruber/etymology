import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Surface the VITE_DATA shell variable to client code so the data-source
  // toggle in src/data/dataset.ts works (e.g. `VITE_DATA=generated npm run dev`).
  define: {
    "import.meta.env.VITE_DATA": JSON.stringify(process.env.VITE_DATA ?? ""),
  },
});
