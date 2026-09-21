/* Production-only GA4. No workspace content, raw URLs, or automatic form capture. */
(() => {
  const measurementId = 'G-WP59LSRZSE';
  const preferenceKey = 'openlinear.analytics-consent.v1';
  const url = new URL(window.location.href);
  if (url.hostname !== 'openlinear.qiaosun.me' || url.protocol !== 'https:') return;
  if (!['/', '/hosted.html'].includes(url.pathname)) return;
  // Never load a third-party tag on authorization or private deep links.
  if ([...url.searchParams.keys()].some(key => !['app', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].includes(key))) return;
  if (url.hash.includes('=') || url.hash.includes('?')) return;
  let preference = null;
  try { preference = localStorage.getItem(preferenceKey); } catch { /* fail closed */ }
  let active = false;
  let panel;
  const storage = value => { try { localStorage.setItem(preferenceKey, value); } catch { /* session choice still works */ } };
  const safeLocation = new URL(url.origin + (url.searchParams.has('app') ? '/?app' : '/'));
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const value = url.searchParams.get(key);
    if (value && /^[a-zA-Z0-9_-]{1,80}$/.test(value)) safeLocation.searchParams.set(key, value);
  }
  let referrer = '';
  try { referrer = new URL(document.referrer).origin + '/'; } catch { /* direct */ }
  function enable() {
    if (active) return;
    active = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
      page_location: safeLocation.href, page_referrer: referrer,
      page_title: url.searchParams.has('app') ? 'OpenLinear App' : 'OpenLinear Home',
    });
    window.gtag('event', 'page_view');
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.append(script);
  }
  function choose(value) {
    storage(value);
    preference = value;
    panel.hidden = true;
    if (value === 'granted') enable();
    else if (active) {
      window[`ga-disable-${measurementId}`] = true;
      window.location.reload();
    }
  }
  function init() {
    const style = document.createElement('style');
    style.textContent = '.ol-analytics-panel{position:fixed;bottom:48px;right:16px;left:16px;margin-left:auto;max-width:400px;z-index:2147483000;padding:18px;background:#202024;color:#fff;border:1px solid #67676f;border-radius:12px;font:14px/1.5 system-ui;box-shadow:0 8px 32px #0005}.ol-analytics-panel[hidden]{display:none}.ol-analytics-panel p{margin:0 0 12px}.ol-analytics-panel button,.ol-analytics-settings{padding:8px 12px;border:1px solid #999;border-radius:6px;cursor:pointer;font:13px system-ui;background:#fff;color:#18181b}.ol-analytics-panel button+button{margin-left:8px}.ol-analytics-settings{position:fixed;bottom:10px;right:16px;z-index:2147482999}.ol-analytics-panel button:focus-visible,.ol-analytics-settings:focus-visible{outline:3px solid #9aaaff;outline-offset:3px}';
    document.head.append(style);
    panel = document.createElement('section');
    panel.className = 'ol-analytics-panel';
    panel.setAttribute('aria-label', 'Analytics preferences');
    const text = document.createElement('p');
    text.textContent = 'Allow Google Analytics to measure visits and entry-button clicks using cookies? Google receives technical device data and these events. We exclude task content and private links. Optional; you can change this choice below.';
    const decline = document.createElement('button');
    decline.type = 'button'; decline.textContent = 'Decline'; decline.onclick = () => choose('denied');
    const accept = document.createElement('button');
    accept.type = 'button'; accept.textContent = 'Allow analytics'; accept.onclick = () => choose('granted');
    panel.append(text, decline, accept);
    panel.hidden = preference === 'granted' || preference === 'denied';
    const settings = document.createElement('button');
    settings.type = 'button'; settings.className = 'ol-analytics-settings'; settings.textContent = 'Analytics preferences';
    settings.onclick = () => { panel.hidden = !panel.hidden; if (!panel.hidden) decline.focus(); };
    document.body.append(panel, settings);
    if (preference === 'granted') enable();
    document.addEventListener('click', event => {
      if (!active || preference !== 'granted' || !(event.target instanceof Element)) return;
      const link = event.target.closest('a');
      const href = link?.getAttribute('href');
      // Explicit fixed labels only. Never send textContent or a clicked URL.
      const cta = href === '?app' ? 'open_app' : href === '#getting-started' ? 'setup_guide' : null;
      if (!cta) return;
      window.gtag('event', 'cta_click', { cta_id: cta, transport_type: 'beacon' });
      if (cta === 'open_app') {
        // Let the tag flush before a normal same-tab navigation; never trap visitors
        // if the tag is blocked or offline, or interfere with new-tab shortcuts.
        const sameTab = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && !link.target;
        let navigate;
        if (sameTab) {
          event.preventDefault();
          let done = false;
          navigate = () => { if (!done) { done = true; window.location.assign('?app'); } };
          window.setTimeout(navigate, 500);
        }
        window.gtag('event', 'app_entry', { transport_type: 'beacon', event_callback: navigate, event_timeout: 500 });
      }
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
