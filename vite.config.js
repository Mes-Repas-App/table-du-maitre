import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./", // chemins relatifs : le site marche à la racine comme dans un sous-dossier (GitHub Pages)
  plugins: [react(), tailwindcss()],
});
