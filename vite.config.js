import { defineConfig } from 'vite';
import {resolve} from 'node:path';
const proxy={'/api':{target:'http://127.0.0.1:'+(process.env.API_PORT||8787)}};
export default defineConfig({ server:{host:'0.0.0.0',proxy},preview:{proxy},build:{rollupOptions:{input:{legacy:resolve('index.html'),city3d:resolve('3d.html')}}} });
