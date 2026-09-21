import { describe, expect, it } from 'vitest';
import { isBillingReturn, isHostedApplicationEntry } from '../src/homepage-entry.js';

describe('public homepage and private hosted entry', () => {
  it.each([
    ['', ''], ['?utm_source=community', ''], ['', '#getting-started'], ['', '#open-source'],
  ])('shows the public homepage for %s %s', (search, hash) => {
    expect(isHostedApplicationEntry(search, hash)).toBe(false);
  });
  it.each([
    ['?app', ''], ['?app&source=homepage', ''], ['?oauth_request=oauthreq_example', ''],
    ['?oauth_workspace=select&client_id=example', ''], ['', '#invite=private-token'],
    ['', '#issue=example-issue'], ['?utm_source=email', '#invite=private-token'],
    ['?billing=success&session_id=checkout-session', ''], ['?billing=cancelled', ''],
    ['?app&billing=success', ''], ['?billing=unknown', ''],
  ])('preserves the hosted flow for %s %s', (search, hash) => {
    expect(isHostedApplicationEntry(search, hash)).toBe(true);
  });
  it.each(['?billing=success', '?billing=cancelled', '?app&billing=success&session_id=checkout-session'])(
    'recognizes a billing return for %s', search => { expect(isBillingReturn(search)).toBe(true); },
  );
  it.each(['', '?app', '?billing=', '?billing=unknown', '?billing=success&billing=cancelled'])(
    'does not select Billing for %s', search => { expect(isBillingReturn(search)).toBe(false); },
  );
});
