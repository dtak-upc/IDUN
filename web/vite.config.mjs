export default {
  // The CSV inspector loads this CommonJS dependency inside a worker only after
  // files are selected. Discover it at startup, not during the first upload:
  // late optimization reloads the page and discards the in-memory file queue.
  optimizeDeps: { include: ['papaparse'] },
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8787' } },
};
