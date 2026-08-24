import { generateIssues, groupIssues, issueOrder } from './data.mjs';

const ROW_HEIGHT = 36;
const OVERSCAN = 8;
const issues = generateIssues(2000);
let filteredIssues = issues;
let entries = groupIssues(filteredIssues);
let selectedIssueId = issueOrder(entries)[0].id;
let lastTrigger = null;
let renderQueued = false;

const shell = document.querySelector('.app-shell');
const list = document.querySelector('#issue-list');
const content = document.querySelector('#virtual-content');
const detail = document.querySelector('#detail-panel');
const search = document.querySelector('#issue-search');
const count = document.querySelector('#result-count');
const commandDialog = document.querySelector('#command-dialog');
const createDialog = document.querySelector('#create-dialog');
const toast = document.querySelector('#toast');
const diagnostics = { errors: [], unhandledRejections: [] };

function publishDiagnostics() {
  document.documentElement.dataset.runtimeErrors = String(diagnostics.errors.length);
  document.documentElement.dataset.unhandledRejections = String(diagnostics.unhandledRejections.length);
}

window.addEventListener('error', (event) => {
  diagnostics.errors.push(event.message);
  publishDiagnostics();
});
window.addEventListener('unhandledrejection', (event) => {
  diagnostics.unhandledRejections.push(String(event.reason));
  publishDiagnostics();
});
publishDiagnostics();

function issueEntryIndex(issueId) {
  return entries.findIndex((entry) => entry.type === 'issue' && entry.issue.id === issueId);
}

function statusClass(issue) {
  return issue.status.tone === 'active' ? 'active' : issue.status.tone === 'success' ? 'success' : '';
}

function makeGroupRow(entry, index) {
  const row = document.createElement('div');
  row.className = 'virtual-row group-row';
  row.style.transform = `translateY(${index * ROW_HEIGHT}px)`;
  row.setAttribute('role', 'presentation');
  row.innerHTML = `<span aria-hidden="true">⌄</span><span>${entry.status.label}</span><span class="group-count">${entry.count}</span>`;
  return row;
}

function makeIssueRow(entry, index) {
  const issue = entry.issue;
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'virtual-row issue-row';
  row.dataset.issueId = issue.id;
  row.style.transform = `translateY(${index * ROW_HEIGHT}px)`;
  row.setAttribute('role', 'option');
  row.setAttribute('aria-selected', String(issue.id === selectedIssueId));
  row.setAttribute('aria-label', `${issue.id} ${issue.title}, ${issue.status.label}, ${issue.priority}`);
  row.innerHTML = `
    <span><span class="status-symbol ${statusClass(issue)}" aria-hidden="true"></span></span>
    <span class="issue-id">${issue.id}</span>
    <span class="issue-title">${issue.title}</span>
    <span class="priority ${issue.priority.toLowerCase()}">${issue.priority}</span>
    <span class="project">${issue.project}</span>
    <span class="owner-cell"><span class="avatar small">${issue.owner}</span></span>
  `;
  row.addEventListener('click', () => {
    selectIssue(issue.id);
    openDetail(issue.id, row);
  });
  return row;
}

function renderVirtualRows() {
  renderQueued = false;
  const start = Math.max(0, Math.floor(list.scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(list.clientHeight / ROW_HEIGHT) + OVERSCAN * 2;
  const end = Math.min(entries.length, start + visibleCount);
  const fragment = document.createDocumentFragment();
  for (let index = start; index < end; index += 1) {
    const entry = entries[index];
    fragment.append(entry.type === 'group' ? makeGroupRow(entry, index) : makeIssueRow(entry, index));
  }
  content.style.height = `${entries.length * ROW_HEIGHT}px`;
  content.replaceChildren(fragment);
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(renderVirtualRows);
}

function selectIssue(issueId) {
  selectedIssueId = issueId;
  queueRender();
}

function selectedIssue() {
  return filteredIssues.find((issue) => issue.id === selectedIssueId) ?? filteredIssues[0];
}

function ensureSelectedVisible() {
  const index = issueEntryIndex(selectedIssueId);
  if (index < 0) return;
  const top = index * ROW_HEIGHT;
  const bottom = top + ROW_HEIGHT;
  if (top < list.scrollTop) list.scrollTop = top;
  else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  queueRender();
}

function moveSelection(delta) {
  const orderedIssues = issueOrder(entries);
  if (orderedIssues.length === 0) return;
  const currentIndex = Math.max(0, orderedIssues.findIndex((issue) => issue.id === selectedIssueId));
  const nextIndex = Math.min(orderedIssues.length - 1, Math.max(0, currentIndex + delta));
  selectedIssueId = orderedIssues[nextIndex].id;
  ensureSelectedVisible();
}

function fillDetail(issue) {
  document.querySelector('#panel-identifier').textContent = issue.id;
  document.querySelector('#panel-title').textContent = issue.title;
  document.querySelector('#panel-description').textContent = issue.description;
  document.querySelector('#panel-priority').textContent = issue.priority;
  document.querySelector('#panel-project').textContent = issue.project;
  document.querySelector('#panel-owner').textContent = issue.owner;
  document.querySelector('#panel-owner-name').textContent = issue.owner;
  document.querySelector('#panel-due').textContent = issue.due || 'No due date';
  const statusButton = document.querySelector('#panel-status');
  statusButton.querySelector('.status-symbol').className = `status-symbol ${statusClass(issue)}`;
  statusButton.querySelector('span:last-child').textContent = issue.status.label;
  const labels = document.querySelector('#panel-labels');
  labels.replaceChildren(...issue.labels.map((label) => {
    const chip = document.createElement('span');
    chip.className = 'label-chip';
    chip.textContent = label;
    return chip;
  }));
}

function openDetail(issueId, trigger) {
  const issue = issues.find((item) => item.id === issueId);
  if (!issue) return;
  lastTrigger = trigger ?? document.querySelector(`[data-issue-id="${issueId}"]`);
  fillDetail(issue);
  shell.classList.add('panel-open');
  detail.setAttribute('aria-hidden', 'false');
  history.replaceState(null, '', `#issue=${encodeURIComponent(issueId)}`);
  document.querySelector('[data-close-detail]').focus({ preventScroll: true });
  queueRender();
}

function closeDetail() {
  if (!shell.classList.contains('panel-open')) return;
  shell.classList.remove('panel-open');
  detail.setAttribute('aria-hidden', 'true');
  history.replaceState(null, '', '#issues');
  queueRender();
  requestAnimationFrame(() => {
    const currentTrigger = document.querySelector(`[data-issue-id="${selectedIssueId}"]`) ?? lastTrigger;
    currentTrigger?.focus({ preventScroll: true });
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  window.setTimeout(() => toast.classList.remove('visible'), 1600);
}

function openCreate() {
  commandDialog.open && commandDialog.close();
  createDialog.showModal();
  requestAnimationFrame(() => document.querySelector('#new-issue-title').focus());
}

list.addEventListener('scroll', queueRender, { passive: true });
window.addEventListener('resize', queueRender);
document.querySelector('[data-close-detail]').addEventListener('click', closeDetail);
document.querySelectorAll('[data-open-command]').forEach((button) => button.addEventListener('click', () => commandDialog.showModal()));
document.querySelectorAll('[data-open-create]').forEach((button) => button.addEventListener('click', openCreate));
document.querySelector('[data-command-create]').addEventListener('click', (event) => {
  event.preventDefault();
  openCreate();
});

search.addEventListener('input', () => {
  const query = search.value.trim().toLowerCase();
  filteredIssues = query
    ? issues.filter((issue) => `${issue.id} ${issue.title} ${issue.project} ${issue.labels.join(' ')}`.toLowerCase().includes(query))
    : issues;
  entries = groupIssues(filteredIssues);
  selectedIssueId = issueOrder(entries)[0]?.id ?? '';
  count.textContent = filteredIssues.length.toLocaleString('en-US');
  list.scrollTop = 0;
  queueRender();
});

createDialog.addEventListener('close', () => {
  if (createDialog.returnValue === 'create') {
    const value = document.querySelector('#new-issue-title').value.trim();
    showToast(value ? `Created synthetic draft: ${value}` : 'Issue draft closed');
    document.querySelector('#new-issue-title').value = '';
  }
});

document.addEventListener('keydown', (event) => {
  const editable = event.target.matches('input, textarea, [contenteditable="true"]');
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (!commandDialog.open) commandDialog.showModal();
    return;
  }
  if (event.key === 'Escape') {
    if (createDialog.open) createDialog.close();
    else if (commandDialog.open) commandDialog.close();
    else closeDetail();
    return;
  }
  if (editable || commandDialog.open || createDialog.open) return;
  if (event.key.toLowerCase() === 'c') {
    event.preventDefault();
    openCreate();
  } else if (event.key.toLowerCase() === 'j' || event.key === 'ArrowDown') {
    event.preventDefault();
    moveSelection(1);
  } else if (event.key.toLowerCase() === 'k' || event.key === 'ArrowUp') {
    event.preventDefault();
    moveSelection(-1);
  } else if (event.key === 'Enter') {
    const issue = selectedIssue();
    if (issue) {
      event.preventDefault();
      openDetail(issue.id, document.querySelector(`[data-issue-id="${issue.id}"]`));
    }
  }
});

const initialIssue = new URLSearchParams(location.hash.replace(/^#/, '')).get('issue');
if (initialIssue && issues.some((issue) => issue.id === initialIssue)) {
  selectedIssueId = initialIssue;
  openDetail(initialIssue);
}

queueRender();
list.focus({ preventScroll: true });
window.__ct4 = {
  issueCount: issues.length,
  diagnostics,
  get renderedRows() { return content.children.length; },
  get selectedIssueId() { return selectedIssueId; },
};
