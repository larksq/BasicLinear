import { BrandMark } from './brand-mark.js';
import { HostedLogin } from './hosted-login.js';
import { useEffect, useRef, useState } from 'react';
import {
  acceptHostedInvitation,
  assignHostedIssue,
  bootstrapHostedOwner,
  createHostedBillingCheckout,
  createHostedComment,
  createHostedIssue,
  createHostedInvitation,
  createHostedPersonalToken,
  deleteHostedComment,
  decideHostedOAuthConsent,
  editHostedComment,
  getHostedBillingSummary,
  getHostedWorkspaceExport,
  getHostedOAuthConsent,
  hostedPersonalTokenScopes,
  HostedApiError,
  inspectHostedInvitation,
  listHostedComments,
  listHostedIssues,
  listHostedInvitations,
  listHostedMembers,
  listHostedPersonalTokens,
  listHostedTeams,
  listHostedWorkspaces,
  removeHostedMember,
  resendHostedInvitation,
  revokeHostedInvitation,
  revokeHostedPersonalToken,
  updateHostedIssue,
  type HostedBootstrapResponse,
  type HostedBillingPlan,
  type HostedBillingSummary,
  type HostedInvitation,
  type HostedInvitationAcceptanceResponse,
  type HostedInvitationPreview,
  type HostedCollaborationMember,
  type HostedComment,
  type HostedIssue,
  type HostedIssuePriority,
  type HostedIssueStatus,
  type HostedPersonalToken,
  type HostedPersonalTokenScope,
  type HostedOAuthConsentView,
  type HostedTeam,
  type HostedWorkspaceDirectoryEntry,
} from './hosted-api.js';
import {
  restoreHostedGoogleIdentity,
  signInWithGoogle,
  signOutHostedUser,
  subscribeHostedGoogleIdToken,
  type HostedGoogleIdentity,
} from './hosted-auth.js';
import { completeHostedOwnerSignIn } from './hosted-owner-entry.js';
import {HostedWorkspaceApplication} from './hosted-workspace.js';
import {
  readHostedBrowserEnvironment,
  type HostedProviderStatus,
} from './hosted-environment.js';

type HostedState =
  | {name: 'restoring'}
  | {name: 'idle'}
  | {name: 'signing-in'}
  | {name: 'bootstrapping'}
  | {name: 'identity-ready'; email: string; displayName: string | null}
  | {name: 'ready'; value: HostedBootstrapResponse; idToken: string; workspaces: HostedWorkspaceDirectoryEntry[]}
  | {name: 'error'; message: string};

type InviteeState =
  | {name: 'loading'}
  | {name: 'preview'; value: HostedInvitationPreview}
  | {name: 'signing-in'; value: HostedInvitationPreview}
  | {name: 'accepting'; value: HostedInvitationPreview}
  | {
    name: 'accepted';
    value: HostedInvitationAcceptanceResponse;
    idToken: string;
    email: string;
    displayName: string | null;
  }
  | {name: 'error'; preview: HostedInvitationPreview | null; code: string; message: string};

type OAuthConsentState =
  | {name: 'idle'}
  | {name: 'signing-in'}
  | {name: 'loading'; idToken: string; email: string}
  | {name: 'ready'; idToken: string; email: string; value: HostedOAuthConsentView}
  | {name: 'deciding'; idToken: string; email: string; value: HostedOAuthConsentView; decision: 'approve' | 'deny'}
  | {name: 'error'; message: string};

export interface HostedOAuthWorkspaceSelection {
  responseType: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource: string;
}

type OAuthWorkspaceSelectionState =
  | {name: 'restoring'}
  | {name: 'idle'}
  | {name: 'signing-in'}
  | {name: 'loading'; email: string}
  | {name: 'ready'; idToken: string; email: string; workspaces: HostedWorkspaceDirectoryEntry[]}
  | {name: 'error'; message: string};

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

function Mark() {
  return <BrandMark className="hosted-mark" />;
}

export function HostedOAuthClientIdentity({client}: {
  client: Readonly<{id: string; name: string}>;
}) {
  return <>{client.name}<small>Client ID <code>{client.id}</code></small></>;
}

function sessionIdempotencyKey(storageKey: string): string {
  const existing = sessionStorage.getItem(storageKey);
  if (existing !== null) return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(storageKey, created);
  return created;
}

function clearSessionIdempotencyKey(storageKey: string): void {
  sessionStorage.removeItem(storageKey);
}

function bootstrapIdempotencyKey(uid: string): string {
  return sessionIdempotencyKey(`openlinear.hosted.bootstrap.${uid}`);
}

function invitationAcceptanceStorageKey(invitationId: string, uid: string): string {
  return `openlinear.hosted.invitation.accept.${encodeURIComponent(invitationId)}.${encodeURIComponent(uid)}`;
}

function activeWorkspaceStorageKey(uid: string): string {
  return `openlinear.hosted.active-workspace.${encodeURIComponent(uid)}`;
}

function invitationTokenFromLocation(): string | null {
  if (window.location.hash.length < 2) return null;
  return new URLSearchParams(window.location.hash.slice(1)).get('invite');
}

function oauthRequestFromLocation(): string | null {
  const values = new URLSearchParams(window.location.search).getAll('oauth_request');
  if (values.length !== 1 || !/^oauthreq_[a-f0-9]{32}$/u.test(values[0] ?? '')) return null;
  return values[0] ?? null;
}

const oauthWorkspaceSelectionQueryKeys = [
  'oauth_workspace', 'response_type', 'client_id', 'redirect_uri', 'scope', 'state',
  'code_challenge', 'code_challenge_method', 'resource',
] as const;

export function oauthWorkspaceSelectionFromSearch(search: string): HostedOAuthWorkspaceSelection | null {
  const params = new URLSearchParams(search);
  const allowed = new Set<string>(oauthWorkspaceSelectionQueryKeys);
  if ([...params.keys()].some((key) => !allowed.has(key))) return null;
  const values = Object.fromEntries(oauthWorkspaceSelectionQueryKeys.map((key) => [key, params.getAll(key)]));
  if (values.oauth_workspace?.length !== 1 || values.oauth_workspace[0] !== 'select'
    || oauthWorkspaceSelectionQueryKeys.slice(1).some((key) => (
      values[key]?.length !== 1 || values[key]?.[0]?.trim() === ''
    ))) return null;
  return {
    responseType: values.response_type?.[0] ?? '',
    clientId: values.client_id?.[0] ?? '',
    redirectUri: values.redirect_uri?.[0] ?? '',
    scope: values.scope?.[0] ?? '',
    state: values.state?.[0] ?? '',
    codeChallenge: values.code_challenge?.[0] ?? '',
    codeChallengeMethod: values.code_challenge_method?.[0] ?? '',
    resource: values.resource?.[0] ?? '',
  };
}

function oauthWorkspaceSelectionFromLocation(): HostedOAuthWorkspaceSelection | null {
  return oauthWorkspaceSelectionFromSearch(window.location.search);
}

function oauthWorkspaceSelectionWasRequested(): boolean {
  return new URLSearchParams(window.location.search).has('oauth_workspace');
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof HostedApiError) return error.message;
  return 'Google sign-in or the hosted request could not be completed. Please try again.';
}

function absoluteInviteUrl(value: string | null): string | null {
  return value === null ? null : new URL(value, window.location.origin).toString();
}

export function restoreCommentEditButtonFocus(
  editingCommentId: string | null,
  pending: boolean,
  restoreCommentId: string | null,
  buttons: ReadonlyMap<string, Pick<HTMLButtonElement, 'disabled' | 'focus'>>,
): string | null {
  if (editingCommentId !== null || pending || restoreCommentId === null) return restoreCommentId;
  const button = buttons.get(restoreCommentId);
  if (button === undefined || button.disabled) return restoreCommentId;
  button.focus();
  return null;
}

function InvitationManager({
  idToken,
  workspaceId,
  workspaceName,
}: {
  idToken: string;
  workspaceId: string;
  workspaceName: string;
}) {
  const [invitations, setInvitations] = useState<HostedInvitation[]>([]);
  const [teams, setTeams] = useState<HostedTeam[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [emails, setEmails] = useState('');
  const [shareLinks, setShareLinks] = useState<Array<{email: string; url: string}>>([]);
  const [status, setStatus] = useState('Loading invitations…');
  const [pending, setPending] = useState(false);

  const load = async () => {
    try {
      const [values, teamValues] = await Promise.all([
        listHostedInvitations(idToken, workspaceId),
        listHostedTeams(idToken, workspaceId),
      ]);
      setInvitations(values);
      setTeams(teamValues);
      setSelectedTeamIds((current) => {
        const available = current.filter((teamId) => teamValues.some((team) => team.id === teamId));
        return available.length > 0 ? available : (teamValues[0] === undefined ? [] : [teamValues[0].id]);
      });
      setStatus(values.length === 0 ? 'No invitations yet.' : `${values.length} invitation${values.length === 1 ? '' : 's'}.`);
    } catch (error) {
      setStatus(safeErrorMessage(error));
    }
  };

  useEffect(() => {
    void load();
  }, [idToken, workspaceId]);

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requestedEmails = [...new Set(emails.split(/[\s,;]+/u).map((value) => value.trim().toLocaleLowerCase()).filter(Boolean))];
    if (requestedEmails.length < 1 || requestedEmails.length > 25) {
      setStatus('Enter between 1 and 25 Google account email addresses.');
      return;
    }
    setPending(true);
    setShareLinks([]);
    const nextLinks: Array<{email: string; url: string}> = [];
    try {
      for (const email of requestedEmails) {
        const storageKey = `openlinear.hosted.invitation.create.${encodeURIComponent(email)}`;
        const result = await createHostedInvitation(
          idToken,
          workspaceId,
          email,
          sessionIdempotencyKey(storageKey),
          selectedTeamIds,
        );
        clearSessionIdempotencyKey(storageKey);
        const url = absoluteInviteUrl(result.inviteUrl);
        if (url !== null) nextLinks.push({email, url});
      }
      setEmails('');
      setShareLinks(nextLinks);
      await load();
      setStatus(`${requestedEmails.length} invitation${requestedEmails.length === 1 ? '' : 's'} ready. Copy each private link and send it to the matching person.`);
    } catch (error) {
      setShareLinks(nextLinks);
      await load();
      setStatus(nextLinks.length > 0
        ? `${nextLinks.length} invitation${nextLinks.length === 1 ? '' : 's'} created before the remaining request stopped. Copy the private link${nextLinks.length === 1 ? '' : 's'} below, then retry only the missing email addresses.`
        : safeErrorMessage(error));
    } finally {
      setPending(false);
    }
  };

  const act = async (invitation: HostedInvitation, action: 'resend' | 'revoke') => {
    if (action === 'revoke' && !window.confirm(
      `Revoke the invitation for ${invitation.invitedEmail}? Its current link will stop working.`,
    )) return;
    setPending(true);
    setShareLinks([]);
    const storageKey = `openlinear.hosted.invitation.${action}.${invitation.id}`;
    try {
      const result = action === 'resend'
        ? await resendHostedInvitation(
          idToken,
          workspaceId,
          invitation.id,
          sessionIdempotencyKey(storageKey),
        )
        : await revokeHostedInvitation(
          idToken,
          workspaceId,
          invitation.id,
          sessionIdempotencyKey(storageKey),
        );
      clearSessionIdempotencyKey(storageKey);
      const nextUrl = absoluteInviteUrl(result.inviteUrl);
      if (nextUrl !== null) setShareLinks([{email: invitation.invitedEmail, url: nextUrl}]);
      await load();
      setStatus(action === 'resend'
        ? 'A new private link replaced the previous link. Copy and share the new link.'
        : 'Invitation revoked. Its current link can no longer be accepted.');
    } catch (error) {
      setStatus(safeErrorMessage(error));
    } finally {
      setPending(false);
    }
  };

  const copy = async (shareUrl: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setStatus('Private invitation link copied.');
    } catch {
      setStatus('Copy the selected private invitation link manually.');
    }
  };

  return (
    <section className="hosted-invitations" aria-labelledby="hosted-invitations-title">
      <div className="hosted-section-heading">
        <div>
          <p className="hosted-eyebrow">Team access</p>
          <h2 id="hosted-invitations-title">Invite people to {workspaceName}</h2>
        </div>
        <p>Add up to 25 Google accounts. Pending invitations are not billed and do not count as active seats.</p>
      </div>
      <form className="hosted-invite-form" onSubmit={(event) => { void create(event); }}>
        <label htmlFor="hosted-invite-email">Email addresses</label>
        <div>
          <textarea
            id="hosted-invite-email"
            required
            value={emails}
            disabled={pending}
            placeholder="alex@example.com, sam@example.com"
            onChange={(event) => {
              setEmails(event.currentTarget.value);
            }}
          />
          <button className="hosted-button primary" type="submit" disabled={pending}>
            {pending ? 'Sending…' : 'Send invites'}
          </button>
        </div>
        <fieldset className="hosted-team-picker">
          <legend>Add to teams <span>Optional</span></legend>
          <div>{teams.map((team) => <label key={team.id}>
            <input
              type="checkbox"
              checked={selectedTeamIds.includes(team.id)}
              disabled={pending}
              onChange={(event) => setSelectedTeamIds((current) => event.currentTarget.checked
                ? [...new Set([...current, team.id])]
                : current.filter((teamId) => teamId !== team.id))}
            />
            <span style={{backgroundColor: team.color}} aria-hidden="true" />
            {team.name}
          </label>)}</div>
        </fieldset>
        <p>Separate addresses with commas, spaces, semicolons, or new lines. Everyone joins the workspace as a member; selected teams are assigned when they accept.</p>
      </form>
      {shareLinks.length > 0 ? <div className="hosted-share-links" aria-label="Private invitation links">{shareLinks.map((link, index) => (
        <div className="hosted-share-link" role="group" aria-label={`Private invitation link for ${link.email}`} key={link.email}>
          <label htmlFor={`hosted-share-link-${index}`}>{link.email}</label>
          <div><input id={`hosted-share-link-${index}`} readOnly value={link.url} onFocus={(event) => event.currentTarget.select()} /><button className="hosted-button secondary" type="button" onClick={() => { void copy(link.url); }}>Copy link</button></div>
        </div>
      ))}<p>Each one-time link is private, expires after seven days, and works only for its matching Google account.</p></div> : null}
      <div className="hosted-status" aria-live="polite">{status}</div>
      {invitations.length > 0 ? (
        <ul className="hosted-invitation-list">
          {invitations.map((invitation) => (
            <li key={invitation.id}>
              <div>
                <strong>{invitation.invitedEmail}</strong>
                <span className={`hosted-state ${invitation.state}`}>{invitation.state}</span>
                <small>
                  Member · expires <time dateTime={invitation.expiresAt}>{dateTimeFormatter.format(new Date(invitation.expiresAt))} UTC</time>
                  {' · '}sent {invitation.sendCount} time{invitation.sendCount === 1 ? '' : 's'}
                  {(invitation.teamIds?.length ?? 0) > 0 ? ` · ${invitation.teamIds?.map((teamId) => teams.find((team) => team.id === teamId)?.name ?? 'Team').join(', ')}` : ''}
                </small>
              </div>
              <div className="hosted-row-actions">
                {(invitation.state === 'pending' || invitation.state === 'expired') ? (
                  <button className="hosted-button secondary" type="button" disabled={pending} onClick={() => { void act(invitation, 'resend'); }}>Resend</button>
                ) : null}
                {(invitation.state === 'pending' || invitation.state === 'expired') ? (
                  <button className="hosted-button danger" type="button" disabled={pending} onClick={() => { void act(invitation, 'revoke'); }}>Revoke</button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

const issueStatusLabels: Record<HostedIssueStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

const issuePriorityLabels: Record<HostedIssuePriority, string> = {
  no_priority: 'No priority',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export function WorkspaceBoard({
  idToken,
  workspaceId,
  role,
  currentUserId,
}: {
  idToken: string;
  workspaceId: string;
  role: 'owner' | 'member';
  currentUserId: string;
}) {
  const [issues, setIssues] = useState<HostedIssue[]>([]);
  const [members, setMembers] = useState<HostedCollaborationMember[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [comments, setComments] = useState<HostedComment[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');
  const [status, setStatus] = useState('Loading team work…');
  const [pending, setPending] = useState(false);
  const commentEditButtons = useRef(new Map<string, HTMLButtonElement>());
  const restoreCommentFocusId = useRef<string | null>(null);
  const selectedIssue = issues.find((issue) => issue.id === selectedIssueId) ?? null;

  useEffect(() => {
    restoreCommentFocusId.current = restoreCommentEditButtonFocus(
      editingCommentId,
      pending,
      restoreCommentFocusId.current,
      commentEditButtons.current,
    );
  }, [editingCommentId, comments, pending]);

  const loadIssues = async () => {
    const values = await listHostedIssues(idToken, workspaceId);
    setIssues(values);
    setSelectedIssueId((current) => current !== null && values.some((issue) => issue.id === current)
      ? current
      : values[0]?.id ?? null);
    return values;
  };

  const loadComments = async (issueId: string) => {
    const values = await listHostedComments(idToken, workspaceId, issueId);
    setComments(values);
  };

  useEffect(() => {
    let active = true;
    void Promise.all([
      listHostedIssues(idToken, workspaceId),
      listHostedMembers(idToken, workspaceId),
    ]).then(([nextIssues, nextMembers]) => {
      if (!active) return;
      setIssues(nextIssues);
      setMembers(nextMembers);
      setSelectedIssueId(nextIssues[0]?.id ?? null);
      setStatus(nextIssues.length === 0 ? 'No tasks yet. Create the first focused task.' : `${nextIssues.length} task${nextIssues.length === 1 ? '' : 's'} loaded.`);
    }).catch((error: unknown) => {
      if (active) setStatus(safeErrorMessage(error));
    });
    return () => { active = false; };
  }, [idToken, workspaceId]);

  useEffect(() => {
    const refreshMembers = (event: Event) => {
      if (!(event instanceof CustomEvent) || event.detail !== workspaceId) return;
      void listHostedMembers(idToken, workspaceId).then((values) => {
        setMembers(values);
        setStatus('Active member options refreshed after the seat change.');
      }).catch((error: unknown) => {
        setStatus(safeErrorMessage(error));
      });
    };
    window.addEventListener('openlinear:members-changed', refreshMembers);
    return () => { window.removeEventListener('openlinear:members-changed', refreshMembers); };
  }, [idToken, workspaceId]);

  useEffect(() => {
    if (selectedIssueId === null) {
      setComments([]);
      return;
    }
    let active = true;
    void listHostedComments(idToken, workspaceId, selectedIssueId).then((values) => {
      if (active) setComments(values);
    }).catch((error: unknown) => {
      if (active) setStatus(safeErrorMessage(error));
    });
    return () => { active = false; };
  }, [idToken, workspaceId, selectedIssueId]);

  const createIssue = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const storageKey = `openlinear.hosted.issue.create.${workspaceId}`;
    setPending(true);
    try {
      const issue = await createHostedIssue(
        idToken, workspaceId, newTitle, sessionIdempotencyKey(storageKey),
      );
      clearSessionIdempotencyKey(storageKey);
      setNewTitle('');
      await loadIssues();
      setSelectedIssueId(issue.id);
      setStatus('Task created. Assign it or open it for comments.');
    } catch (error) {
      setStatus(safeErrorMessage(error));
    } finally {
      setPending(false);
    }
  };

  const editIssue = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedIssue === null) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') ?? '');
    const nextStatus = String(form.get('status') ?? 'todo') as HostedIssueStatus;
    const priority = String(form.get('priority') ?? 'no_priority') as HostedIssuePriority;
    if (
      title === selectedIssue.title
      && nextStatus === selectedIssue.status
      && priority === selectedIssue.priority
    ) {
      setStatus('No task changes to save.');
      return;
    }
    const storageKey = `openlinear.hosted.issue.update.${selectedIssue.id}`;
    setPending(true);
    try {
      const updated = await updateHostedIssue(
        idToken,
        workspaceId,
        selectedIssue.id,
        selectedIssue.revision,
        {
          title,
          status: nextStatus,
          priority,
        },
        sessionIdempotencyKey(storageKey),
      );
      clearSessionIdempotencyKey(storageKey);
      setIssues((values) => values.map((issue) => issue.id === updated.id ? updated : issue));
      setStatus('Task updated. Concurrent stale edits are rejected with a refresh prompt.');
    } catch (error) {
      setStatus(error instanceof HostedApiError && error.code === 'COLLABORATION_CONFLICT'
        ? 'This task changed elsewhere. Refresh the task and try your edit again.'
        : safeErrorMessage(error));
      await loadIssues().catch(() => undefined);
    } finally {
      setPending(false);
    }
  };

  const assign = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (selectedIssue === null) return;
    const storageKey = `openlinear.hosted.issue.assign.${selectedIssue.id}`;
    clearSessionIdempotencyKey(storageKey);
    setPending(true);
    try {
      const updated = await assignHostedIssue(
        idToken, workspaceId, selectedIssue.id, selectedIssue.revision,
        event.currentTarget.value === '' ? null : event.currentTarget.value,
        sessionIdempotencyKey(storageKey),
      );
      clearSessionIdempotencyKey(storageKey);
      setIssues((values) => values.map((issue) => issue.id === updated.id ? updated : issue));
      setStatus(updated.assigneeUserId === null ? 'Task is unassigned.' : 'Task assigned to an active workspace member.');
    } catch (error) {
      setStatus(safeErrorMessage(error));
      await loadIssues().catch(() => undefined);
    } finally {
      setPending(false);
    }
  };

  const createComment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedIssue === null) return;
    const storageKey = `openlinear.hosted.comment.create.${selectedIssue.id}`;
    setPending(true);
    try {
      await createHostedComment(
        idToken, workspaceId, selectedIssue.id, commentDraft,
        sessionIdempotencyKey(storageKey),
      );
      clearSessionIdempotencyKey(storageKey);
      setCommentDraft('');
      await loadComments(selectedIssue.id);
      setStatus('Comment added without copying its body into audit evidence.');
    } catch (error) {
      setStatus(safeErrorMessage(error));
    } finally {
      setPending(false);
    }
  };

  const saveComment = async (comment: HostedComment) => {
    if (selectedIssue === null) return;
    const storageKey = `openlinear.hosted.comment.edit.${comment.id}`;
    setPending(true);
    try {
      await editHostedComment(
        idToken, workspaceId, selectedIssue.id, comment.id, comment.revision,
        editingBody, sessionIdempotencyKey(storageKey),
      );
      clearSessionIdempotencyKey(storageKey);
      setEditingCommentId(null);
      await loadComments(selectedIssue.id);
      setStatus('Comment edited. Its author and creation time were preserved.');
    } catch (error) {
      setStatus(safeErrorMessage(error));
      await loadComments(selectedIssue.id).catch(() => undefined);
    } finally {
      setPending(false);
    }
  };

  const removeComment = async (comment: HostedComment) => {
    if (selectedIssue === null || !window.confirm('Delete this comment? A content-free history tombstone will remain.')) return;
    const storageKey = `openlinear.hosted.comment.delete.${comment.id}`;
    setPending(true);
    try {
      await deleteHostedComment(
        idToken, workspaceId, selectedIssue.id, comment.id, comment.revision,
        sessionIdempotencyKey(storageKey),
      );
      clearSessionIdempotencyKey(storageKey);
      await loadComments(selectedIssue.id);
      setStatus('Comment deleted. Author and timestamp history remain visible.');
    } catch (error) {
      setStatus(safeErrorMessage(error));
      await loadComments(selectedIssue.id).catch(() => undefined);
    } finally {
      setPending(false);
    }
  };

  const memberLabel = (userId: string | null) => {
    if (userId === null) return 'Unassigned';
    return members.some((memberValue) => memberValue.userId === userId)
      ? userId
      : `Removed member · ${userId}`;
  };
  const canEditSelected = selectedIssue !== null
    && (role === 'owner' || selectedIssue.assigneeUserId === currentUserId);

  return (
    <section className="hosted-work" aria-labelledby="hosted-work-title">
      <div className="hosted-section-heading">
        <div><p className="hosted-eyebrow">Team work</p><h2 id="hosted-work-title">Tasks and comments</h2></div>
        <p>{role === 'member' ? 'Open assigned work, update it, and leave durable comments.' : 'Create focused work, assign one active member, and follow the discussion.'}</p>
      </div>
      <form className="hosted-task-create" onSubmit={(event) => { void createIssue(event); }}>
        <label htmlFor="hosted-new-task">New task</label>
        <div>
          <input id="hosted-new-task" required maxLength={200} value={newTitle} disabled={pending}
            placeholder="A concrete product-management task"
            onChange={(event) => {
              clearSessionIdempotencyKey(`openlinear.hosted.issue.create.${workspaceId}`);
              setNewTitle(event.currentTarget.value);
            }} />
          <button className="hosted-button primary" type="submit" disabled={pending}>Create task</button>
        </div>
      </form>
      <div className="hosted-work-grid">
        <nav aria-label={role === 'member' ? 'Workspace tasks, including My Work' : 'Workspace tasks'}>
          <h3>{role === 'member' ? 'My Work and workspace tasks' : 'Workspace tasks'}</h3>
          {issues.length === 0 ? <p>No tasks yet.</p> : (
            <ul className="hosted-task-list">
              {issues.map((issue) => (
                <li key={issue.id}>
                  <button type="button" aria-current={issue.id === selectedIssueId ? 'true' : undefined}
                    onClick={() => setSelectedIssueId(issue.id)}>
                    <strong>{issue.title}</strong>
                    <span>{issueStatusLabels[issue.status]} · {memberLabel(issue.assigneeUserId)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>
        <div className="hosted-task-detail">
          {selectedIssue === null ? <p>Select or create a task.</p> : (
            <>
              <div className="hosted-task-meta">
                <span>{issuePriorityLabels[selectedIssue.priority]}</span>
                <span>Revision {selectedIssue.revision}</span>
              </div>
              {role === 'owner' ? (
                <label className="hosted-assignee">Assignee
                  <select value={selectedIssue.assigneeUserId ?? ''} disabled={pending} onChange={(event) => { void assign(event); }}>
                    <option value="">Unassigned</option>
                    {selectedIssue.assigneeUserId !== null
                      && !members.some((memberValue) => memberValue.userId === selectedIssue.assigneeUserId) ? (
                        <option value={selectedIssue.assigneeUserId} disabled>
                          Removed member · {selectedIssue.assigneeUserId}
                        </option>
                      ) : null}
                    {members.map((memberValue) => <option key={memberValue.userId} value={memberValue.userId}>{memberValue.userId} · {memberValue.role}</option>)}
                  </select>
                </label>
              ) : <p className="hosted-assignee-note">Assignee: {memberLabel(selectedIssue.assigneeUserId)}</p>}
              <form key={`${selectedIssue.id}:${selectedIssue.revision}`} className="hosted-task-edit"
                onSubmit={(event) => { void editIssue(event); }} onChange={() => clearSessionIdempotencyKey(`openlinear.hosted.issue.update.${selectedIssue.id}`)}>
                <label>Title<input name="title" required maxLength={200} defaultValue={selectedIssue.title} disabled={!canEditSelected || pending} /></label>
                <div>
                  <label>Status<select name="status" defaultValue={selectedIssue.status} disabled={!canEditSelected || pending}>
                    {Object.entries(issueStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select></label>
                  <label>Priority<select name="priority" defaultValue={selectedIssue.priority} disabled={!canEditSelected || pending}>
                    {Object.entries(issuePriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select></label>
                </div>
                <button className="hosted-button secondary" type="submit" disabled={!canEditSelected || pending}>Save task</button>
                {!canEditSelected ? <small>Members can update tasks assigned to them.</small> : null}
              </form>
              <section className="hosted-comments" aria-labelledby="hosted-comments-title">
                <h3 id="hosted-comments-title">Comments</h3>
                <ul>
                  {comments.map((comment) => (
                    <li key={comment.id}>
                      <div><strong>{comment.authorUserId}</strong><time dateTime={comment.createdAt}>{dateTimeFormatter.format(new Date(comment.createdAt))} UTC</time></div>
                      {comment.deletedAt !== null ? <p className="hosted-comment-deleted">Comment deleted · history preserved</p>
                        : editingCommentId === comment.id ? (
                          <div className="hosted-comment-edit">
                            <label htmlFor={`hosted-comment-edit-${comment.id}`}>
                              Edit comment by {comment.authorUserId}
                            </label>
                            <textarea id={`hosted-comment-edit-${comment.id}`} autoFocus maxLength={4000}
                              value={editingBody} disabled={pending} onChange={(event) => {
                              clearSessionIdempotencyKey(`openlinear.hosted.comment.edit.${comment.id}`);
                              setEditingBody(event.currentTarget.value);
                            }} />
                            <div><button className="hosted-button secondary" type="button" disabled={pending} onClick={() => { void saveComment(comment); }}>Save</button>
                              <button className="hosted-button secondary" type="button" disabled={pending} onClick={() => {
                                restoreCommentFocusId.current = comment.id;
                                setEditingCommentId(null);
                              }}>Cancel</button></div>
                          </div>
                        ) : <p>{comment.body}</p>}
                      {comment.deletedAt === null && editingCommentId !== comment.id
                        && (role === 'owner' || comment.authorUserId === currentUserId) ? (
                          <div className="hosted-row-actions">
                            <button className="hosted-button secondary" type="button" disabled={pending}
                              ref={(element) => {
                                if (element === null) commentEditButtons.current.delete(comment.id);
                                else commentEditButtons.current.set(comment.id, element);
                              }}
                              onClick={() => {
                                restoreCommentFocusId.current = comment.id;
                                setEditingCommentId(comment.id);
                                setEditingBody(comment.body ?? '');
                              }}>Edit</button>
                            <button className="hosted-button danger" type="button" disabled={pending} onClick={() => { void removeComment(comment); }}>Delete</button>
                          </div>
                        ) : null}
                    </li>
                  ))}
                </ul>
                <form className="hosted-comment-create" onSubmit={(event) => { void createComment(event); }}>
                  <label htmlFor="hosted-new-comment">Add comment</label>
                  <textarea id="hosted-new-comment" required maxLength={4000} value={commentDraft} disabled={pending}
                    onChange={(event) => {
                      clearSessionIdempotencyKey(`openlinear.hosted.comment.create.${selectedIssue.id}`);
                      setCommentDraft(event.currentTarget.value);
                    }} />
                  <button className="hosted-button primary" type="submit" disabled={pending}>Comment</button>
                </form>
              </section>
            </>
          )}
        </div>
      </div>
      <div className="hosted-status" aria-live="polite">{status}</div>
    </section>
  );
}

function dollars(cents: number): string {
  const amount = cents / 100;
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function hostedPersonalTokenStatus(
  token: Pick<HostedPersonalToken, 'expiresAt' | 'revokedAt'>,
  now = Date.now(),
): 'Active' | 'Expired' | 'Revoked' {
  if (token.revokedAt !== null) return 'Revoked';
  return Date.parse(token.expiresAt) <= now ? 'Expired' : 'Active';
}

function downloadText(filename: string, contents: string, mediaType: string): void {
  const url = URL.createObjectURL(new Blob([contents], {type: mediaType}));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  try {
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function AutomationPanel({idToken, workspaceId}: {idToken: string; workspaceId: string}) {
  const defaultScopes: HostedPersonalTokenScope[] = [
    'workspace:read', 'projects:read', 'milestones:read', 'issues:read', 'comments:read',
  ];
  const [tokens, setTokens] = useState<HostedPersonalToken[]>([]);
  const [name, setName] = useState('Product workflow');
  const [scopes, setScopes] = useState<HostedPersonalTokenScope[]>(defaultScopes);
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('Loading API tokens…');

  const load = async () => {
    try {
      const values = await listHostedPersonalTokens(idToken, workspaceId);
      setTokens(values);
      setStatus(values.length === 0 ? 'No personal access tokens yet.' : `${values.length} personal access token${values.length === 1 ? '' : 's'}.`);
    } catch (error) {
      setStatus(safeErrorMessage(error));
    }
  };

  useEffect(() => {
    let active = true;
    void listHostedPersonalTokens(idToken, workspaceId).then((values) => {
      if (!active) return;
      setTokens(values);
      setStatus(values.length === 0 ? 'No personal access tokens yet.' : `${values.length} personal access token${values.length === 1 ? '' : 's'}.`);
    }).catch((error: unknown) => {
      if (active) setStatus(safeErrorMessage(error));
    });
    return () => { active = false; };
  }, [idToken, workspaceId]);

  const toggleScope = (scope: HostedPersonalTokenScope) => {
    setScopes((current) => current.includes(scope)
      ? current.filter((value) => value !== scope)
      : [...current, scope]);
  };

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const storageKey = `openlinear.hosted.personal-token.create.${workspaceId}`;
    setPending(true);
    setRawToken(null);
    try {
      const result = await createHostedPersonalToken(
        idToken,
        workspaceId,
        {name, scopes, expiresInDays},
        sessionIdempotencyKey(storageKey),
      );
      clearSessionIdempotencyKey(storageKey);
      setRawToken(result.rawToken);
      setStatus(result.rawToken === null
        ? 'The retry was accepted, but the secret was already shown. Create another token if you did not save it.'
        : 'Token created. Copy or download it now; OpenLinear will not show the secret again.');
      await load();
    } catch (error) {
      setStatus(safeErrorMessage(error));
    } finally {
      setPending(false);
    }
  };

  const revoke = async (token: HostedPersonalToken) => {
    if (!window.confirm(`Revoke ${token.name}? API calls using ${token.prefix} will stop immediately.`)) return;
    const storageKey = `openlinear.hosted.personal-token.revoke.${workspaceId}.${token.id}`;
    setPending(true);
    try {
      const result = await revokeHostedPersonalToken(
        idToken,
        workspaceId,
        token.id,
        sessionIdempotencyKey(storageKey),
      );
      clearSessionIdempotencyKey(storageKey);
      setStatus(result.changed ? 'Token revoked. Its next API call will be denied.' : 'That token was already revoked.');
      await load();
    } catch (error) {
      setStatus(safeErrorMessage(error));
    } finally {
      setPending(false);
    }
  };

  const downloadExport = async () => {
    setPending(true);
    setStatus('Preparing a deterministic workspace export…');
    try {
      const exported = await getHostedWorkspaceExport(idToken, workspaceId);
      downloadText(
        `openlinear-${workspaceId}-export-v1.json`,
        `${JSON.stringify(exported, null, 2)}\n`,
        exported.mediaType,
      );
      setStatus(`Workspace export downloaded. Canonical data SHA-256: ${exported.sha256}`);
    } catch (error) {
      setStatus(safeErrorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="hosted-automation" aria-labelledby="hosted-automation-title">
      <div className="hosted-section-heading">
        <div>
          <p className="hosted-eyebrow">API and portability</p>
          <h2 id="hosted-automation-title">Operate product work with a scoped token.</h2>
        </div>
        <p>REST and MCP use the same workspace authorization, revisions, retry safety, and mutation audit.</p>
      </div>
      <div className="hosted-api-grid">
        <form onSubmit={(event) => { void create(event); }}>
          <label htmlFor="hosted-token-name">Token name</label>
          <input id="hosted-token-name" value={name} maxLength={80} required disabled={pending}
            onChange={(event) => setName(event.target.value)} />
          <label htmlFor="hosted-token-expiry">Expiry</label>
          <select id="hosted-token-expiry" value={expiresInDays} disabled={pending}
            onChange={(event) => setExpiresInDays(Number(event.target.value))}>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={365}>365 days</option>
          </select>
          <fieldset>
            <legend>Allowed scopes</legend>
            <div className="hosted-scope-grid">
              {hostedPersonalTokenScopes.map((scope) => (
                <label key={scope}>
                  <input type="checkbox" checked={scopes.includes(scope)} disabled={pending}
                    onChange={() => toggleScope(scope)} />
                  <code>{scope}</code>
                </label>
              ))}
            </div>
          </fieldset>
          <button className="hosted-button primary" type="submit" disabled={pending || scopes.length === 0}>
            {pending ? 'Working…' : 'Create personal access token'}
          </button>
        </form>
        <div className="hosted-api-reference">
          <h3>REST API v1</h3>
          <p>Use <code>Authorization: Bearer …</code> with an explicit workspace route. Mutations also require an idempotency key; updates require the current revision ETag.</p>
          <a className="hosted-button secondary" href="/api/v1/openapi.json" target="_blank" rel="noreferrer">Open OpenAPI 3.1.1</a>
          <h3>MCP 2026-07-28</h3>
          <p>Connect a compatible remote MCP client to <code>{window.location.origin}/mcp</code>. OpenLinear uses Google sign-in, explicit workspace/scope consent, PKCE, short access tokens, and rotating refresh tokens. REST personal tokens are not accepted by MCP.</p>
          <button className="hosted-button secondary" type="button" disabled={pending}
            onClick={() => { void downloadExport(); }}>Download workspace export</button>
          <p className="hosted-api-warning">Never paste a personal access token into chat, issue text, comments, logs, or source control.</p>
        </div>
      </div>
      {rawToken === null ? null : (
        <div className="hosted-token-secret" role="status" aria-labelledby="hosted-token-secret-title">
          <strong id="hosted-token-secret-title">Save this token now. It is shown once.</strong>
          <code>{rawToken}</code>
          <div>
            <button className="hosted-button secondary" type="button" onClick={() => {
              void navigator.clipboard.writeText(rawToken)
                .then(() => setStatus('Token copied. Store it in a secret manager.'))
                .catch(() => setStatus('Copy failed. Select the token and copy it manually.'));
            }}>Copy token</button>
            <button className="hosted-button secondary" type="button" onClick={() => {
              try {
                downloadText('openlinear-personal-token.txt', `${rawToken}\n`, 'text/plain');
                setStatus('Token download started. Store it in a secret manager.');
              } catch {
                setStatus('Download failed. Select the token and save it manually.');
              }
            }}>Download token</button>
            <button className="hosted-button secondary" type="button" onClick={() => setRawToken(null)}>I saved it</button>
          </div>
        </div>
      )}
      <div className="hosted-token-list">
        <h3>Personal access tokens</h3>
        {tokens.length === 0 ? <p>No tokens yet.</p> : (
          <ul>
            {tokens.map((token) => (
              <li key={token.id}>
                <div>
                  <strong>{token.name}</strong>
                  <code>{token.prefix}</code>
                  <span>Audience: {token.audience}</span>
                  <span>Scopes: {token.scopes.join(', ')}</span>
                  <span>Last used: {token.lastUsedAt === null ? 'Never' : `${dateTimeFormatter.format(new Date(token.lastUsedAt))} UTC`}</span>
                  <span>Expires: {dateTimeFormatter.format(new Date(token.expiresAt))} UTC</span>
                  <span>Status: {hostedPersonalTokenStatus(token)}</span>
                </div>
                <button className="hosted-button danger" type="button" disabled={pending || token.revokedAt !== null}
                  onClick={() => { void revoke(token); }}>Revoke token</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="hosted-status" aria-live="polite">{status}</div>
    </section>
  );
}

function BillingPanel({idToken, workspaceId}: {idToken: string; workspaceId: string}) {
  const [summary, setSummary] = useState<HostedBillingSummary | null>(null);
  const [members, setMembers] = useState<HostedCollaborationMember[]>([]);
  const [pendingPlan, setPendingPlan] = useState<HostedBillingPlan | null>(null);
  const [pendingMemberUserId, setPendingMemberUserId] = useState<string | null>(null);
  const [status, setStatus] = useState('Loading trusted seat and plan totals…');

  const load = async () => {
    try {
      const [value, activeMembers] = await Promise.all([
        getHostedBillingSummary(idToken, workspaceId),
        listHostedMembers(idToken, workspaceId),
      ]);
      setSummary(value);
      setMembers(activeMembers);
      const returnState = new URLSearchParams(window.location.search).get('billing');
      setStatus(value.verificationAccess !== undefined
        ? 'This exact test account has no-charge Pro verification access. Checkout is disabled.'
        : returnState === 'success'
        ? 'Checkout returned successfully. Paid access appears only after a signed provider confirmation.'
        : returnState === 'cancelled'
          ? 'Checkout was cancelled. No plan change was made.'
          : 'Totals use active memberships. Pending invitations are not billed seats.');
    } catch (error) {
      setStatus(safeErrorMessage(error));
    }
  };

  useEffect(() => {
    let active = true;
    void Promise.all([
      getHostedBillingSummary(idToken, workspaceId),
      listHostedMembers(idToken, workspaceId),
    ]).then(([value, activeMembers]) => {
      if (!active) return;
      setSummary(value);
      setMembers(activeMembers);
      const returnState = new URLSearchParams(window.location.search).get('billing');
      setStatus(value.verificationAccess !== undefined
        ? 'This exact test account has no-charge Pro verification access. Checkout is disabled.'
        : returnState === 'success'
        ? 'Checkout returned successfully. Paid access appears only after a signed provider confirmation.'
        : returnState === 'cancelled'
          ? 'Checkout was cancelled. No plan change was made.'
          : 'Totals use active memberships. Pending invitations are not billed seats.');
    }).catch((error: unknown) => {
      if (active) setStatus(safeErrorMessage(error));
    });
    return () => { active = false; };
  }, [idToken, workspaceId]);

  const choose = async (plan: HostedBillingPlan) => {
    const storageKey = `openlinear.hosted.billing.checkout.${workspaceId}.${plan}`;
    setPendingPlan(plan);
    setStatus(`Preparing the trusted ${plan} total…`);
    try {
      const checkout = await createHostedBillingCheckout(
        idToken,
        workspaceId,
        plan,
        sessionIdempotencyKey(storageKey),
      );
      setStatus(`Opening secure Checkout for ${dollars(checkout.totalCents)} ${plan === 'monthly' ? 'per month' : 'per year'}…`);
      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      if (error instanceof HostedApiError && error.code === 'BILLING_CONFLICT') {
        clearSessionIdempotencyKey(storageKey);
        await load();
      }
      setStatus(safeErrorMessage(error));
      setPendingPlan(null);
    }
  };

  const removeMember = async (member: HostedCollaborationMember) => {
    if (!window.confirm(
      `Remove ${member.userId} from this workspace? Their access and active seat will end, but workspace data stays preserved.`,
    )) return;
    const storageKey = `openlinear.hosted.billing.member.remove.${workspaceId}.${member.userId}`;
    setPendingMemberUserId(member.userId);
    setStatus('Removing the member and reconciling the trusted active-seat quantity…');
    try {
      const result = await removeHostedMember(
        idToken,
        workspaceId,
        member.userId,
        sessionIdempotencyKey(storageKey),
      );
      clearSessionIdempotencyKey(storageKey);
      await load();
      window.dispatchEvent(new CustomEvent('openlinear:members-changed', {detail: workspaceId}));
      setStatus(result.changed
        ? `Member removed. The workspace now has ${result.activeSeats} active ${result.activeSeats === 1 ? 'seat' : 'seats'}.`
        : 'That member was already removed. Trusted seat totals are current.');
    } catch (error) {
      setStatus(safeErrorMessage(error));
    } finally {
      setPendingMemberUserId(null);
    }
  };

  const removableMembers = members.filter((member) => member.role === 'member');

  return (
    <section className="hosted-billing" aria-labelledby="hosted-billing-title">
      <div className="hosted-section-heading">
        <div>
          <p className="hosted-eyebrow">Plan and billing</p>
          <h2 id="hosted-billing-title">A tiny price for the active team.</h2>
        </div>
        <p>Choose explicitly. Checkout confirms the total; the free trial never auto-charges.</p>
      </div>
      {summary === null ? null : (
        <>
          <dl className="hosted-billing-facts">
            <div><dt>Access now</dt><dd>{summary.verificationAccess !== undefined ? 'Verification Pro' : summary.mode === 'trial_pro' ? 'Pro trial' : summary.mode === 'paid_pro' ? 'Paid Pro' : 'Free'}</dd></div>
            <div><dt>Active seats</dt><dd>{summary.seats.active}</dd></div>
            <div><dt>Pending invitations</dt><dd>{summary.seats.pendingInvitations} · not billed</dd></div>
            <div><dt>{summary.verificationAccess !== undefined ? 'Verification access' : 'Trial ends'}</dt><dd>{summary.verificationAccess !== undefined
              ? <><strong>Does not expire</strong> · server record ends <time dateTime={summary.verificationAccess.endsAt}>31 Dec 9999 UTC</time></>
              : <time dateTime={summary.trial.endsAt}>{dateTimeFormatter.format(new Date(summary.trial.endsAt))} UTC</time>}</dd></div>
          </dl>
          {summary.verificationAccess !== undefined ? (
            <div className="hosted-free-notice" role="note">
              <strong>No-charge verification account.</strong> Pro workspace, collaboration, API, MCP, and skill flows stay enabled without a payment method. Checkout and provider subscription creation are disabled for this allowlisted account.
            </div>
          ) : <div className="hosted-plan-grid">
            <article>
              <p className="hosted-eyebrow">Monthly</p>
              <h3>{dollars(summary.prices.monthlyTotalCents)}<span> / month</span></h3>
              <p>$2 × {summary.seats.active} active {summary.seats.active === 1 ? 'user' : 'users'} / month</p>
              <button className="hosted-button secondary" type="button" disabled={pendingPlan !== null || pendingMemberUserId !== null || summary.mode === 'paid_pro'}
                onClick={() => { void choose('monthly'); }}>
                {pendingPlan === 'monthly' ? 'Preparing Checkout…' : `Choose monthly — ${dollars(summary.prices.monthlyTotalCents)}/month`}
              </button>
            </article>
            <article className="recommended">
              <p className="hosted-eyebrow">Annual · 50% less</p>
              <h3>{dollars(summary.prices.annualTotalCents)}<span> / year</span></h3>
              <p>$12 × {summary.seats.active} active {summary.seats.active === 1 ? 'user' : 'users'} / year</p>
              <button className="hosted-button primary" type="button" disabled={pendingPlan !== null || pendingMemberUserId !== null || summary.mode === 'paid_pro'}
                onClick={() => { void choose('annual'); }}>
                {pendingPlan === 'annual' ? 'Preparing Checkout…' : `Choose annual — ${dollars(summary.prices.annualTotalCents)}/year`}
              </button>
            </article>
          </div>}
          {summary.verificationAccess === undefined ? <p className="hosted-billing-terms">USD before tax. Applicable tax is calculated automatically in Checkout. No card is required for the 30-day trial. No paid plan starts without your explicit choice and Checkout confirmation.</p> : null}
          {summary.mode === 'free' ? (
            <div className="hosted-free-notice" role="note">
              <strong>Free keeps your data.</strong> All workspace data stays readable and remains eligible for the workspace export below; export remains available. The owner remains one active writer; extra-member and automation writes pause. Subscribe above or reduce the workspace to recover the paused writes.
            </div>
          ) : null}
          {summary.mode === 'paid_pro' && summary.subscription !== null
            && summary.subscription.activeSeats !== summary.seats.active ? (
              <div className="hosted-free-notice" role="status">
                <strong>Seat reconciliation is pending.</strong> Paid writes pause until the provider quantity matches {summary.seats.active} active {summary.seats.active === 1 ? 'seat' : 'seats'}. Retry the most recent invitation acceptance or member removal; it will not duplicate the seat change.
              </div>
            ) : null}
          <section className="hosted-seat-management" aria-labelledby="hosted-seat-management-title">
            <div>
              <h3 id="hosted-seat-management-title">Reduce active seats</h3>
              <p>Removing a member ends their access and, on a paid plan, reconciles the provider quantity with explicit proration. Tasks and comments stay preserved.</p>
            </div>
            {removableMembers.length === 0 ? (
              <p className="hosted-seat-empty">No extra active members to remove. The owner is the single active seat.</p>
            ) : (
              <ul>
                {removableMembers.map((member) => (
                  <li key={member.userId}>
                    <span><strong>Member</strong><code>{member.userId}</code></span>
                    <button className="hosted-button danger" type="button"
                      aria-label={`Remove member ${member.userId}`}
                      disabled={pendingMemberUserId !== null || pendingPlan !== null}
                      onClick={() => { void removeMember(member); }}>
                      {pendingMemberUserId === member.userId ? 'Removing…' : 'Remove member'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {summary.subscription !== null ? (
            <p className="hosted-subscription-state">
              Provider status: <strong>{summary.subscription.status}</strong>. Paid through{' '}
              <time dateTime={summary.subscription.paidThrough}>{dateTimeFormatter.format(new Date(summary.subscription.paidThrough))} UTC</time>
              {summary.subscription.cancelAtPeriodEnd ? '; cancellation is scheduled for that boundary.' : '.'}
            </p>
          ) : null}
        </>
      )}
      <div className="hosted-status" aria-live="polite">{status}</div>
    </section>
  );
}

function TrialSummary({
  value,
  idToken,
  workspaces,
}: {
  value: HostedBootstrapResponse;
  idToken: string;
  workspaces: HostedWorkspaceDirectoryEntry[];
}) {
  const preferredWorkspaceId = localStorage.getItem(activeWorkspaceStorageKey(value.user.id));
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(
    workspaces.some((workspace) => workspace.id === preferredWorkspaceId)
      ? preferredWorkspaceId as string
      : value.workspace.id,
  );
  const selectedWorkspace = workspaces.find((workspace) => workspace.id === selectedWorkspaceId)
    ?? workspaces.find((workspace) => workspace.id === value.workspace.id)
    ?? {id: value.workspace.id, name: value.workspace.name, role: 'owner' as const};
  const selectWorkspace = (workspaceId: string) => {
    localStorage.setItem(activeWorkspaceStorageKey(value.user.id), workspaceId);
    setSelectedWorkspaceId(workspaceId);
  };
  return (
    <HostedWorkspaceApplication
      idToken={idToken}
      workspaceId={selectedWorkspace.id}
      workspaceName={selectedWorkspace.name}
      role={selectedWorkspace.role}
      currentUserId={value.user.id}
      userEmail={value.user.email}
      displayName={value.user.displayName}
      availableWorkspaces={workspaces}
      onWorkspaceChange={selectWorkspace}
      {...(selectedWorkspace.id === value.workspace.id ? {
        trial: {startedAt: value.trial.startedAt, endsAt: value.trial.endsAt},
      } : {})}
      {...(selectedWorkspace.role === 'owner' ? {
        peoplePanel: <InvitationManager idToken={idToken} workspaceId={selectedWorkspace.id} workspaceName={selectedWorkspace.name} />,
        billingPanel: <BillingPanel idToken={idToken} workspaceId={selectedWorkspace.id} />,
        automationPanel: <AutomationPanel idToken={idToken} workspaceId={selectedWorkspace.id} />,
      } : {})}
    />
  );
}

function InviteeFlow({ token }: {token: string}) {
  const [state, setState] = useState<InviteeState>({ name: 'loading' });

  useEffect(() => {
    let active = true;
    void inspectHostedInvitation(token).then((value) => {
      if (active) setState({ name: 'preview', value });
    }).catch((error: unknown) => {
      if (!active) return;
      setState({
        name: 'error',
        preview: null,
        code: error instanceof HostedApiError ? error.code : 'INVITATION_UNAVAILABLE',
        message: safeErrorMessage(error),
      });
    });
    return () => { active = false; };
  }, [token]);

  const accept = async (preview: HostedInvitationPreview) => {
    setState({ name: 'signing-in', value: preview });
    let storageKey: string | null = null;
    try {
      const identity = await signInWithGoogle();
      setState({ name: 'accepting', value: preview });
      const idToken = await identity.getIdToken();
      storageKey = invitationAcceptanceStorageKey(preview.invitationId, identity.uid);
      const result = await acceptHostedInvitation(
        token,
        idToken,
        sessionIdempotencyKey(storageKey),
      );
      clearSessionIdempotencyKey(storageKey);
      localStorage.setItem(activeWorkspaceStorageKey(identity.uid), result.workspace.id);
      setState({
        name: 'accepted',
        value: result,
        idToken,
        email: identity.email,
        displayName: identity.displayName,
      });
    } catch (error) {
      if (
        storageKey !== null
        && error instanceof HostedApiError
        && error.code === 'INVITATION_EMAIL_MISMATCH'
      ) {
        clearSessionIdempotencyKey(storageKey);
      }
      setState({
        name: 'error',
        preview,
        code: error instanceof HostedApiError ? error.code : 'INVITATION_ACCEPT_FAILED',
        message: safeErrorMessage(error),
      });
    }
  };

  const retryAccount = async () => {
    await signOutHostedUser().catch(() => undefined);
    if (state.name === 'error' && state.preview !== null) {
      setState({ name: 'preview', value: state.preview });
    }
  };

  if (state.name === 'loading') {
    return <section className="hosted-invite-page" aria-live="polite"><p>Checking the invitation…</p></section>;
  }
  if (state.name === 'accepted') {
    return (
      <HostedWorkspaceApplication
        idToken={state.idToken}
        workspaceId={state.value.workspace.id}
        workspaceName={state.value.workspace.name}
        role="member"
        currentUserId={state.value.membership.userId}
        userEmail={state.email}
        displayName={state.displayName}
      />
    );
  }
  const preview = state.name === 'error' ? state.preview : state.value;
  if (preview === null) {
    return (
      <section className="hosted-invite-page" aria-labelledby="hosted-invite-unavailable-title">
        <p className="hosted-eyebrow">Invitation unavailable</p>
        <h1 id="hosted-invite-unavailable-title">This private link cannot be used.</h1>
        <p className="hosted-lede">Ask the workspace owner to create or resend an invitation. No workspace information was disclosed.</p>
      </section>
    );
  }
  const busy = state.name === 'signing-in' || state.name === 'accepting';
  const canAccept = preview.state === 'pending' || preview.state === 'accepted';
  const recovery: Record<HostedInvitationPreview['state'], string> = {
    pending: 'Sign in with the invited Google account to activate one member seat.',
    expired: 'This link expired. Ask the workspace owner to resend the invitation.',
    revoked: 'The workspace owner revoked this invitation. Ask for a new invitation if access is still needed.',
    superseded: 'A newer link replaced this one. Ask the workspace owner for the latest invitation.',
    accepted: 'This invitation was already accepted. The same invited account can sign in to restore its membership result.',
  };
  return (
    <section className="hosted-invite-page" aria-labelledby="hosted-invite-title">
      <p className="hosted-eyebrow">Member invitation</p>
      <h1 id="hosted-invite-title">Join {preview.workspaceName}</h1>
      <p className="hosted-lede">{recovery[preview.state]}</p>
      <dl className="hosted-facts">
        <div><dt>Inviter</dt><dd>{preview.inviterDisplayName}</dd></div>
        <div><dt>Workspace</dt><dd>{preview.workspaceName}</dd></div>
        <div><dt>Invited Google email</dt><dd>{preview.invitedEmail}</dd></div>
        <div><dt>Role</dt><dd>Member</dd></div>
        <div><dt>Expires</dt><dd><time dateTime={preview.expiresAt}>{dateTimeFormatter.format(new Date(preview.expiresAt))} UTC</time></dd></div>
        <div><dt>Status</dt><dd><span className={`hosted-state ${preview.state}`}>{preview.state}</span></dd></div>
      </dl>
      {canAccept ? (
        <button className="hosted-button primary" type="button" disabled={busy} onClick={() => { void accept(preview); }}>
          <span className="google-g" aria-hidden="true">G</span>
          {state.name === 'signing-in' ? 'Opening Google…' : state.name === 'accepting' ? 'Activating membership…' : 'Continue with invited Google account'}
        </button>
      ) : null}
      <div className="hosted-status" aria-live="polite">
        {state.name === 'error' ? <><strong>Could not accept.</strong> {state.message}</> : null}
      </div>
      {state.name === 'error' && state.code === 'INVITATION_EMAIL_MISMATCH' ? (
        <button className="hosted-button secondary" type="button" onClick={() => { void retryAccount(); }}>
          Sign out and try another Google account
        </button>
      ) : null}
    </section>
  );
}

function OwnerEntry({providerStatus}: {providerStatus: HostedProviderStatus}) {
  const [state, setState] = useState<HostedState>({ name: 'restoring' });

  useEffect(() => subscribeHostedGoogleIdToken((idToken) => {
    setState((current) => current.name === 'ready' ? {...current, idToken} : current);
  }), []);

  const finishIdentity = async (identity: HostedGoogleIdentity) => {
    if (providerStatus === 'ready') setState({name: 'bootstrapping'});
    const result = await completeHostedOwnerSignIn(
      providerStatus,
      identity,
      (token, uid) => bootstrapHostedOwner(token, bootstrapIdempotencyKey(uid)),
    );
    if (result.kind === 'identity-only') {
      setState({
        name: 'identity-ready',
        email: result.email,
        displayName: result.displayName,
      });
    } else {
      const workspaces = await listHostedWorkspaces(result.idToken);
      setState({name: 'ready', value: result.value, idToken: result.idToken, workspaces});
    }
  };

  useEffect(() => {
    let active = true;
    void restoreHostedGoogleIdentity().then(async (identity) => {
      if (!active) return;
      if (identity === null) {
        setState({name: 'idle'});
        return;
      }
      try {
        await finishIdentity(identity);
      } catch (error) {
        if (active) setState({name: 'error', message: safeErrorMessage(error)});
      }
    }).catch((error: unknown) => {
      if (active) setState({name: 'error', message: safeErrorMessage(error)});
    });
    return () => { active = false; };
  }, [providerStatus]);

  const start = async () => {
    setState({ name: 'signing-in' });
    try {
      const identity = await signInWithGoogle();
      await finishIdentity(identity);
    } catch (error) {
      setState({ name: 'error', message: safeErrorMessage(error) });
    }
  };

  if (state.name === 'identity-ready') {
    return (
      <div className="hosted-workspace-page">
        <section className="hosted-ready" aria-labelledby="hosted-identity-title">
          <p className="hosted-eyebrow">Development identity check</p>
          <h1 id="hosted-identity-title">Google sign-in works.</h1>
          <p className="hosted-lede">
            {state.displayName === null ? state.email : `${state.displayName} · ${state.email}`} is signed in to the isolated development Firebase project.
          </p>
          <dl className="hosted-facts">
            <div><dt>Account</dt><dd>{state.email}</dd></div>
            <div><dt>Environment</dt><dd>Development preview</dd></div>
            <div><dt>Workspace data</dt><dd>Not created</dd></div>
            <div><dt>Payments</dt><dd>Stripe test mode not connected</dd></div>
          </dl>
          <div className="hosted-notice" role="status">
            Identity verification only. No workspace, trial, Firestore application record, Checkout session, subscription, or charge was created.
          </div>
        </section>
        <div className="hosted-account-actions">
          <button className="hosted-button secondary" type="button" onClick={() => {
            void signOutHostedUser()
              .then(() => setState({ name: 'idle' }))
              .catch((error: unknown) => setState({ name: 'error', message: safeErrorMessage(error) }));
          }}>Sign out</button>
        </div>
      </div>
    );
  }
  if (state.name === 'ready') return <TrialSummary value={state.value} idToken={state.idToken} workspaces={state.workspaces} />;
  return <HostedLogin phase={state.name} error={state.name === 'error' ? state.message : undefined}
    identityOnly={providerStatus !== 'ready'} onContinue={() => { void start(); }} />;
}

function OAuthWorkspaceSelectionFlow({request}: {request: HostedOAuthWorkspaceSelection}) {
  const [state, setState] = useState<OAuthWorkspaceSelectionState>({name: 'restoring'});
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const busy = state.name === 'restoring' || state.name === 'signing-in' || state.name === 'loading';

  const loadIdentity = async (identity: HostedGoogleIdentity) => {
    setState({name: 'loading', email: identity.email});
    const idToken = await identity.getIdToken();
    const workspaces = await listHostedWorkspaces(idToken);
    setSelectedWorkspaceId(workspaces[0]?.id ?? '');
    setState({name: 'ready', idToken, email: identity.email, workspaces});
  };

  useEffect(() => {
    let active = true;
    void restoreHostedGoogleIdentity().then(async (identity) => {
      if (!active) return;
      if (identity === null) {
        setState({name: 'idle'});
        return;
      }
      try {
        await loadIdentity(identity);
      } catch (error) {
        if (active) setState({name: 'error', message: safeErrorMessage(error)});
      }
    }).catch((error: unknown) => {
      if (active) setState({name: 'error', message: safeErrorMessage(error)});
    });
    return () => { active = false; };
  }, []);

  const signIn = async () => {
    setState({name: 'signing-in'});
    try {
      await loadIdentity(await signInWithGoogle());
    } catch (error) {
      setState({name: 'error', message: safeErrorMessage(error)});
    }
  };

  const continueAuthorization = () => {
    if (selectedWorkspaceId === '') return;
    const target = new URL('/oauth/authorize', window.location.origin);
    for (const [key, value] of [
      ['response_type', request.responseType],
      ['client_id', request.clientId],
      ['redirect_uri', request.redirectUri],
      ['workspace_id', selectedWorkspaceId],
      ['scope', request.scope],
      ['state', request.state],
      ['code_challenge', request.codeChallenge],
      ['code_challenge_method', request.codeChallengeMethod],
      ['resource', request.resource],
    ] as const) target.searchParams.set(key, value);
    window.location.assign(target.toString());
  };

  const changeAccount = async () => {
    await signOutHostedUser().catch(() => undefined);
    setSelectedWorkspaceId('');
    setState({name: 'idle'});
  };

  return (
    <section className="hosted-oauth-consent hosted-oauth-workspace" aria-labelledby="hosted-oauth-workspace-title">
      <p className="hosted-eyebrow">MCP authorization · Step 1 of 2</p>
      <h1 id="hosted-oauth-workspace-title">Choose the workspace your AI client can request.</h1>
      <p className="hosted-lede">Sign in with Google, then select one workspace you already belong to. Choosing does not grant access; you will review the exact scopes next.</p>
      <dl className="hosted-facts compact">
        <div><dt>Client ID</dt><dd><code>{request.clientId}</code></dd></div>
        <div><dt>Exact redirect</dt><dd><code>{request.redirectUri}</code></dd></div>
        <div><dt>Requested scopes</dt><dd><code>{request.scope}</code></dd></div>
      </dl>
      {state.name === 'ready' ? (
        state.workspaces.length > 0 ? (
          <fieldset className="hosted-workspace-options">
            <legend>Accessible workspaces</legend>
            {state.workspaces.map((workspaceEntry) => (
              <label key={workspaceEntry.id} className={workspaceEntry.id === selectedWorkspaceId ? 'selected' : undefined}>
                <input type="radio" name="oauth-workspace" value={workspaceEntry.id}
                  checked={workspaceEntry.id === selectedWorkspaceId}
                  onChange={() => setSelectedWorkspaceId(workspaceEntry.id)} />
                <span><strong>{workspaceEntry.name}</strong><small>{workspaceEntry.role} · <code>{workspaceEntry.id}</code></small></span>
              </label>
            ))}
          </fieldset>
        ) : (
          <div className="hosted-notice" role="note">This Google account has no active OpenLinear Online workspace. Ask an owner for an invitation, or use another account.</div>
        )
      ) : null}
      <div className="hosted-oauth-actions">
        {state.name === 'ready' ? (
          <button className="hosted-button primary" type="button" disabled={selectedWorkspaceId === ''}
            onClick={continueAuthorization}>Continue to scope review</button>
        ) : (
          <button className="hosted-button primary" type="button" disabled={busy} onClick={() => { void signIn(); }}>
            <span className="google-g" aria-hidden="true">G</span>
            {state.name === 'restoring' ? 'Restoring Google account…' : state.name === 'signing-in' ? 'Opening Google…' : state.name === 'loading' ? 'Loading workspaces…' : 'Choose with Google'}
          </button>
        )}
        {state.name === 'ready' ? (
          <button className="hosted-button secondary" type="button" onClick={() => { void changeAccount(); }}>Use another Google account</button>
        ) : null}
      </div>
      <div className="hosted-status" aria-live="polite">
        {state.name === 'ready' ? <>Signed in as <strong>{state.email}</strong>. No access is granted until the next screen is approved.</> : null}
        {state.name === 'error' ? <><strong>Could not load workspaces.</strong> {state.message} Start a new authorization request from the client and return here.</> : null}
      </div>
    </section>
  );
}

function OAuthConsentFlow({requestId}: {requestId: string}) {
  const [state, setState] = useState<OAuthConsentState>({name: 'idle'});
  const busy = state.name === 'signing-in' || state.name === 'loading' || state.name === 'deciding';

  const signIn = async () => {
    setState({name: 'signing-in'});
    try {
      const identity = await signInWithGoogle();
      const idToken = await identity.getIdToken();
      setState({name: 'loading', idToken, email: identity.email});
      const value = await getHostedOAuthConsent(idToken, requestId);
      setState({name: 'ready', idToken, email: identity.email, value});
    } catch (error) {
      setState({name: 'error', message: safeErrorMessage(error)});
    }
  };

  useEffect(() => {
    let active = true;
    void restoreHostedGoogleIdentity().then(async (identity) => {
      if (!active || identity === null) return;
      try {
        const idToken = await identity.getIdToken();
        if (!active) return;
        setState({name: 'loading', idToken, email: identity.email});
        const value = await getHostedOAuthConsent(idToken, requestId);
        if (active) setState({name: 'ready', idToken, email: identity.email, value});
      } catch (error) {
        if (active) setState({name: 'error', message: safeErrorMessage(error)});
      }
    }).catch((error: unknown) => {
      if (active) setState({name: 'error', message: safeErrorMessage(error)});
    });
    return () => { active = false; };
  }, [requestId]);

  const decide = async (
    current: Extract<OAuthConsentState, {name: 'ready'}>,
    decision: 'approve' | 'deny',
  ) => {
    setState({...current, name: 'deciding', decision});
    try {
      const result = await decideHostedOAuthConsent(current.idToken, requestId, decision);
      window.location.assign(result.redirectUri);
    } catch (error) {
      setState({name: 'error', message: safeErrorMessage(error)});
    }
  };

  const changeAccount = async () => {
    await signOutHostedUser().catch(() => undefined);
    setState({name: 'idle'});
  };

  if (state.name !== 'ready' && state.name !== 'deciding') {
    return (
      <section className="hosted-oauth-consent" aria-labelledby="hosted-oauth-title">
        <p className="hosted-eyebrow">MCP authorization</p>
        <h1 id="hosted-oauth-title">Review a product-management connection.</h1>
        <p className="hosted-lede">Sign in with Google to inspect the requesting client, exact redirect, workspace, and scopes before anything is approved.</p>
        <button className="hosted-button primary" type="button" disabled={busy} onClick={() => { void signIn(); }}>
          <span className="google-g" aria-hidden="true">G</span>
          {state.name === 'signing-in' ? 'Opening Google…' : state.name === 'loading' ? 'Loading consent…' : 'Review with Google'}
        </button>
        <div className="hosted-status" aria-live="polite">
          {state.name === 'error' ? <><strong>Could not load this request.</strong> {state.message} Start a new authorization request from the client and return here.</> : null}
        </div>
      </section>
    );
  }

  const view = state.value;
  const pending = view.state === 'pending';
  return (
    <section className="hosted-oauth-consent" aria-labelledby="hosted-oauth-title">
      <p className="hosted-eyebrow">MCP authorization</p>
      <h1 id="hosted-oauth-title">Allow {view.client.name} to operate product work?</h1>
      <p className="hosted-lede">Only the scopes below apply, only in this workspace, and only while your membership and OAuth grant remain active.</p>
      <dl className="hosted-facts">
        <div><dt>Google account</dt><dd>{state.email}</dd></div>
        <div><dt>Client</dt><dd><HostedOAuthClientIdentity client={view.client} /></dd></div>
        <div><dt>Workspace</dt><dd>{view.workspace.name}<small><code>{view.workspace.id}</code></small></dd></div>
        <div><dt>Exact redirect</dt><dd><code>{view.redirectUri}</code></dd></div>
        <div><dt>Request expires</dt><dd><time dateTime={view.expiresAt}>{dateTimeFormatter.format(new Date(view.expiresAt))} UTC</time></dd></div>
      </dl>
      <div className="hosted-oauth-scopes" role="group" aria-labelledby="hosted-oauth-scopes-title">
        <h2 id="hosted-oauth-scopes-title">Requested scopes</h2>
        <ul>{view.scopes.map((scope) => <li key={scope}><code>{scope}</code></li>)}</ul>
      </div>
      <div className="hosted-notice" role="note">
        OpenLinear will issue an MCP-only, audience-bound access token. The client never receives your Google credential or a REST personal token. Destructive tools still require confirmation in the packaged OpenLinear skill.
      </div>
      <div className="hosted-oauth-actions">
        <button className="hosted-button primary" type="button" disabled={busy}
          onClick={() => { void decide(state as Extract<OAuthConsentState, {name: 'ready'}>, pending ? 'approve' : view.state === 'approved' ? 'approve' : 'deny'); }}>
          {state.name === 'deciding' ? 'Returning to client…' : pending ? 'Allow requested access' : 'Return to client'}
        </button>
        {pending ? (
          <button className="hosted-button secondary" type="button" disabled={busy}
            onClick={() => { void decide(state as Extract<OAuthConsentState, {name: 'ready'}>, 'deny'); }}>Deny</button>
        ) : null}
        <button className="hosted-button secondary" type="button" disabled={busy} onClick={() => { void changeAccount(); }}>Use another Google account</button>
      </div>
      <div className="hosted-status" aria-live="polite">
        {view.state === 'approved' ? 'This exact request was already approved.' : view.state === 'denied' ? 'This exact request was already denied.' : 'Nothing is shared until you choose Allow.'}
      </div>
    </section>
  );
}

export function HostedApp() {
  const environment = readHostedBrowserEnvironment();
  const inviteToken = invitationTokenFromLocation();
  const oauthWorkspaceSelection = oauthWorkspaceSelectionFromLocation();
  const oauthWorkspaceSelectionRequested = oauthWorkspaceSelectionWasRequested();
  const oauthRequest = oauthRequestFromLocation();
  return (
    <main className="hosted-shell">
      <header className="hosted-header">
        <a className="hosted-brand" href="/" aria-label="OpenLinear Online home"><Mark /><strong>OpenLinear</strong><span>{environment.label}</span></a>
        <span className="hosted-header-note">Focused product management</span>
      </header>
      {environment.environment === 'development' ? (
        <div className="hosted-development-banner" role="note">
          Development only · isolated test data and no-charge verification access · production is separate
        </div>
      ) : null}
      {environment.providerStatus !== 'ready'
        ? <OwnerEntry providerStatus={environment.providerStatus} />
        : inviteToken !== null
        ? <InviteeFlow token={inviteToken} />
        : oauthWorkspaceSelection !== null
        ? <OAuthWorkspaceSelectionFlow request={oauthWorkspaceSelection} />
        : oauthWorkspaceSelectionRequested
        ? (
          <section className="hosted-oauth-consent" aria-labelledby="hosted-oauth-invalid-title">
            <p className="hosted-eyebrow">MCP authorization</p>
            <h1 id="hosted-oauth-invalid-title">This authorization request is invalid.</h1>
            <p className="hosted-lede">Return to the AI client and start a new authorization request. No workspace access was granted.</p>
          </section>
        )
        : oauthRequest !== null ? <OAuthConsentFlow requestId={oauthRequest} /> : <OwnerEntry providerStatus={environment.providerStatus} />}
      <footer className="hosted-footer">OpenLinear Online · {environment.label} · Firebase-hosted workspace</footer>
    </main>
  );
}
