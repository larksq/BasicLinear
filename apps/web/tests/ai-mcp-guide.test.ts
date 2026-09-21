import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

describe('AI MCP onboarding guide', () => {
  const guide = readFileSync('apps/web/src/ai-mcp-guide.tsx', 'utf8');
  const localApp = readFileSync('apps/web/src/App.tsx', 'utf8');
  const hostedApp = readFileSync('apps/web/src/hosted-workspace.tsx', 'utf8');
  const localEntry = readFileSync('apps/web/src/main.tsx', 'utf8');
  const hostedEntry = readFileSync('apps/web/src/hosted-main.tsx', 'utf8');
  const styles = readFileSync('apps/web/src/ai-mcp-guide.css', 'utf8');

  it('is available from the bottom-left navigation in local and hosted editions', () => {
    expect(localApp).toContain('<AiMcpGuide surface="local" collapsed={railCollapsed} />');
    expect(hostedApp).toContain('<AiMcpGuide surface="hosted" serverUrl={`${window.location.origin}/mcp`} />');
    expect(localEntry).toContain("import './ai-mcp-guide.css';");
    expect(hostedEntry).toContain("import('./ai-mcp-guide.css')");
  });

  it('documents the supported OAuth setup commands for Codex and Claude Code', () => {
    expect(guide).toContain('codex mcp add openlinear --url ${mcpUrl}');
    expect(guide).toContain('codex mcp login openlinear');
    expect(guide).toContain('claude mcp add --transport http openlinear ${mcpUrl}');
    expect(guide).toContain('claude mcp login openlinear');
    expect(guide).toContain('https://learn.chatgpt.com/docs/extend/mcp');
    expect(guide).toContain('https://code.claude.com/docs/en/mcp');
  });

  it('keeps the local authority boundary explicit and restores trigger focus on close', () => {
    expect(guide).toContain('Your local workspace stays local.');
    expect(guide).toContain('it does not upload or synchronize this SQLite workspace');
    expect(guide).toContain('window.requestAnimationFrame(() => triggerRef.current?.focus())');
    expect(guide).toContain('aria-label="Close AI guide"');
  });

  it('keeps the guide inside narrow viewports and stacks client setup cards on mobile', () => {
    expect(styles).toContain('@media (max-width: 720px)');
    expect(styles).toContain('.ai-mcp-guide-dialog { width: calc(100vw - 16px); max-height: calc(100vh - 16px); }');
    expect(styles).toContain('.ai-mcp-client-grid { grid-template-columns: 1fr; }');
    expect(styles).toContain('.ai-mcp-endpoint { grid-template-columns: 1fr; gap: 5px; }');
  });
});
