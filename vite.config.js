import {defineConfig} from 'vite';
import {resolve} from 'node:path';
export default defineConfig({
  base:'./',
  server:{host:'0.0.0.0'},
  preview:{host:'0.0.0.0'},
  build:{rollupOptions:{input:{city:resolve('index.html'),city3d:resolve('3d.html'),legacy:resolve('legacy.html')}}}
});
