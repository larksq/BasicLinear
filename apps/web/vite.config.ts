import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:4174', '/health': 'http://127.0.0.1:4174' },
  },
  build: {
    sourcemap: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{
            name: 'editor',
            test: /node_modules[\\/](?:@tiptap[\\/]|@remirror[\\/]|prosemirror-)/,
            priority: 20,
          }],
        },
      },
    },
  },
});
