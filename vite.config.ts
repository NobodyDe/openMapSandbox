import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // MapLibre v6 carrega o worker a partir da própria pasta; se o Vite o copiar
  // para o cache (.vite/deps), o worker não é encontrado e as ruas e cidades somem.
  optimizeDeps: {
    exclude: ["maplibre-gl"],
  },
});
