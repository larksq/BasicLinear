/** Keep private deep links and authorization callbacks in the existing hosted app. */
export function isHostedApplicationEntry(search: string, hash: string): boolean {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/u, ''));
  return ['app', 'billing', 'oauth_request', 'oauth_workspace'].some(key => query.has(key))
    || ['invite', 'issue'].some(key => fragment.has(key));
}

/** A checkout redirect selects the UI only; entitlement still comes from the server. */
export function isBillingReturn(search: string): boolean {
  const values = new URLSearchParams(search).getAll('billing');
  return values.length === 1 && (values[0] === 'success' || values[0] === 'cancelled');
}
