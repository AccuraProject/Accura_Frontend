
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 8080,
    allowedHosts: ['accura-frontend.azurewebsites.net','localhost', '127.0.0.1', '::1'],
  },
});