const statuses = [
  { id: 'backlog', label: 'Backlog', tone: 'muted' },
  { id: 'todo', label: 'Todo', tone: 'neutral' },
  { id: 'progress', label: 'In progress', tone: 'active' },
  { id: 'done', label: 'Done', tone: 'success' },
];

const projects = ['Northstar', 'Workspace core', 'Public beta', 'Reliability'];
const owners = ['AS', 'MC', 'RL', 'JK', 'NS', 'TD'];
const topics = [
  'Preserve scroll state after detail navigation',
  'Add deterministic milestone progress policy',
  'Scope full-text search to the active workspace',
  'Expose revision conflict without losing the draft',
  'Make project properties keyboard reachable',
  'Verify backup digest after restore',
  'Keep saved view filters versioned',
  'Audit activity ordering after concurrent updates',
  'Improve compact row focus visibility',
  'Add recovery path for archived issues',
];

function hash(value) {
  let state = 2166136261;
  for (const character of value) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  return state >>> 0;
}

export function generateIssues(count = 2000) {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 101;
    const seed = hash(`issue-${number}`);
    const status = statuses[seed % statuses.length];
    return {
      id: `FOC-${number}`,
      title: topics[seed % topics.length],
      status,
      priority: ['Urgent', 'High', 'Medium', 'Low'][Math.floor(seed / 7) % 4],
      project: projects[Math.floor(seed / 13) % projects.length],
      owner: owners[Math.floor(seed / 19) % owners.length],
      labels: [seed % 3 === 0 ? 'Frontend' : 'Platform', seed % 5 === 0 ? 'Security' : 'Core'],
      due: seed % 9 === 0 ? 'Aug 28' : '',
      description: 'Synthetic clean-room fixture for interaction, focus, and stable layout verification.',
      revision: 1,
    };
  });
}

export function groupIssues(issues) {
  return statuses.flatMap((status) => {
    const members = issues.filter((issue) => issue.status.id === status.id);
    return [
      { type: 'group', id: `group-${status.id}`, status, count: members.length },
      ...members.map((issue) => ({ type: 'issue', id: issue.id, issue })),
    ];
  });
}

export function issueOrder(entries) {
  return entries.filter((entry) => entry.type === 'issue').map((entry) => entry.issue);
}
