import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter/wght.css';
import '@basiclinear/ui/tokens.css';
import './hosted.css';
import { Homepage } from './homepage.js';
import { isHostedApplicationEntry } from './homepage-entry.js';

// Keep authentication behind an explicit app/deep-link entry. A saved login must
// never replace the public homepage or trigger workspace restoration on it.
const HostedApplication = lazy(async () => {
  const [{ HostedApp }, { prepareHostedGoogleSignIn }] = await Promise.all([
    import('./hosted-app.js'),
    import('./hosted-auth.js'),
    import('./hosted-workspace.css'),
    import('./ai-mcp-guide.css'),
  ]);
  const { readHostedBrowserEnvironment } = await import('./hosted-environment.js');
  try { readHostedBrowserEnvironment(); }
  catch { return { default: HostedUnavailable }; }
  await prepareHostedGoogleSignIn().catch(() => undefined);
  return { default: HostedApp };
});

function HostedUnavailable() {
  return <main className="hp hp-entry-status">
    <h1>The online app isn’t available here yet.</h1>
    <p>This environment isn’t connected to the hosted service. You can still explore BasicLinear or follow the local setup guide.</p>
    <a className="hp-button" href={`${window.location.pathname}#getting-started`}>Back to setup guide</a>
  </main>;
}

const root = document.getElementById('root');
if (root === null) throw new Error('Application root is missing.');

createRoot(root).render(
  <StrictMode>
    {isHostedApplicationEntry(window.location.search, window.location.hash)
      ? <Suspense fallback={<main className="hosted-entry-loading" role="status">Opening BasicLinear…</main>}><HostedApplication /></Suspense>
      : <Homepage />}
  </StrictMode>,
);
