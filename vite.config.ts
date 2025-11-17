import { defineConfig } from 'vite';
import angular from '@angular-devkit/build-angular/plugins/vite';

const allowedHosts = ['localhost', '127.0.0.1', '::1', 'accura-frontend.azurewebsites.net'];

export default defineConfig(() => ({
  plugins: [angular()],
  server: {
    allowedHosts
  }
}));
