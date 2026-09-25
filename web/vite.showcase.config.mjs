import { resolve } from 'node:path';
export default {
  base: process.env.IDUN_PUBLIC_BASE || '/',
  build: {outDir: '../.idun/showcase-build', emptyOutDir:true, rollupOptions:{input:resolve('web/showcase.html')}},
};
