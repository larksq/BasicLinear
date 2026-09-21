// Fragments never reach the server. Keep invitation/issue entry documents and
// noncanonical hosts out of search even when they use the public HTML shell.
(() => {
  const query = new URLSearchParams(window.location.search);
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const privateEntry = ['app', 'oauth_request', 'oauth_workspace'].some(key => query.has(key))
    || ['invite', 'issue'].some(key => fragment.has(key));
  if (window.location.hostname === 'openlinear.qiaosun.me' && !privateEntry) return;
  let robots = document.querySelector('meta[name="robots"]');
  if (!robots) {
    robots = document.createElement('meta');
    robots.name = 'robots';
    document.head.appendChild(robots);
  }
  robots.content = 'noindex, nofollow, noarchive';
})();
