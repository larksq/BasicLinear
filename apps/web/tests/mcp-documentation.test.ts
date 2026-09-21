import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {describe, expect, it} from 'vitest';

const html = readFileSync('apps/web/public/mcp-guide.html', 'utf8');
const script = readFileSync('apps/web/public/openlinear-mcp-guide.js', 'utf8');

describe('public MCP setup documentation', () => {
  it('ships usable setup instructions without a login or an application bundle', () => {
    expect(html).toContain('<h1>Connect AI clients with MCP</h1>');
    expect(html).toContain('codex mcp add openlinear --url https://openlinear.qiaosun.me/mcp');
    expect(html).toContain('claude mcp add --transport http openlinear https://openlinear.qiaosun.me/mcp');
    expect(html).toContain('href="/?app"');
    expect(html).toContain('src="/openlinear-mcp-guide.js"');
    expect(html).not.toMatch(/hosted-main|firebase|href="#"|\.example\/mcp/);
  });

  it.each(['https://openlinear.qiaosun.me', 'https://team.example.test', 'http://127.0.0.1:5173'])(
    'uses the actual deployment endpoint on %s without leaking a query or fragment', origin => {
      const elements = [...html.matchAll(/<code data-mcp-(?:endpoint|commands)>(.*?)<\/code>/gs)]
        .map(match => ({textContent: match[1]}));
      expect(elements).toHaveLength(3);
      runInNewContext(script, {
        URL,
        window: {location: {href: `${origin}/mcp-guide.html?session_id=private#invite=private`}},
        document: {querySelectorAll: () => elements},
      });
      expect(elements[0]?.textContent).toBe(`${origin}/mcp`);
      expect(elements[1]?.textContent).toContain(`codex mcp add openlinear --url ${origin}/mcp`);
      expect(elements[2]?.textContent).toContain(`claude mcp add --transport http openlinear ${origin}/mcp`);
      expect(JSON.stringify(elements)).not.toContain('private');
    },
  );
});
