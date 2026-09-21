import { describe, expect, it } from 'vitest';
import { isHostedApplicationEntry } from '../src/homepage-entry.js';

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
  ])('preserves the hosted flow for %s %s', (search, hash) => {
    expect(isHostedApplicationEntry(search, hash)).toBe(true);
  });
});
