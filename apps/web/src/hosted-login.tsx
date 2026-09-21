import { BrandMark } from './brand-mark.js';
import { ArrowLeft, ArrowUpRight, ShieldCheck, Laptop, LoaderCircle } from 'lucide-react';
import './hosted-login.css';

export type LoginPhase = 'idle' | 'restoring' | 'signing-in' | 'bootstrapping' | 'error';
export interface HostedLoginProps {
  phase: LoginPhase;
  error?: string | undefined;
  identityOnly?: boolean;
  onContinue: () => void;
}
function GoogleMark() {
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z"/></svg>;
}
export function HostedLogin({phase, error, identityOnly = false, onContinue}: HostedLoginProps) {
  const homeHref = typeof window === 'undefined' ? '/' : window.location.pathname;
  const busy = phase === 'restoring' || phase === 'signing-in' || phase === 'bootstrapping';
  const label = phase === 'restoring' ? 'Checking your session…' : phase === 'signing-in' ? 'Opening Google…' : phase === 'bootstrapping' ? 'Preparing your workspace…' : phase === 'error' ? 'Try again with Google' : 'Continue with Google';
  return <section className="ol-login" aria-labelledby="login-title">
    <aside className="ol-login-art" aria-label="OpenLinear, an independent open-source workspace">
      <img src="/images/login-sculpture.jpg" alt="" width="1086" height="1448" fetchPriority="high"/>
      <a className="ol-login-brand" href={homeHref}><BrandMark className="ol-login-mark"/><span>OpenLinear</span></a>
      <div className="ol-login-art-copy"><p>A little clarity.<br/>A lot of possibility.</p><span>An independent, open-source workspace.</span></div>
    </aside>
    <div className="ol-login-panel">
      <a className="ol-login-back" href={homeHref}><ArrowLeft size={17}/>Back to home</a>
      <div className="ol-login-form">
        <div className="ol-login-symbol"><BrandMark className="ol-login-mark"/></div>
        <h1 id="login-title">Welcome to OpenLinear</h1>
        <p className="ol-login-subtitle">Sign in or create your account to continue.</p>
        <button className="ol-login-google" type="button" disabled={busy} onClick={onContinue} aria-describedby="login-account-note" aria-busy={busy}>
          {busy ? <LoaderCircle size={20} className="ol-login-spinner" aria-hidden="true"/> : <GoogleMark/>}{label}
        </button>
        <p id="login-account-note" className="ol-login-account">New here? We’ll create your account automatically.</p>
        <div aria-live="polite" aria-atomic="true" className="ol-login-status">
          {busy && <p>{phase === 'signing-in' ? 'Complete sign-in in the Google window to continue.' : phase === 'bootstrapping' ? 'Getting everything ready. Keep this page open.' : 'Looking for an existing sign-in on this device.'}</p>}
          {phase === 'error' && <div className="ol-login-error" role="alert"><strong>We couldn’t sign you in.</strong><p>{error || 'Please try again.'}</p></div>}
          {identityOnly && <p className="ol-login-dev">Development identity check only. Workspace creation is not enabled in this environment.</p>}
        </div>
        <section className="ol-login-trust" aria-labelledby="login-trust-title">
          <h2 id="login-trust-title">Built on trust</h2>
          <div className="ol-login-trust-card">
            <div className="ol-login-trust-row">
              <span className="ol-login-trust-icon"><ShieldCheck size={28} strokeWidth={1.5} aria-hidden="true"/></span>
              <div><h3>One account. No extra password.</h3><p>Sign in securely with your Google account.</p></div>
            </div>
            <div className="ol-login-trust-row">
              <span className="ol-login-trust-icon"><Laptop size={28} strokeWidth={1.5} aria-hidden="true"/></span>
              <div><h3>Local stays local.</h3><p>Signing in won’t upload your local workspaces.</p></div>
            </div>
          </div>
        </section>
      </div>
      <a className="ol-login-about" href={`${homeHref}#open-source`}>About OpenLinear<ArrowUpRight size={16}/></a>
    </div>
  </section>;
}
