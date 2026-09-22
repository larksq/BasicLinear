import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HostedLogin, type LoginPhase } from '../src/hosted-login.js';
const render = (phase: LoginPhase, extras = {}) => renderToStaticMarkup(createElement(HostedLogin, {phase, onContinue() {}, ...extras}));
describe('dedicated hosted login', () => {
  it('offers a single shared login and registration action without the old landing page', () => {
    const html = render('idle');
    expect(html).toContain('Continue with Google');
    expect(html).toContain('create your account automatically');
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('hosted-price-row');
    expect(html).not.toContain('Bring the team');
    expect(html).toContain('href="/"');
  });
  it.each(['restoring', 'signing-in', 'bootstrapping'] as const)('prevents duplicate submission during %s', (phase) => {
    const html = render(phase);
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-live="polite"');
  });
  it('announces an escaped error and enables retry', () => {
    const html = render('error', {error: '<script>unsafe</script>'});
    expect(html).toContain('role="alert"');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Try again with Google');
    expect(html).not.toContain('disabled=""');
  });
  it('explains identity-only environments', () => {
    expect(render('idle', {identityOnly: true})).toContain('Workspace creation is not enabled');
  });
});
