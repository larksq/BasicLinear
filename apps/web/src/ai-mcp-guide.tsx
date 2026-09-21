import {useEffect, useId, useRef, useState} from 'react';
import {
  Bot,
  Check,
  ChevronRight,
  Clipboard,
  Code2,
  ExternalLink,
  KeyRound,
  ShieldCheck,
  Terminal,
  X,
} from 'lucide-react';

const ONLINE_MCP_URL = 'https://openlinear.qiaosun.me/mcp';

export interface AiMcpGuideProps {
  serverUrl?: string;
  surface: 'hosted' | 'local';
  collapsed?: boolean;
}

function ClientCommands({
  client,
  commands,
  documentationUrl,
  copied,
  onCopy,
}: {
  client: 'Codex' | 'Claude Code';
  commands: string;
  documentationUrl: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <section className="ai-mcp-client-card" aria-labelledby={`ai-mcp-${client === 'Codex' ? 'codex' : 'claude'}`}>
      <header>
        <span className="ai-mcp-client-icon" aria-hidden="true">{client === 'Codex' ? <Terminal size={16} /> : <Code2 size={16} />}</span>
        <div>
          <h3 id={`ai-mcp-${client === 'Codex' ? 'codex' : 'claude'}`}>{client}</h3>
          <span>Run these commands in your terminal</span>
        </div>
        <a href={documentationUrl} target="_blank" rel="noreferrer" aria-label={`Open ${client} MCP documentation`} title={`Open ${client} MCP documentation`}>
          <ExternalLink size={14} />
        </a>
      </header>
      <div className="ai-mcp-command-block">
        <pre><code>{commands}</code></pre>
        <button type="button" onClick={onCopy} aria-label={`Copy ${client} setup commands`}>
          {copied ? <Check size={14} /> : <Clipboard size={14} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      {client === 'Claude Code' && <p className="ai-mcp-client-note">CLI login requires Claude Code 2.1.186 or later. On older versions, open Claude Code, run <code>/mcp</code>, and select OpenLinear to sign in.</p>}
    </section>
  );
}

export function AiMcpGuide({serverUrl, surface, collapsed = false}: AiMcpGuideProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [open, setOpen] = useState(false);
  const [copiedClient, setCopiedClient] = useState<'codex' | 'claude' | null>(null);
  const mcpUrl = serverUrl ?? ONLINE_MCP_URL;
  const codexCommands = `codex mcp add openlinear --url ${mcpUrl}\ncodex mcp login openlinear\ncodex mcp list`;
  const claudeCommands = `claude mcp add --transport http openlinear ${mcpUrl}\nclaude mcp login openlinear\nclaude mcp list`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (open && !dialog.open) {
      dialog.showModal();
      window.requestAnimationFrame(() => dialog.querySelector<HTMLElement>('[data-ai-guide-close]')?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const close = () => {
    setOpen(false);
    setCopiedClient(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const copyCommands = async (client: 'codex' | 'claude', commands: string) => {
    try {
      await navigator.clipboard.writeText(commands);
      setCopiedClient(client);
    } catch {
      setCopiedClient(null);
    }
  };

  return (
    <div className={`ai-mcp-guide ai-mcp-guide-${surface}`}>
      <button
        ref={triggerRef}
        className="ai-mcp-guide-trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        title={collapsed ? 'Use OpenLinear with AI' : undefined}
        onClick={() => setOpen(true)}
      >
        <span className="ai-mcp-guide-trigger-icon" aria-hidden="true"><Bot size={16} /></span>
        <span className="ai-mcp-guide-trigger-copy">
          <strong>Use OpenLinear with AI</strong>
          <small>{surface === 'hosted' ? 'Connect Codex or Claude Code' : 'Connect an online workspace'}</small>
        </span>
        <ChevronRight className="ai-mcp-guide-trigger-chevron" size={14} aria-hidden="true" />
      </button>

      <dialog
        ref={dialogRef}
        className={`ai-mcp-guide-dialog ai-mcp-guide-dialog-${surface}`}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => {
          if (open) setOpen(false);
        }}
        onClick={(event) => {
          if (event.currentTarget === event.target) close();
        }}
      >
        <header className="ai-mcp-guide-header">
          <div>
            <span className="ai-mcp-guide-eyebrow"><Bot size={13} /> AI workflow</span>
            <h2 id={titleId}>Authorize Codex or Claude Code</h2>
            <p id={descriptionId}>Connect through OpenLinear MCP, approve only the workspace and scopes you need, then operate issues in plain language.</p>
          </div>
          <button data-ai-guide-close type="button" aria-label="Close AI guide" title="Close" onClick={close}><X size={17} /></button>
        </header>

        <div className="ai-mcp-guide-body">
          {surface === 'local' ? (
            <div className="ai-mcp-boundary-note">
              <ShieldCheck size={17} />
              <div><strong>Your local workspace stays local.</strong><span>These commands connect to <a href="https://openlinear.qiaosun.me/?app" target="_blank" rel="noreferrer">OpenLinear Online</a>; it does not upload or synchronize this SQLite workspace. For a self-hosted workspace, use the MCP endpoint shown in that workspace’s AI guide.</span></div>
            </div>
          ) : (
            <div className="ai-mcp-endpoint">
              <span><KeyRound size={15} /> This workspace’s MCP endpoint</span>
              <code>{mcpUrl}</code>
            </div>
          )}

          <section className="ai-mcp-guide-step" aria-labelledby={`${titleId}-connect`}>
            <div className="ai-mcp-step-number">1</div>
            <div>
              <h3 id={`${titleId}-connect`}>Connect your client</h3>
              <p>{surface === 'local' ? 'Connect to OpenLinear Online, then choose the hosted workspace you want AI to operate.' : 'Add this workspace as a remote Streamable HTTP MCP server.'}</p>
              <div className="ai-mcp-client-grid">
                <ClientCommands
                  client="Codex"
                  commands={codexCommands}
                  documentationUrl="https://learn.chatgpt.com/docs/extend/mcp"
                  copied={copiedClient === 'codex'}
                  onCopy={() => { void copyCommands('codex', codexCommands); }}
                />
                <ClientCommands
                  client="Claude Code"
                  commands={claudeCommands}
                  documentationUrl="https://code.claude.com/docs/en/mcp"
                  copied={copiedClient === 'claude'}
                  onCopy={() => { void copyCommands('claude', claudeCommands); }}
                />
              </div>
            </div>
          </section>

          <section className="ai-mcp-guide-step" aria-labelledby={`${titleId}-authorize`}>
            <div className="ai-mcp-step-number">2</div>
            <div>
              <h3 id={`${titleId}-authorize`}>Authorize in the browser</h3>
              <p>Sign in with Google, select the workspace, review the requested scopes, and approve. MCP uses OAuth with PKCE; do not create or paste a personal access token.</p>
            </div>
          </section>

          <section className="ai-mcp-guide-step" aria-labelledby={`${titleId}-operate`}>
            <div className="ai-mcp-step-number">3</div>
            <div>
              <h3 id={`${titleId}-operate`}>Ask AI to read, then operate</h3>
              <p>Start read-only, name the workspace explicitly, and ask the client to read the latest issue revision before any update.</p>
              <ul className="ai-mcp-prompt-list">
                <li><code>Use OpenLinear to list the workspaces I can access. Do not change anything.</code></li>
                <li><code>In workspace &lt;id&gt;, create an issue in team &lt;id&gt; titled “…” and read it back.</code></li>
                <li><code>Read issue &lt;id&gt;, then update its priority using the latest revision.</code></li>
              </ul>
            </div>
          </section>

          <footer className="ai-mcp-guide-safety">
            <ShieldCheck size={16} />
            <p><strong>Same permissions, whichever client you use.</strong> OpenLinear checks membership, scopes, revisions, and retry safety on every MCP call. Ask for confirmation before removing a member, revoking an invitation, or deleting a comment.</p>
          </footer>
          <span className="sr-only" role="status" aria-live="polite">{copiedClient === null ? '' : `${copiedClient === 'codex' ? 'Codex' : 'Claude Code'} setup commands copied.`}</span>
        </div>
      </dialog>
    </div>
  );
}
