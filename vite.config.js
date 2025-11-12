// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    tailwindcss(),
  ],

  // Important: ton caller utilise import.meta.env.VITE_API_URL (mets VITE_API_URL=/api en dev)
  server: {
    host: true,        // accessible sur le LAN si besoin
    port: 5173,
    strictPort: true,
    open: false,       // passe à true si tu veux ouvrir le navigateur auto
    hmr: { overlay: true },

    proxy: {
      // API Platform & endpoints protégés
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        ws: false,
        // pas de rewrite: on garde /api tel quel
        // headers utiles pour certains middlewares/Symfony dev server
        headers: { 'X-Forwarded-Proto': 'http', 'X-Forwarded-Host': 'localhost:5173' },
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            const loc = proxyRes.headers['location'];
            if (loc && typeof loc === 'string' && loc.startsWith('http://localhost:8000/')) {
              // Réécrit les redirections absolues vers l'origine Vite pour éviter le CORS
              proxyRes.headers['location'] = loc.replace('http://localhost:8000', '');
            }
          });
          // Intercepter les requêtes pour éviter les redirections 301
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Forcer l'URL sans slash final pour éviter les redirections
            if (req.url.endsWith('/') && req.url !== '/api/') {
              req.url = req.url.slice(0, -1);
            }
          });
        },
      },
      // Auth (login_check, refresh, etc.)
      '/auth': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        ws: false,
        headers: { 'X-Forwarded-Proto': 'http', 'X-Forwarded-Host': 'localhost:5173' },
      },
      // (optionnel) si tu sers des fichiers uploadés depuis Symfony
      // '/uploads': {
      //   target: 'http://localhost:8000',
      //   changeOrigin: true,
      //   secure: false,
      // },
      // (optionnel) Mercure en dev
      // '/.well-known/mercure': {
      //   target: 'http://localhost:3000',
      //   changeOrigin: true,
      //   ws: true
      // }
    },
  },

  // (optionnel) structure build propre
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
