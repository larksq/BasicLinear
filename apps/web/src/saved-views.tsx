import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Membership, SavedView } from '@basiclinear/contracts';
import { hasCapability } from '@basiclinear/domain';
import {
  Archive,
  ArchiveRestore,
  Bookmark,
  Pencil,
  Plus,
  Search,
} from 'lucide-react';
import { api } from './api.js';
import { Dialog, EmptyState, ErrorNotice, Field, LoadingSkeleton, QueryErrorState, Spinner } from './components.js';
import {
  canManageSavedView,
  countIssueFilterConditions,
  savedViewGroupingLabel,
  savedViewSections,
  savedViewStateSummary,
  type SavedViewMode,
} from './saved-view-library.js';

interface SavedViewsViewProps {
  workspaceId: string;
  workspaceRole: Membership['role'];
  currentUserId: string;
  onOpenView: (viewId: string) => void;
  onBuildView: () => void;
}

interface EditSavedViewInput {
  targetWorkspaceId: string;
  view: SavedView;
  name: string;
}

interface SavedViewLifecycleInput {
  targetWorkspaceId: string;
  view: SavedView;
}

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export function SavedViewsView({
  workspaceId,
  workspaceRole,
  currentUserId,
  onOpenView,
  onBuildView,
}: SavedViewsViewProps) {
  const client = useQueryClient();
  const [mode, setMode] = useState<SavedViewMode>('active');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<SavedView | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const activeModeRef = useRef<HTMLButtonElement>(null);
  const archivedModeRef = useRef<HTMLButtonElement>(null);
  const canWrite = hasCapability(workspaceRole, 'issue:write');
  const savedViews = useQuery({
    queryKey: ['saved-views', workspaceId, true],
    queryFn: () => api.savedViews(workspaceId, true),
    enabled: workspaceId !== '',
  });
  const savedViewsBlockingError = savedViews.data === undefined ? savedViews.error : null;
  const sections = useMemo(
    () => savedViewSections(savedViews.data ?? [], mode, query),
    [savedViews.data, mode, query],
  );
  const visibleCount = sections.reduce((total, section) => total + section.views.length, 0);
  const modeCount = (savedViews.data ?? []).filter((view) => (
    mode === 'active' ? view.archivedAt === null : view.archivedAt !== null
  )).length;
  const countLabel = `${modeCount} ${mode} ${modeCount === 1 ? 'view' : 'views'}`;

  const editSavedView = useMutation({
    mutationFn: ({ targetWorkspaceId, view, name }: EditSavedViewInput) =>
      api.updateSavedView(targetWorkspaceId, view.id, {
        expectedRevision: view.revision,
        name,
        sharingScope: 'private',
      }),
    onSuccess: async (updated, variables) => {
      client.setQueryData<SavedView[]>(['saved-views', variables.targetWorkspaceId, true], (current) =>
        current?.map((view) => view.id === updated.id ? updated : view));
      await client.invalidateQueries({ queryKey: ['saved-views', variables.targetWorkspaceId] });
      if (variables.targetWorkspaceId !== workspaceId) return;
      setEditing(null);
      setAnnouncement(`${updated.name} updated.`);
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-saved-view-id="${updated.id}"] .saved-view-open`)?.focus();
      });
    },
  });
  const setSavedViewLifecycle = useMutation({
    mutationFn: ({ targetWorkspaceId, view }: SavedViewLifecycleInput) => view.archivedAt === null
      ? api.archiveSavedView(targetWorkspaceId, view.id, view.revision)
      : api.restoreSavedView(targetWorkspaceId, view.id, view.revision),
    onSuccess: async (updated, variables) => {
      client.setQueryData<SavedView[]>(['saved-views', variables.targetWorkspaceId, true], (current) =>
        current?.map((view) => view.id === updated.id ? updated : view));
      await client.invalidateQueries({ queryKey: ['saved-views', variables.targetWorkspaceId] });
      if (variables.targetWorkspaceId !== workspaceId) return;
      const archived = updated.archivedAt !== null;
      setAnnouncement(`${updated.name} ${archived ? 'archived' : 'restored'}.`);
      window.requestAnimationFrame(() => {
        (archived ? activeModeRef.current : archivedModeRef.current)?.focus();
      });
    },
  });

  useEffect(() => {
    setMode('active');
    setQuery('');
    setEditing(null);
    setAnnouncement('');
    editSavedView.reset();
    setSavedViewLifecycle.reset();
  }, [workspaceId]);

  useEffect(() => {
    if (editing === null || (canManageSavedView(editing, currentUserId, canWrite) && editing.archivedAt === null)) return;
    setEditing(null);
  }, [editing, currentUserId, canWrite]);

  const submitEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editing === null || !canManageSavedView(editing, currentUserId, canWrite) || editing.archivedAt !== null) return;
    const data = new FormData(event.currentTarget);
    editSavedView.mutate({
      targetWorkspaceId: workspaceId,
      view: editing,
      name: String(data.get('name')).trim(),
    });
  };
  const savedViewSearchActive = query.trim() !== '';
  const savedViewEmptyTitle = savedViewSearchActive
    ? 'No matching views'
    : mode === 'archived'
      ? 'Archive is empty'
      : 'No saved views';
  const savedViewEmptyAction = savedViewSearchActive ? (
    <button type="button" className="button" onClick={() => setQuery('')}>Clear search</button>
  ) : mode === 'archived' ? (
    <button type="button" className="button" onClick={() => setMode('active')}>View active</button>
  ) : canWrite ? (
    <button type="button" className="button" onClick={onBuildView}><Plus size={15} />Build view</button>
  ) : undefined;

  return (
    <section className="saved-views-view" aria-labelledby="saved-views-title" aria-describedby="saved-views-description">
      <div className="section-heading saved-views-heading">
        <div>
          <h1 id="saved-views-title">Views</h1>
          <p id="saved-views-description">{savedViews.isLoading || savedViewsBlockingError !== null ? <span className="skeleton-block skeleton-inline-count" aria-hidden="true" /> : countLabel}</p>
        </div>
        <button type="button" className="button primary" disabled={!canWrite} title={canWrite ? 'Build view' : 'Issue write permission required'} onClick={onBuildView}>
          <Plus size={15} />Build view
        </button>
      </div>

      <div className="saved-view-toolbar">
        <div className="saved-view-mode" role="group" aria-label="View status">
          <button type="button" ref={activeModeRef} className={mode === 'active' ? 'active' : ''} aria-pressed={mode === 'active'} onClick={() => { setMode('active'); setAnnouncement(''); setSavedViewLifecycle.reset(); }}>Active</button>
          <button type="button" ref={archivedModeRef} className={mode === 'archived' ? 'active' : ''} aria-pressed={mode === 'archived'} onClick={() => { setMode('archived'); setAnnouncement(''); setSavedViewLifecycle.reset(); }}>Archived</button>
        </div>
        <form className="saved-view-search" role="search" onSubmit={(event) => event.preventDefault()}>
          <Search size={14} aria-hidden="true" />
          <label><span className="sr-only">Search views</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search views" maxLength={200} /></label>
        </form>
      </div>

      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
      <ErrorNotice error={savedViews.data === undefined ? null : savedViews.error} />
      <ErrorNotice error={setSavedViewLifecycle.variables?.targetWorkspaceId === workspaceId ? setSavedViewLifecycle.error : null} />

      {savedViews.isLoading ? (
        <div className="saved-view-loading">
          <LoadingSkeleton variant="table" tableKind="issues" tableColumnCount={6} label="Loading saved views" />
        </div>
      ) : savedViewsBlockingError !== null ? (
        <QueryErrorState
          title="Could not load saved views"
          error={savedViewsBlockingError}
          retrying={savedViews.isFetching}
          onRetry={() => { void savedViews.refetch(); }}
        />
      ) : visibleCount === 0 ? (
        <EmptyState icon={<Bookmark size={22} />} title={savedViewEmptyTitle} action={savedViewEmptyAction} />
      ) : (
        <div className="saved-view-table-scroll" role="region" aria-label="Saved views table" tabIndex={0}>
          <table className="saved-view-table">
            <caption className="sr-only">{mode === 'active' ? 'Active' : 'Archived'} saved views</caption>
            <thead>
              <tr>
                <th scope="col">View</th>
                <th scope="col">Layout</th>
                <th scope="col">Group</th>
                <th scope="col">Filters</th>
                <th scope="col">Updated</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            {sections.filter((section) => section.views.length > 0).map((section) => (
              <tbody key={section.key}>
                <tr className="saved-view-section-row"><td colSpan={6}><strong role="heading" aria-level={2}>{section.label}</strong><span>{section.views.length}</span></td></tr>
                {section.views.map((view) => {
                  const filterCount = countIssueFilterConditions(view.state.filter.root);
                  const manageable = canManageSavedView(view, currentUserId, canWrite);
                  const lifecyclePending = setSavedViewLifecycle.isPending && setSavedViewLifecycle.variables?.view.id === view.id;
                  return (
                    <tr key={view.id} data-saved-view-id={view.id}>
                      <th scope="row">
                        <button type="button" className="saved-view-open" aria-label={`Open ${view.name}`} onClick={() => onOpenView(view.id)}>
                          <span><Bookmark size={14} aria-hidden="true" />{view.name}</span>
                          <small>{savedViewStateSummary(view.state)}</small>
                        </button>
                      </th>
                      <td>{view.state.layout === 'list' ? 'List' : 'Board'}</td>
                      <td>{savedViewGroupingLabel(view.state.groupBy)}</td>
                      <td>{filterCount === 0 ? 'None' : filterCount}</td>
                      <td><time dateTime={view.updatedAt} title={new Date(view.updatedAt).toLocaleString()}>{formatUpdatedAt(view.updatedAt)}</time></td>
                      <td>
                        <div className="saved-view-actions" role="group" aria-label={`Actions for ${view.name}`}>
                          {manageable && view.archivedAt === null ? <button type="button" className="icon-button" aria-label={`Edit ${view.name}`} title="Rename view" onClick={() => { setAnnouncement(''); editSavedView.reset(); setEditing(view); }}><Pencil size={14} /></button> : null}
                          {manageable ? <button type="button" className="icon-button" aria-label={`${view.archivedAt === null ? 'Archive' : 'Restore'} ${view.name}`} title={view.archivedAt === null ? 'Archive view' : 'Restore view'} disabled={lifecyclePending} onClick={() => setSavedViewLifecycle.mutate({ targetWorkspaceId: workspaceId, view })}>{lifecyclePending ? <Spinner /> : view.archivedAt === null ? <Archive size={14} /> : <ArchiveRestore size={14} />}</button> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}

      <Dialog title={editing === null ? 'Edit view' : `Edit ${editing.name}`} open={editing !== null && canManageSavedView(editing, currentUserId, canWrite) && editing.archivedAt === null} onClose={() => { setEditing(null); editSavedView.reset(); }}>
        {editing !== null ? (
          <form key={`${editing.id}-${editing.revision}`} className="dialog-form" onSubmit={submitEdit}>
            <Field label="Name" name="name" defaultValue={editing.name} maxLength={80} />
            <ErrorNotice error={editSavedView.variables?.targetWorkspaceId === workspaceId ? editSavedView.error : null} />
            <button className="button primary" disabled={editSavedView.isPending}>{editSavedView.isPending ? <Spinner /> : <Pencil size={14} />}Save changes</button>
          </form>
        ) : null}
      </Dialog>
    </section>
  );
}
