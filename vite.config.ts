import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function localApiMiddlewarePlugin(): Plugin {
  return {
    name: 'ccdv-f-local-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api')) {
          return next();
        }
        try {
          const mod = await server.ssrLoadModule('/api/index.ts');
          await mod.default(req, res);
        } catch (err) {
          console.error('API Middleware Error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              ok: false,
              error: err instanceof Error ? err.message : 'Internal Server Error',
            })
          );
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localApiMiddlewarePlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('questions.json')) {
            return 'question-bank';
          }
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
  },
});
