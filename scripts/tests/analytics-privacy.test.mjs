import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const source = readFileSync(new URL('../../apps/web/public/openlinear-analytics.js', import.meta.url), 'utf8');
function run(href, consent = null) {
  const nodes = []; const handlers = {};
  class Element {
    children = []; hidden = false;
    append(...values) { this.children.push(...values); nodes.push(...values); }
    setAttribute() {} focus() {}
  }
  const document = {
    readyState: 'complete', referrer: 'https://example.com/private?token=SECRET',
    head: new Element(), body: new Element(),
    createElement(tag) { const element = new Element(); element.tag = tag; return element; },
    addEventListener(name, fn) { handlers[name] = fn; },
  };
  const window = {setTimeout(fn) { window.fallback = fn; }, location: {href, assign(value) { window.navigation = value; window.navigationCount = (window.navigationCount || 0) + 1; }, reload() { window.reloaded = true; }}};
  const localStorage = {getItem: () => consent, setItem: (_, value) => {consent = value;}};
  runInNewContext(source, {window, document, localStorage, URL, Element, Date});
  return {window, nodes, handlers, Element, events: () => (window.dataLayer || []).map(x => [...x])};
}
test('no collection before consent; decline stays offline', () => {
  const r = run('https://openlinear.qiaosun.me/');
  assert.equal(r.nodes.some(x => x.tag === 'script'), false);
  r.nodes.find(x => x.textContent === 'Decline').onclick();
  assert.equal(r.events().length, 0);
});
test('opt-in sends exactly one page view and safe campaign/referrer values', () => {
  const r = run('https://openlinear.qiaosun.me/?utm_source=x&utm_campaign=ol_202609_pilot');
  r.nodes.find(x => x.textContent === 'Allow analytics').onclick();
  assert.equal(r.events().filter(x => x[1] === 'page_view').length, 1);
  const config = r.events().find(x => x[0] === 'config')[2];
  assert.equal(config.send_page_view, false);
  assert.equal(config.page_referrer, 'https://example.com/');
  assert.equal(config.allow_google_signals, false);
  assert.equal(JSON.stringify(r.events()).includes('SECRET'), false);
});
test('authorization, invitations, development and local pages never load analytics', () => {
  for (const href of ['https://openlinear.qiaosun.me/?oauth_request=secret', 'https://openlinear.qiaosun.me/#invite=secret', 'https://openlinear.qiaosun.me/?code=secret', 'https://openlinear.qiaosun.me/?billing=success&session_id=secret', 'https://openlinear.qiaosun.me/?app&billing=cancelled', 'https://openlinear-development.vercel.app/', 'http://localhost:5173/']) {
    const r = run(href, 'granted');
    assert.equal(r.nodes.length, 0, href);
    assert.equal(r.events().length, 0, href);
  }
});
test('only allowlisted CTA events; user text is not transmitted', () => {
  const r = run('https://openlinear.qiaosun.me/', 'granted');
  const target = new r.Element();
  target.closest = () => ({getAttribute: () => '?app', textContent: 'PRIVATE'});
  r.handlers.click({target});
  assert.equal(r.events().filter(x => x[1] === 'cta_click').length, 1);
  assert.equal(r.events().filter(x => x[1] === 'app_entry').length, 1);
  assert.equal(JSON.stringify(r.events()).includes('PRIVATE'), false);
  target.closest = () => ({getAttribute: () => '/issues/private'});
  r.handlers.click({target});
  assert.equal(r.events().filter(x => x[1] === 'cta_click').length, 1);
});
test('withdrawal disables measurement immediately', () => {
  const r = run('https://openlinear.qiaosun.me/', 'granted');
  r.nodes.find(x => x.textContent === 'Decline').onclick();
  assert.equal(r.window['ga-disable-G-WP59LSRZSE'], true);
  assert.equal(r.window.reloaded, true);
});
test('entry navigation waits for dispatch, falls back offline, and runs only once', () => {
  const r = run('https://openlinear.qiaosun.me/', 'granted');
  const target = new r.Element();
  target.closest = () => ({getAttribute: () => '?app'});
  let prevented = false;
  r.handlers.click({target, button: 0, preventDefault() { prevented = true; }});
  assert.equal(prevented, true);
  assert.equal(r.window.navigation, undefined);
  r.window.fallback();
  r.events().find(x => x[1] === 'app_entry')[2].event_callback();
  assert.equal(r.window.navigation, '?app');
  assert.equal(r.window.navigationCount, 1);
});
