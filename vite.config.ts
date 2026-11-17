import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3333,
    strictPort: true,
    // Servidor de conversão (pasta server/). Mesma origem para o navegador: sem CORS
    proxy: { "/api": "http://localhost:3334" },
  },
  preview: {
    port: 3333,
  },
  // MapLibre v6 carrega o worker a partir da própria pasta; se o Vite o copiar
  // para o cache (.vite/deps), o worker não é encontrado e as ruas e cidades somem.
  optimizeDeps: {
    exclude: ["maplibre-gl"],
  },
});
