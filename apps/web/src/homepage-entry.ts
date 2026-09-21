/** Keep private deep links and authorization callbacks in the existing hosted app. */
export function isHostedApplicationEntry(search: string, hash: string): boolean {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/u, ''));
  return ['app', 'oauth_request', 'oauth_workspace'].some(key => query.has(key))
    || ['invite', 'issue'].some(key => fragment.has(key));
}
