import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { generateIssues, groupIssues, issueOrder } from '../public/data.mjs';

test('synthetic issue fixture is deterministic and grouped without loss', () => {
  const first = generateIssues(2000);
  const second = generateIssues(2000);
  assert.deepEqual(first, second);
  assert.equal(first.length, 2000);
  assert.equal(new Set(first.map((issue) => issue.id)).size, 2000);
  const entries = groupIssues(first);
  assert.equal(entries.filter((entry) => entry.type === 'issue').length, 2000);
  assert.deepEqual(issueOrder(entries).map((issue) => issue.id), entries.filter((entry) => entry.type === 'issue').map((entry) => entry.issue.id));
});

test('UI contract exposes keyboard, dialog, listbox, and detail semantics', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(html, /role="listbox"/);
  assert.match(html, /<dialog id="command-dialog"/);
  assert.match(html, /aria-label="Issue details"/);
  assert.match(html, /data-open-create aria-label="Create issue"/);
  assert.equal((html.match(/class="nav-label"/g) ?? []).length, 5);
  assert.match(script, /event\.key\.toLowerCase\(\) === 'j'/);
  assert.match(script, /event\.key === 'Escape'/);
  assert.match(script, /unhandledrejection/);
  assert.match(script, /dataset\.runtimeErrors/);
  assert.match(css, /--row-height: 36px/);
  assert.match(css, /\.app-shell\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\)[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.workspace\s*\{[^}]*min-height:\s*0[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.virtual-content\s*\{\s*min-width:\s*420px/s);
  assert.match(css, /@media \(max-width: 1199px\)/);
  assert.match(css, /@media \(max-width: 767px\)/);
});
