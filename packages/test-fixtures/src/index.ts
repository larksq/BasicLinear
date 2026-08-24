export const fixtureIds = {
  userA: '10000000-0000-4000-8000-000000000001',
  userB: '10000000-0000-4000-8000-000000000002',
  workspaceA: '20000000-0000-4000-8000-000000000001',
  workspaceB: '20000000-0000-4000-8000-000000000002',
  teamA: '30000000-0000-4000-8000-000000000001',
  teamB: '30000000-0000-4000-8000-000000000002',
} as const;

export const fixtureAccounts = {
  ownerA: { email: 'ada@example.test', displayName: 'Ada Chen' },
  ownerB: { email: 'grace@example.test', displayName: 'Grace Mensah' },
} as const;
