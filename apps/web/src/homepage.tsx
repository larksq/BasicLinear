import { BrandMark } from './brand-mark.js';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronDown, CircleDashed, CircleDot, Code2, Copy, Database, Flag, FolderKanban, GitBranch, Keyboard, LayoutGrid, List, Menu, Monitor, Search, ShieldCheck, Sparkles, Terminal, X } from 'lucide-react';
import './homepage.css';

const setupCommand = 'npm ci\nnpm run build\nnpm start';
const repositoryUrl = import.meta.env.VITE_OPENLINEAR_REPOSITORY_URL?.trim();
const sourceUrl = repositoryUrl && /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/u.test(repositoryUrl) ? repositoryUrl : null;
const issues = [
  { id: 'OL-128', title: 'Create a calmer space for focused work', label: 'Design', status: 'In progress', priority: 'High' },
  { id: 'OL-127', title: 'Bring project milestones into view', label: 'Feature', status: 'In progress', priority: 'High' },
  { id: 'OL-126', title: 'Make every action a keyboard shortcut away', label: 'Experience', status: 'In progress', priority: 'Medium' },
  { id: 'OL-125', title: 'Keep issue context close to the work', label: 'Feature', status: 'Todo', priority: 'Medium' },
  { id: 'OL-124', title: 'Save the views you come back to', label: 'Experience', status: 'Todo', priority: 'Low' },
  { id: 'OL-123', title: 'Make your workspace feel like yours', label: 'Design', status: 'Todo', priority: 'Low' },
  { id: 'OL-122', title: 'Keep local data in your hands', label: 'Infrastructure', status: 'Done', priority: 'High' },
  { id: 'OL-121', title: 'Build an open foundation', label: 'Infrastructure', status: 'Done', priority: 'Medium' },
];
const statuses = ['In progress', 'Todo', 'Done'] as const;
function StatusIcon({ status }: { status: string }) {
  return status === 'Done' ? <CheckCircle2 className="hp-status-done" size={15} /> : status === 'In progress' ? <CircleDot className="hp-status-progress" size={15} /> : <CircleDashed size={15} />;
}

function ProductPreview() {
  const [layout, setLayout] = useState<'list' | 'board'>('list');
  const [query, setQuery] = useState('');
  const filtered = issues.filter(issue => `${issue.id} ${issue.title} ${issue.label}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="hp-preview" aria-label="Interactive product preview with sample issues">
    <aside className="hp-preview-sidebar">
      <div className="hp-preview-brand"><BrandMark /> OpenLinear <ChevronDown size={12} /></div>
      <div className="hp-preview-space">Your workspace</div>
      <div className="hp-preview-nav"><FolderKanban size={15} /> Projects</div>
      <div className="hp-preview-nav selected"><CircleDot size={15} /> Issues <span>8</span></div>
      <div className="hp-preview-nav"><LayoutGrid size={15} /> Views</div>
      <div className="hp-preview-space">Project</div>
      <div className="hp-preview-nav"><GitBranch size={15} /> OpenLinear launch</div>
      <div className="hp-preview-local"><Database size={13} /> A space for your next idea</div>
    </aside>
    <div className="hp-preview-main">
      <div className="hp-preview-top"><span>OpenLinear launch <span className="hp-preview-slash">/</span> <strong>Issues</strong></span><span className="hp-demo-badge">Interactive preview</span></div>
      <div className="hp-preview-toolbar">
        <label className="hp-search"><Search size={14} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find an issue…" aria-label="Search preview issues" /></label>
        <div className="hp-view-toggle" role="group" aria-label="Preview layout"><button type="button" aria-pressed={layout === 'list'} onClick={() => setLayout('list')}><List size={14} /> List</button><button type="button" aria-pressed={layout === 'board'} onClick={() => setLayout('board')}><LayoutGrid size={14} /> Board</button></div>
      </div>
      <div className={`hp-preview-content ${layout}`} aria-live="polite">
        {filtered.length === 0 ? <div className="hp-preview-empty"><Search size={24} /><strong>No matching issues</strong><span>Try another title, ID, or label.</span><button type="button" onClick={() => setQuery('')}>Clear search</button></div> : statuses.map(status => <section className="hp-issue-group" key={status} aria-label={status}>
          <h3><StatusIcon status={status} />{status}<span>{filtered.filter(issue => issue.status === status).length}</span></h3>
          {filtered.filter(issue => issue.status === status).map(issue => <div className="hp-issue" key={issue.id}>
            <span className="hp-issue-id">{issue.id}</span><StatusIcon status={status} /><span className="hp-issue-title">{issue.title}</span><span className="hp-issue-label">{issue.label}</span><Flag size={12} aria-label={`${issue.priority} priority`} />
          </div>)}
        </section>)}
      </div>
      <div className="hp-preview-bottom"><span>Sample workspace · explore list, board, and search</span><span>{filtered.length} {filtered.length === 1 ? 'issue' : 'issues'}</span></div>
    </div>
  </div>;
}

const faqs = [
  { q: 'Is this made by Linear?', a: 'No. OpenLinear is an independent, open-source project inspired by Linear’s focused approach to product management. It is not affiliated with, endorsed by, or an official version of Linear.' },
  { q: 'How do I get started?', a: 'Open the online app and continue with Google for a hosted workspace. To run the local edition, get the source, install Node.js 24 and npm 11, then run the three commands above. Open http://127.0.0.1:4174 in your browser and create your first project.' },
  { q: 'Is OpenLinear free?', a: 'The local edition is free to run and licensed under AGPL-3.0-only. The online edition is a separate hosted service; its trial and plan details are shown in the app. Running locally does not require a hosted subscription.' },
  { q: 'Where does my data live?', a: 'The local edition stores your workspace in a SQLite database on your computer. The online edition stores workspace data on Firebase. Local and online workspaces are separate; local data is not automatically uploaded or synchronized.' },
  { q: 'Can I use it with my team?', a: 'The online edition supports shared workspaces, invitations, assignments, and comments. The local edition is designed for a single owner. Choose the edition that fits how you work.' },
  { q: 'Can I change the code?', a: 'Yes. OpenLinear is licensed under AGPL-3.0-only. You can inspect and modify the source under that license. Read the included license for the conditions that apply when distributing changes or offering a modified version over a network.' },
];

export function Homepage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const copySetup = async () => {
    try { await navigator.clipboard.writeText(setupCommand); setCopyState('copied'); }
    catch { setCopyState('failed'); }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopyState('idle'), 4000);
  };
  return <div className="hp" onKeyDown={event => { if (event.key === 'Escape' && menuOpen) { setMenuOpen(false); menuButton.current?.focus(); } }}>
    <a href="#main-content" className="hp-skip">Skip to content</a>
    <header className="hp-header">
      <div className="hp-header-inner">
        <a className="hp-brand" href="/" aria-label="OpenLinear home"><BrandMark /><span>OpenLinear</span></a>
        <nav className="hp-desktop-nav" aria-label="Main navigation"><a href="#product">Product</a><a href="#how-it-works">How it works</a><a href="#open-source">Open source</a><a href="#getting-started">Get started</a></nav>
        <div className="hp-nav-actions"><a className="hp-nav-source" href={sourceUrl ?? '/openlinear-license.txt'}>{sourceUrl ? 'GitHub' : 'AGPL-3.0'}<ArrowUpRight size={13} /></a><a className="hp-button hp-button-small" href="?app">Open app <ArrowUpRight size={13} /></a><button ref={menuButton} className="hp-menu-button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="hp-mobile-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button></div>
      </div>
      <nav id="hp-mobile-nav" className="hp-mobile-nav" aria-label="Mobile navigation" hidden={!menuOpen} onClick={() => setMenuOpen(false)}><a href="#product">Product</a><a href="#how-it-works">How it works</a><a href="#open-source">Open source</a><a href="#getting-started">Get started</a></nav>
    </header>
    <main id="main-content" tabIndex={-1}>
      <section className="hp-hero hp-container" aria-labelledby="hp-title">
        <a className="hp-announcement" href="#open-source"><span className="hp-live-dot"><Code2 size={13} /></span> Independently built. Open by design. <ArrowRight size={13} /></a>
        <h1 id="hp-title">A little less overhead.<br /><span>A lot more progress.</span></h1>
        <div className="hp-hero-bottom"><p>The open-source home for your projects and ideas.<br className="hp-desktop-break" /> Inspired by Linear. Built to be yours.</p><a className="hp-hero-note" href="#getting-started">Your work. Your workspace. <ArrowDown size={14} /></a></div>
        <div className="hp-hero-actions"><a className="hp-button" href="?app">Start building <ArrowRight size={15} /></a><a className="hp-text-link" href="#getting-started"><Terminal size={15} /> Run locally <ArrowRight size={14} /></a></div>
        <ProductPreview />
        <div className="hp-proof"><span>Built for independent minds<br /><strong>and things worth shipping.</strong></span><div><Code2 size={17} /> Open source</div><div><Database size={17} /> Local-first edition</div><div><Keyboard size={17} /> Keyboard friendly</div><div><Monitor size={17} /> Yours to customize</div></div>
      </section>
      <section id="product" className="hp-container hp-section" aria-labelledby="hp-product-title">
        <div className="hp-section-heading"><div><p className="hp-eyebrow">01 / A clearer way to work</p><h2 id="hp-product-title">Big ideas.<br />Manageable pieces.</h2></div><p>Bring the plan, the details, and the next step into one focused workspace. Just enough structure to keep moving.</p></div>
        <div className="hp-features">
          <article><FolderKanban size={28} strokeWidth={1.4} /><h3>A place for the bigger picture.</h3><p>Give every project an outcome. Add milestones, set target dates, and see progress as the work comes together.</p><div className="hp-feature-meta">Projects <span>/</span> Milestones <span>/</span> Progress</div></article>
          <article><CircleDot size={28} strokeWidth={1.4} /><h3>Details that don’t get lost.</h3><p>Capture issues with priorities, labels, rich-text descriptions, and comments. Keep the context next to the work.</p><div className="hp-feature-meta">Issues <span>/</span> Priorities <span>/</span> Context</div></article>
          <article><Keyboard size={28} strokeWidth={1.4} /><h3>Find your own flow.</h3><p>Switch between list and board. Save your favorite views, find work quickly, and keep your hands on the keyboard.</p><div className="hp-feature-meta">Views <span>/</span> Search <span>/</span> Shortcuts</div></article>
        </div>
      </section>
      <section id="how-it-works" className="hp-container hp-section" aria-labelledby="hp-workflow-title">
        <div className="hp-section-heading"><div><p className="hp-eyebrow">02 / From idea to done</p><h2 id="hp-workflow-title">A simple rhythm.<br />Every day.</h2></div><p>Start with the outcome. Break it down. Move one useful thing forward. OpenLinear keeps the thread.</p></div>
        <ol className="hp-steps"><li><span>01</span><h3>Set the direction</h3><p>Create a project. Write down what success looks like and when you want to get there.</p></li><li><span>02</span><h3>Make it actionable</h3><p>Add milestones and issues. Give each piece a priority and a clear next step.</p></li><li><span>03</span><h3>Build. Review. Repeat.</h3><p>Work from your saved view. Update status as you go and watch the bigger picture take shape.</p></li></ol>
      </section>
      <section id="open-source" className="hp-container hp-section hp-open" aria-labelledby="hp-open-title">
        <div><p className="hp-eyebrow"><GitBranch size={13} /> 03 / Open by design</p><h2 id="hp-open-title">Your workflow.<br />Your code.<br /><span>Your call.</span></h2><p>Good tools should leave room for your way of working. Run OpenLinear on your computer, explore the source, and make it your own.</p><a className="hp-text-link" href={sourceUrl ?? '/openlinear-license.txt'}>{sourceUrl ? 'Explore the source on GitHub' : 'Read the AGPL-3.0 license'} <ArrowUpRight size={15} /></a>{!sourceUrl && <p className="hp-source-note">The source repository is not public yet. You can use the online app now.</p>}</div>
        <div className="hp-principles"><article><Code2 size={20} /><div><h3>Open source. Real ownership.</h3><p>Licensed under AGPL-3.0-only. Inspect the code, adapt your workflow, and build on an open foundation.</p></div></article><article><Database size={20} /><div><h3>A local home for your work.</h3><p>The local edition runs on Node.js and SQLite. No account or database server needed.</p></div></article><article><ShieldCheck size={20} /><div><h3>Clear boundaries, by default.</h3><p>Your local workspace stays local. Choose the separate online edition when you want to work with a team.</p></div></article></div>
      </section>
      <section id="getting-started" className="hp-container hp-section" aria-labelledby="hp-setup-title">
        <div className="hp-section-heading"><div><p className="hp-eyebrow">04 / Make yourself at home</p><h2 id="hp-setup-title">Two ways to get going.</h2></div><p>A shared workspace online, or a personal workspace on your machine. Start where you work best.</p></div>
        <div className="hp-setup-grid"><article className="hp-online"><div className="hp-card-eyebrow"><Sparkles size={17} /> OPENLINEAR ONLINE</div><h3>Open a tab.<br />Bring the team.</h3><p>Sign in with Google to get started with a hosted workspace for projects, issues, and conversations.</p><a className="hp-button" href="?app">Open the app <ArrowUpRight size={15} /></a><span className="hp-setup-footnote">Hosted separately · plan details in the app</span></article><article className="hp-local"><div className="hp-card-eyebrow"><Terminal size={17} /> RUN LOCALLY</div><h3>Your machine. Your workspace.</h3><p>{sourceUrl ? 'Get the source and open a terminal in the repository.' : 'Local setup requires access to the source repository. Open a terminal there to begin.'}<br />Requires Node.js 24 and npm 11.</p><div className="hp-terminal"><div className="hp-terminal-header"><span>Terminal</span><button type="button" onClick={() => { void copySetup(); }} aria-label={copyState === 'copied' ? 'Commands copied' : 'Copy setup commands'}>{copyState === 'copied' ? <Check size={14} /> : <Copy size={14} />}{copyState === 'copied' ? 'Copied' : 'Copy'}</button></div><pre><code>{setupCommand}</code></pre></div><p className="hp-setup-footnote">Then open <code>http://127.0.0.1:4174</code></p><span className="hp-copy-status" role="status">{copyState === 'failed' ? 'Couldn’t copy. Select the commands above and copy them manually.' : copyState === 'copied' ? 'Setup commands copied to clipboard.' : ''}</span></article></div>
      </section>
      <section className="hp-container hp-section hp-faq" aria-labelledby="hp-faq-title"><div><p className="hp-eyebrow">A few more details</p><h2 id="hp-faq-title">Good questions.</h2><p>The essentials before you start.</p></div><div className="hp-faq-list">{faqs.map(faq => <details key={faq.q}><summary>{faq.q}<ChevronDown size={16} /></summary><p>{faq.a}</p></details>)}</div></section>
      <section className="hp-container hp-final-cta"><p className="hp-eyebrow">Less managing. More making.</p><h2>Make room for your next idea.</h2><div><a className="hp-button" href="?app">Get started <ArrowRight size={15} /></a><a className="hp-text-link" href="#getting-started">Run it your way <ArrowRight size={15} /></a></div></section>
    </main>
    <footer className="hp-container hp-footer"><div className="hp-footer-top"><a className="hp-brand" href="/"><BrandMark />OpenLinear</a><nav aria-label="Footer navigation"><a href="#product">Product</a><a href="#getting-started">Setup guide</a><a href="/openlinear-license.txt">License</a><a href="#open-source">Open source</a></nav></div><div className="hp-footer-bottom"><p>An independent, open-source project inspired by Linear.<br />Not affiliated with or endorsed by Linear.</p><span>Independent project. AGPL-3.0-only.</span></div></footer>
  </div>;
}
