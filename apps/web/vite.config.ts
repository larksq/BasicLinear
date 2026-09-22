import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export const localBuildMode = 'basiclinear-local';
export const hostedBuildMode = 'basiclinear-hosted';
export const vercelHostedBuildMode = 'basiclinear-hosted-vercel';

export default defineConfig(({ command, mode }) => {
  const localProductionBuild = command === 'build' && mode === localBuildMode;
  const hostedProductionBuild = command === 'build'
    && (mode === hostedBuildMode || mode === vercelHostedBuildMode);
  const vercelHostedProductionBuild = command === 'build' && mode === vercelHostedBuildMode;
  const localInput = resolve(import.meta.dirname, 'index.html');
  const hostedInput = resolve(import.meta.dirname, 'hosted.html');

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: { '/api': 'http://127.0.0.1:4174', '/health': 'http://127.0.0.1:4174' },
    },
    build: {
      sourcemap: false,
      outDir: 'dist',
      emptyOutDir: vercelHostedProductionBuild || !hostedProductionBuild,
      rolldownOptions: {
        input: localProductionBuild
          ? { local: localInput }
          : hostedProductionBuild
            ? { hosted: hostedInput }
            : { local: localInput, hosted: hostedInput },
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
  };
});
