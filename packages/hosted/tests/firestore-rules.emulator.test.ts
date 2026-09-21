import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const projectId = 'demo-openlinear';
const workspaceAlpha = 'ws_rules_alpha';
const workspaceBeta = 'ws_rules_beta';
const workspaceMalformed = 'ws_rules_malformed';
const projectAlpha = `project_${'a'.repeat(32)}`;
const projectBeta = `project_${'b'.repeat(32)}`;
const projectPoisoned = `project_${'c'.repeat(32)}`;
const projectExtraField = `project_${'d'.repeat(32)}`;
const projectBadTimestamp = `project_${'e'.repeat(32)}`;
const projectBadChronology = `project_${'f'.repeat(32)}`;
const milestoneAlpha = `milestone_${'a'.repeat(32)}`;
const milestoneMalformed = `milestone_${'b'.repeat(32)}`;
const milestoneBadDate = `milestone_${'c'.repeat(32)}`;
const milestoneBadTimestamp = `milestone_${'d'.repeat(32)}`;
let environment: RulesTestEnvironment;

const rulesPath = fileURLToPath(new URL('../../../firestore.rules', import.meta.url));

async function seed(): Promise<void> {
  await environment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    const records: Array<[string, Record<string, unknown>]> = [
      [`workspaces/${workspaceAlpha}`, {
        schemaVersion: 1,
        id: workspaceAlpha,
        workspaceId: workspaceAlpha,
        name: 'Alpha',
        ownerUid: 'owner-alpha',
        authority: 'firebase-hosted',
        createdAt: '2027-01-01T00:00:00.000Z',
        revision: 1,
      }],
      [`workspaces/${workspaceBeta}`, {
        schemaVersion: 1,
        id: workspaceBeta,
        workspaceId: workspaceBeta,
        name: 'Beta',
        ownerUid: 'member-beta',
        authority: 'firebase-hosted',
        createdAt: '2027-01-01T00:00:00.000Z',
        revision: 1,
      }],
      [`workspaces/${workspaceMalformed}`, {
        schemaVersion: 1,
        id: workspaceMalformed,
        workspaceId: workspaceMalformed,
        name: 'Malformed workspace',
        ownerUid: 'malformed-workspace-user',
        authority: 'firebase-hosted',
        createdAt: '2027-01-01T00:00:00.000Z',
        revision: 1,
        privateSecret: 'must-not-be-client-readable',
      }],
      [`workspaces/${workspaceAlpha}/memberships/owner-alpha`, {
        schemaVersion: 1,
        id: 'mem-owner-alpha',
        workspaceId: workspaceAlpha,
        userId: 'owner-alpha',
        role: 'owner',
        status: 'active',
        createdAt: '2027-01-01T00:00:00.000Z',
        revision: 1,
      }],
      [`workspaces/${workspaceAlpha}/memberships/member-alpha`, {
        schemaVersion: 1,
        id: 'mem-member-alpha',
        workspaceId: workspaceAlpha,
        userId: 'member-alpha',
        role: 'member',
        status: 'active',
        createdAt: '2027-01-01T00:00:00.000Z',
        revision: 1,
      }],
      [`workspaces/${workspaceAlpha}/memberships/removed-alpha`, {
        schemaVersion: 1,
        id: 'mem-removed-alpha',
        workspaceId: workspaceAlpha,
        userId: 'removed-alpha',
        role: 'member',
        status: 'removed',
        createdAt: '2027-01-01T00:00:00.000Z',
        updatedAt: '2027-01-02T00:00:00.000Z',
        removedAt: '2027-01-02T00:00:00.000Z',
        revision: 2,
      }],
      [`workspaces/${workspaceAlpha}/memberships/custom-alpha`, {
        schemaVersion: 1,
        id: 'mem-custom-alpha',
        workspaceId: workspaceAlpha,
        userId: 'custom-alpha',
        role: 'administrator',
        status: 'active',
        createdAt: '2027-01-01T00:00:00.000Z',
        revision: 1,
      }],
      [`workspaces/${workspaceBeta}/memberships/member-beta`, {
        schemaVersion: 1,
        id: 'mem-member-beta',
        workspaceId: workspaceBeta,
        userId: 'member-beta',
        role: 'member',
        status: 'active',
        createdAt: '2027-01-01T00:00:00.000Z',
        revision: 1,
      }],
      [`workspaces/${workspaceMalformed}/memberships/malformed-workspace-user`, {
        schemaVersion: 1,
        id: 'mem-malformed-workspace-user',
        workspaceId: workspaceMalformed,
        userId: 'malformed-workspace-user',
        role: 'owner',
        status: 'active',
        createdAt: '2027-01-01T00:00:00.000Z',
        revision: 1,
      }],
      [`workspaces/${workspaceAlpha}/memberships/pending-alpha`, {
        schemaVersion: 1,
        id: 'mem-pending-alpha',
        workspaceId: workspaceAlpha,
        userId: 'pending-alpha',
        role: 'member',
        status: 'pending',
        createdAt: '2027-01-01T00:00:00.000Z',
        revision: 1,
      }],
      [`workspaces/${workspaceAlpha}/memberships/alias-alpha`, {
        schemaVersion: 1,
        id: 'mem-alias-alpha',
        workspaceId: workspaceAlpha,
        userId: 'foreign-user',
        role: 'member',
        status: 'active',
        createdAt: '2027-01-01T00:00:00.000Z',
        revision: 1,
      }],
      [`workspaces/${workspaceAlpha}/memberships/schema-alpha`, {
        schemaVersion: 2,
        id: 'mem-schema-alpha',
        workspaceId: workspaceAlpha,
        userId: 'schema-alpha',
        role: 'member',
        status: 'active',
        createdAt: '2027-01-01T00:00:00.000Z',
        revision: 1,
      }],
      [`workspaces/${workspaceAlpha}/memberships/extra-field-alpha`, {
        schemaVersion: 1,
        id: 'mem-extra-field-alpha',
        workspaceId: workspaceAlpha,
        userId: 'extra-field-alpha',
        role: 'member',
        status: 'active',
        createdAt: '2027-01-01T00:00:00.000Z',
        revision: 1,
        privateEmail: 'must-not-be-client-readable@example.com',
      }],
      [`workspaces/${workspaceAlpha}/memberships/bad-time-alpha`, {
        schemaVersion: 1,
        id: 'mem-bad-time-alpha',
        workspaceId: workspaceAlpha,
        userId: 'bad-time-alpha',
        role: 'member',
        status: 'active',
        createdAt: 'not-a-canonical-timestamp',
        revision: 1,
      }],
      [`workspaces/${workspaceAlpha}/projects/${projectAlpha}`, {
        schemaVersion: 1,
        id: projectAlpha,
        workspaceId: workspaceAlpha,
        name: 'Alpha project',
        summary: 'Visible project summary',
        status: 'in_progress',
        createdByUserId: 'owner-alpha',
        archivedAt: null,
        createdAt: '2027-01-01T00:00:00.000Z',
        updatedAt: '2027-01-01T00:00:00.000Z',
        revision: 1,
      }],
      [`workspaces/${workspaceAlpha}/projects/${projectPoisoned}`, {
        schemaVersion: 1,
        id: projectPoisoned,
        workspaceId: workspaceBeta,
        name: 'Mismatched workspace',
        summary: '',
        status: 'planned',
        createdByUserId: 'owner-alpha',
        archivedAt: null,
        createdAt: '2027-01-01T00:00:00.000Z',
        updatedAt: '2027-01-01T00:00:00.000Z',
        revision: 1,
      }],
      [`workspaces/${workspaceBeta}/projects/${projectBeta}`, {
        schemaVersion: 1,
        id: projectBeta,
        workspaceId: workspaceBeta,
        name: 'Beta project',
        summary: '',
        status: 'planned',
        createdByUserId: 'member-beta',
        archivedAt: null,
        createdAt: '2027-01-01T00:00:00.000Z',
        updatedAt: '2027-01-01T00:00:00.000Z',
        revision: 1,
      }],
      [`workspaces/${workspaceAlpha}/projects/${projectBadTimestamp}`, {
        schemaVersion: 1,
        id: projectBadTimestamp,
        workspaceId: workspaceAlpha,
        name: 'Invalid timestamp project',
        summary: '',
        status: 'planned',
        createdByUserId: 'owner-alpha',
        archivedAt: null,
        createdAt: 'not-a-canonical-timestamp',
        updatedAt: '2027-01-01T00:00:00.000Z',
        revision: 1,
      }],
      [`workspaces/${workspaceAlpha}/projects/${projectBadChronology}`, {
        schemaVersion: 1,
        id: projectBadChronology,
        workspaceId: workspaceAlpha,
        name: 'Invalid chronology project',
        summary: '',
        status: 'planned',
        createdByUserId: 'owner-alpha',
        archivedAt: null,
        createdAt: '2027-01-02T00:00:00.000Z',
        updatedAt: '2027-01-01T00:00:00.000Z',
        revision: 1,
      }],
      [`workspaces/${workspaceAlpha}/milestones/${milestoneAlpha}`, {
        schemaVersion: 1,
        id: milestoneAlpha,
        workspaceId: workspaceAlpha,
        projectId: projectAlpha,
        name: 'Alpha milestone',
        description: 'Visible milestone description',
        targetDate: '2027-02-28',
        createdByUserId: 'owner-alpha',
        archivedAt: null,
        createdAt: '2027-01-01T00:00:00.000Z',
        updatedAt: '2027-01-01T00:00:00.000Z',
        revision: 1,
      }],
      [`workspaces/${workspaceAlpha}/milestones/${milestoneMalformed}`, {
        schemaVersion: 1,
        id: `milestone_${'f'.repeat(32)}`,
        workspaceId: workspaceAlpha,
        projectId: projectAlpha,
        name: 'Malformed milestone',
        description: '',
        targetDate: null,
        createdByUserId: 'owner-alpha',
        archivedAt: null,
        createdAt: '2027-01-01T00:00:00.000Z',
        updatedAt: '2027-01-01T00:00:00.000Z',
        revision: 1,
      }],
      [`workspaces/${workspaceAlpha}/milestones/${milestoneBadDate}`, {
        schemaVersion: 1,
        id: milestoneBadDate,
        workspaceId: workspaceAlpha,
        projectId: projectAlpha,
        name: 'Impossible target date',
        description: '',
        targetDate: '2027-02-31',
        createdByUserId: 'owner-alpha',
        archivedAt: null,
        createdAt: '2027-01-01T00:00:00.000Z',
        updatedAt: '2027-01-01T00:00:00.000Z',
        revision: 1,
      }],
      [`workspaces/${workspaceAlpha}/milestones/${milestoneBadTimestamp}`, {
        schemaVersion: 1,
        id: milestoneBadTimestamp,
        workspaceId: workspaceAlpha,
        projectId: projectAlpha,
        name: 'Invalid timestamp milestone',
        description: '',
        targetDate: '2027-02-28',
        createdByUserId: 'owner-alpha',
        archivedAt: null,
        createdAt: '2027-01-01T00:00:00Z',
        updatedAt: '2027-01-01T00:00:00.000Z',
        revision: 1,
      }],
      [`workspaces/${workspaceAlpha}/projects/${projectAlpha}/milestones/nested-private`, {
        workspaceId: workspaceAlpha,
        privateSecret: 'must-not-be-client-readable',
      }],
      [`workspaces/${workspaceAlpha}/issues/issue-alpha`, {
        schemaVersion: 1,
        id: 'issue-alpha',
        workspaceId: workspaceAlpha,
        title: 'Alpha issue',
      }],
      [`workspaces/${workspaceAlpha}/issues/issue-alpha/comments/comment-alpha`, {
        schemaVersion: 1,
        id: 'comment-alpha',
        workspaceId: workspaceAlpha,
        body: 'Visible comment',
      }],
      [`workspaces/${workspaceAlpha}/issues/issue-poisoned`, {
        schemaVersion: 1,
        id: 'issue-poisoned',
        workspaceId: workspaceBeta,
        title: 'Mismatched parent',
      }],
      [`workspaces/${workspaceAlpha}/issues/issue-poisoned/comments/comment-child-alpha`, {
        schemaVersion: 1,
        id: 'comment-child-alpha',
        workspaceId: workspaceAlpha,
        body: 'Child of mismatched parent',
      }],
      [`workspaces/${workspaceAlpha}/entitlements/current`, {
        schemaVersion: 1,
        workspaceId: workspaceAlpha,
        plan: 'pro',
      }],
      [`workspaces/${workspaceAlpha}/authorizationAudits/audit-private`, {
        schemaVersion: 1,
        workspaceId: workspaceAlpha,
        denialReason: 'membership_missing',
      }],
      [`workspaces/${workspaceAlpha}/billing/current`, {
        schemaVersion: 1, workspaceId: workspaceAlpha, customerId: 'cus_private',
      }],
      [`workspaces/${workspaceAlpha}/billingCheckouts/checkout-private`, {
        schemaVersion: 1, workspaceId: workspaceAlpha, providerSessionId: 'cs_private',
      }],
      [`workspaces/${workspaceAlpha}/billingCheckoutSessions/session-private`, {
        schemaVersion: 1, workspaceId: workspaceAlpha, checkoutId: 'checkout-private',
      }],
      [`workspaces/${workspaceAlpha}/billingCheckoutLocks/current`, {
        schemaVersion: 1, workspaceId: workspaceAlpha, checkoutId: 'checkout-private',
      }],
      [`workspaces/${workspaceAlpha}/billingWebhooks/webhook-private`, {
        schemaVersion: 1, workspaceId: workspaceAlpha, eventReference: 'd'.repeat(64),
      }],
      [`workspaces/${workspaceAlpha}/billingIdempotency/member-remove-private`, {
        schemaVersion: 1, workspaceId: workspaceAlpha, operation: 'membership.remove',
        targetUserId: 'member-alpha', binding: 'e'.repeat(64),
      }],
      [`workspaces/${workspaceAlpha}/invitations/invite-private`, {
        schemaVersion: 1,
        id: 'invite-private',
        workspaceId: workspaceAlpha,
        invitedEmail: 'member@example.com',
        currentTokenDigest: 'a'.repeat(64),
      }],
      [`workspaces/${workspaceAlpha}/invitationIdempotency/idem-private`, {
        schemaVersion: 1,
        workspaceId: workspaceAlpha,
        requestReference: 'b'.repeat(64),
        binding: 'c'.repeat(64),
      }],
      [`workspaces/${workspaceAlpha}/pmIdempotency/pm-private`, {
        schemaVersion: 1, workspaceId: workspaceAlpha, requestDigest: 'd'.repeat(64),
      }],
      [`workspaces/${workspaceAlpha}/personalTokens/pat-private`, {
        schemaVersion: 1, workspaceId: workspaceAlpha, digest: 'e'.repeat(64),
      }],
      [`workspaces/${workspaceAlpha}/tokenIdempotency/token-private`, {
        schemaVersion: 1, workspaceId: workspaceAlpha, requestDigest: 'f'.repeat(64),
      }],
      [`workspaces/${workspaceAlpha}/productEvents/event-private`, {
        schemaVersion: 'openlinear.hosted-measurement.v1',
        workspaceId: workspaceAlpha,
        name: 'invitation.sent',
      }],
      [`workspaces/${workspaceAlpha}/mutationAudits/audit-invitation-private`, {
        schemaVersion: 'openlinear.hosted-measurement.v1',
        workspaceId: workspaceAlpha,
        action: 'invitation.send',
      }],
      ['_invitationTokens/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', {
        schemaVersion: 1,
        digest: 'a'.repeat(64),
        workspaceId: workspaceAlpha,
        invitationId: 'invite-private',
      }],
      ['hostedUsers/owner-alpha', {
        schemaVersion: 1,
        uid: 'owner-alpha',
        email: 'private@example.com',
      }],
    ];
    await Promise.all(records.map(([path, value]) => setDoc(doc(firestore, path), value)));
  });
}

describe('hosted Firestore workspace isolation rules', () => {
  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId,
      firestore: { rules: await readFile(rulesPath, 'utf8') },
    });
    await environment.clearFirestore();
    await seed();
  });

  afterAll(async () => {
    await environment.cleanup();
  });

  it('allows exact-workspace non-collaboration reads but keeps tasks and comments behind the trusted API', async () => {
    for (const userId of ['owner-alpha', 'member-alpha']) {
      const firestore = environment.authenticatedContext(userId).firestore();
      await assertSucceeds(getDoc(doc(firestore, `workspaces/${workspaceAlpha}`)));
      await assertSucceeds(getDoc(doc(
        firestore,
        `workspaces/${workspaceAlpha}/projects/${projectAlpha}`,
      )));
      await assertSucceeds(getDoc(doc(
        firestore,
        `workspaces/${workspaceAlpha}/milestones/${milestoneAlpha}`,
      )));
      await assertFails(getDoc(doc(
        firestore,
        `workspaces/${workspaceAlpha}/milestones/${milestoneMalformed}`,
      )));
      await assertFails(getDoc(doc(
        firestore,
        `workspaces/${workspaceAlpha}/issues/issue-alpha/comments/comment-alpha`,
      )));
      await assertFails(getDoc(doc(
        firestore,
        `workspaces/${workspaceAlpha}/issues/issue-alpha`,
      )));
      await assertFails(getDoc(doc(
        firestore,
        `workspaces/${workspaceBeta}/projects/${projectBeta}`,
      )));
      await assertFails(getDoc(doc(
        firestore,
        `workspaces/${workspaceAlpha}/projects/${projectPoisoned}`,
      )));
      await assertFails(getDoc(doc(
        firestore,
        `workspaces/${workspaceAlpha}/issues/issue-poisoned/comments/comment-child-alpha`,
      )));
    }

    const memberFirestore = environment.authenticatedContext('member-alpha').firestore();
    const malformedWorkspaceFirestore = environment
      .authenticatedContext('malformed-workspace-user').firestore();
    await assertFails(getDoc(doc(malformedWorkspaceFirestore, `workspaces/${workspaceMalformed}`)));
    await assertFails(getDocs(query(
      collection(memberFirestore, `workspaces/${workspaceAlpha}/projects`),
      where('workspaceId', '==', workspaceAlpha),
      where('schemaVersion', '==', 1),
    )));

    await environment.withSecurityRulesDisabled(async (admin) => {
      await setDoc(doc(
        admin.firestore(),
        `workspaces/${workspaceAlpha}/projects/${projectExtraField}`,
      ), {
        schemaVersion: 1,
        id: projectExtraField,
        workspaceId: workspaceAlpha,
        name: 'Malformed project',
        summary: '',
        status: 'planned',
        createdByUserId: 'owner-alpha',
        archivedAt: null,
        createdAt: '2027-01-01T00:00:00.000Z',
        updatedAt: '2027-01-01T00:00:00.000Z',
        revision: 1,
        privateToken: 'must-not-be-client-readable',
      });
    });
    await assertFails(getDoc(doc(
      memberFirestore,
      `workspaces/${workspaceAlpha}/projects/${projectExtraField}`,
    )));
    for (const malformedPath of [
      `workspaces/${workspaceAlpha}/projects/${projectBadTimestamp}`,
      `workspaces/${workspaceAlpha}/projects/${projectBadChronology}`,
      `workspaces/${workspaceAlpha}/milestones/${milestoneBadDate}`,
      `workspaces/${workspaceAlpha}/milestones/${milestoneBadTimestamp}`,
    ]) {
      await assertFails(getDoc(doc(memberFirestore, malformedPath)));
    }
    await assertFails(getDoc(doc(
      memberFirestore,
      `workspaces/${workspaceAlpha}/projects/${projectAlpha}/milestones/nested-private`,
    )));
    await assertFails(getDocs(collection(
      memberFirestore,
      `workspaces/${workspaceAlpha}/projects/${projectAlpha}/milestones`,
    )));
  });

  it('enforces the owner/member roster boundary without accepting custom roles', async () => {
    const ownerFirestore = environment.authenticatedContext('owner-alpha').firestore();
    const memberFirestore = environment.authenticatedContext('member-alpha').firestore();

    await assertSucceeds(getDoc(doc(
      ownerFirestore,
      `workspaces/${workspaceAlpha}/memberships/removed-alpha`,
    )));
    await assertFails(getDoc(doc(
      memberFirestore,
      `workspaces/${workspaceAlpha}/memberships/removed-alpha`,
    )));
    await assertSucceeds(getDoc(doc(
      memberFirestore,
      `workspaces/${workspaceAlpha}/memberships/owner-alpha`,
    )));
    await assertFails(getDoc(doc(
      ownerFirestore,
      `workspaces/${workspaceAlpha}/memberships/custom-alpha`,
    )));

    await assertFails(getDocs(query(
      collection(memberFirestore, `workspaces/${workspaceAlpha}/memberships`),
      where('workspaceId', '==', workspaceAlpha),
      where('status', '==', 'active'),
      where('role', 'in', ['owner', 'member']),
    )));

    for (const malformedId of [
      'pending-alpha',
      'alias-alpha',
      'schema-alpha',
      'extra-field-alpha',
      'bad-time-alpha',
    ]) {
      await assertFails(getDoc(doc(
        ownerFirestore,
        `workspaces/${workspaceAlpha}/memberships/${malformedId}`,
      )));
      await assertFails(getDoc(doc(
        memberFirestore,
        `workspaces/${workspaceAlpha}/memberships/${malformedId}`,
      )));
    }
  });

  it('denies removed, unrelated, unsupported-role, and unauthenticated principals', async () => {
    const protectedPath = `workspaces/${workspaceAlpha}/projects/${projectAlpha}`;
    const deniedContexts = [
      environment.authenticatedContext('removed-alpha'),
      environment.authenticatedContext('custom-alpha'),
      environment.authenticatedContext('pending-alpha'),
      environment.authenticatedContext('alias-alpha'),
      environment.authenticatedContext('schema-alpha'),
      environment.authenticatedContext('extra-field-alpha'),
      environment.authenticatedContext('bad-time-alpha'),
      environment.authenticatedContext('member-beta'),
      environment.unauthenticatedContext(),
    ];
    for (const context of deniedContexts) {
      await assertFails(getDoc(doc(context.firestore(), protectedPath)));
    }
  });

  it('keeps private identity, entitlement, and authorization evidence server-only', async () => {
    const firestore = environment.authenticatedContext('owner-alpha').firestore();
    for (const path of [
      'hostedUsers/owner-alpha',
      `workspaces/${workspaceAlpha}/entitlements/current`,
      `workspaces/${workspaceAlpha}/authorizationAudits/audit-private`,
      `workspaces/${workspaceAlpha}/billing/current`,
      `workspaces/${workspaceAlpha}/billingCheckouts/checkout-private`,
      `workspaces/${workspaceAlpha}/billingCheckoutSessions/session-private`,
      `workspaces/${workspaceAlpha}/billingCheckoutLocks/current`,
      `workspaces/${workspaceAlpha}/billingWebhooks/webhook-private`,
      `workspaces/${workspaceAlpha}/billingIdempotency/member-remove-private`,
      `workspaces/${workspaceAlpha}/invitations/invite-private`,
      `workspaces/${workspaceAlpha}/invitationIdempotency/idem-private`,
      `workspaces/${workspaceAlpha}/pmIdempotency/pm-private`,
      `workspaces/${workspaceAlpha}/personalTokens/pat-private`,
      `workspaces/${workspaceAlpha}/tokenIdempotency/token-private`,
      `workspaces/${workspaceAlpha}/productEvents/event-private`,
      `workspaces/${workspaceAlpha}/mutationAudits/audit-invitation-private`,
      '_invitationTokens/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '_ownerTrialEligibility/owner-alpha',
      'oauthClients/client-private',
      'oauthAuthorizationRequests/oauthreq-private',
      'oauthAuthorizationCodes/code-private',
      'oauthGrants/grant-private',
      'oauthTokenFamilies/family-private',
      'oauthAccessTokens/access-private',
      'oauthRefreshTokens/refresh-private',
      'operationsActivation/current',
      'operationsBudgetSignals/signal-private',
      'operationsBudgetState/current',
      'operationsRestoreDrills/restore-private',
    ]) {
      await assertFails(getDoc(doc(firestore, path)));
    }
    await assertFails(getDocs(collection(
      firestore,
      `workspaces/${workspaceAlpha}/invitations`,
    )));
    await assertFails(getDocs(collection(
      firestore,
      `workspaces/${workspaceAlpha}/billingCheckouts`,
    )));
    await assertFails(getDocs(collection(
      firestore,
      `workspaces/${workspaceAlpha}/billingCheckoutLocks`,
    )));
    await assertFails(getDocs(collection(
      firestore,
      `workspaces/${workspaceAlpha}/billingIdempotency`,
    )));
    await assertFails(getDocs(collection(
      firestore,
      `workspaces/${workspaceAlpha}/personalTokens`,
    )));
  });

  it('denies all direct client writes, including exact-workspace owner writes', async () => {
    const ownerFirestore = environment.authenticatedContext('owner-alpha').firestore();
    const memberFirestore = environment.authenticatedContext('member-alpha').firestore();
    await assertFails(setDoc(
      doc(ownerFirestore, `workspaces/${workspaceAlpha}/projects/project-owner-write`),
      { schemaVersion: 1, id: 'project-owner-write', workspaceId: workspaceAlpha },
    ));
    await assertFails(setDoc(
      doc(ownerFirestore, `workspaces/${workspaceAlpha}/billing/current`),
      {schemaVersion: 1, workspaceId: workspaceAlpha, status: 'active'},
    ));
    await assertFails(setDoc(
      doc(memberFirestore, `workspaces/${workspaceAlpha}/issues/issue-alpha`),
      { schemaVersion: 1, id: 'issue-alpha', workspaceId: workspaceAlpha, title: 'Changed' },
    ));
  });

  it('rechecks a reused authenticated context after membership removal', async () => {
    const context = environment.authenticatedContext('member-alpha');
    const protectedDocument = doc(
      context.firestore(),
      `workspaces/${workspaceAlpha}/projects/${projectAlpha}`,
    );
    await assertSucceeds(getDoc(protectedDocument));
    await environment.withSecurityRulesDisabled(async (admin) => {
      await setDoc(
        doc(admin.firestore(), `workspaces/${workspaceAlpha}/memberships/member-alpha`),
        {
          schemaVersion: 1,
          id: 'mem-member-alpha',
          workspaceId: workspaceAlpha,
          userId: 'member-alpha',
          role: 'member',
          status: 'removed',
          createdAt: '2027-01-01T00:00:00.000Z',
          updatedAt: '2027-01-02T00:00:00.000Z',
          removedAt: '2027-01-02T00:00:00.000Z',
          revision: 2,
        },
      );
    });
    await assertFails(getDoc(protectedDocument));
  });
});
