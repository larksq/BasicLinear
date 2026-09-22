import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource-variable/inter/wght.css';
import '@basiclinear/ui/tokens.css';
import './styles.css';
import './ai-mcp-guide.css';
import { App } from './App.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 20_000, retry: false, refetchOnWindowFocus: false, networkMode: 'always' },
    mutations: { retry: false, networkMode: 'always' },
  },
});

const root = document.getElementById('root');
if (root === null) throw new Error('Application root is missing.');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
