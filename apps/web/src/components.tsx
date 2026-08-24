import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { AlertCircle, CircleCheck, LoaderCircle, RefreshCcw, Undo2, X } from 'lucide-react';
import { ApiError } from './api.js';

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'The operation could not be completed.';
}

export function Spinner() {
  return <LoaderCircle className="spinner" size={16} aria-hidden="true" />;
}

export function LoadingSkeleton({
  variant,
  label,
  tableKind = 'issues',
  tableDensity = 'default',
  tableColumnCount,
  tableGridTemplate,
  boardDensity = 'default',
  panel = false,
}: {
  variant: 'gate' | 'table' | 'board' | 'detail' | 'editor' | 'command' | 'project' | 'workflow' | 'milestones' | 'relations' | 'comments' | 'activity';
  label: string;
  tableKind?: 'projects' | 'issues';
  tableDensity?: 'compact' | 'default' | 'comfortable';
  tableColumnCount?: number;
  tableGridTemplate?: string;
  boardDensity?: 'compact' | 'default' | 'comfortable';
  panel?: boolean;
}) {
  const rows = variant === 'command' ? 2 : variant === 'table' ? 7 : 0;
  const tableColumns = tableColumnCount ?? (tableKind === 'projects' ? 6 : 7);
  return (
    <div
      className={`loading-skeleton loading-skeleton-${variant} ${variant === 'table' ? `loading-skeleton-table-${tableKind}` : ''} ${variant === 'table' && tableKind === 'projects' ? `loading-skeleton-project-density-${tableDensity}` : ''} ${variant === 'table' && tableKind === 'issues' ? `loading-skeleton-issue-density-${tableDensity}` : ''} ${variant === 'board' ? `loading-skeleton-board-density-${boardDensity}` : ''} ${panel ? 'loading-skeleton-panel' : ''}`.trim()}
      style={tableGridTemplate === undefined ? undefined : { '--loading-table-grid': tableGridTemplate } as CSSProperties}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      <div className="loading-skeleton-visual" aria-hidden="true">
        {variant === 'gate' ? <>
          <span className="skeleton-block skeleton-mark" />
          <span className="skeleton-block skeleton-title" />
          <span className="skeleton-block skeleton-field" />
          <span className="skeleton-block skeleton-field" />
          <span className="skeleton-block skeleton-action" />
        </> : null}
        {variant === 'table' ? <>
          <div className="skeleton-table-row skeleton-table-header">{Array.from({ length: tableColumns }, (_, index) => <span className="skeleton-block" key={`header-${index}`} />)}</div>
          {Array.from({ length: rows }, (_, row) => <div className="skeleton-table-row" key={`row-${row}`}>{Array.from({ length: tableColumns }, (__, column) => <span className="skeleton-block" key={`cell-${row}-${column}`} />)}</div>)}
        </> : null}
        {variant === 'board' ? Array.from({ length: 3 }, (_, column) => (
          <div className="skeleton-board-column" key={`board-column-${column}`}>
            <div className="skeleton-board-header"><span className="skeleton-block" /><span className="skeleton-block" /></div>
            <div className="skeleton-board-cards">
              {Array.from({ length: 3 }, (__, card) => <div className="skeleton-board-card" key={`board-card-${column}-${card}`}><span className="skeleton-block" /><span className="skeleton-block" /><span><span className="skeleton-block" /><span className="skeleton-block" /></span></div>)}
            </div>
          </div>
        )) : null}
        {variant === 'detail' ? <>
          <div className="skeleton-detail-header"><span className="skeleton-block" /><span className="skeleton-block" /></div>
          <div className="skeleton-detail-grid">
            <div className="skeleton-detail-main">
              <span className="skeleton-block skeleton-detail-title" />
              <span className="skeleton-block skeleton-detail-heading" />
              <span className="skeleton-block skeleton-detail-editor" />
            </div>
            <div className="skeleton-detail-properties">
              <span className="skeleton-block skeleton-detail-heading" />
              {Array.from({ length: 7 }, (_, index) => <span className="skeleton-block" key={`property-${index}`} />)}
            </div>
          </div>
        </> : null}
        {variant === 'editor' ? <>
          <div className="skeleton-editor-toolbar">{Array.from({ length: 6 }, (_, index) => <span className="skeleton-block" key={`tool-${index}`} />)}</div>
          <div className="skeleton-editor-copy"><span className="skeleton-block" /><span className="skeleton-block" /><span className="skeleton-block" /></div>
        </> : null}
        {variant === 'command' ? Array.from({ length: rows }, (_, row) => <div className="skeleton-command-row" key={`command-${row}`}><span className="skeleton-block" /><span><span className="skeleton-block" /><span className="skeleton-block" /></span></div>) : null}
        {variant === 'project' ? <>
          <div className="skeleton-project-hero">
            <div className="skeleton-project-identity"><span className="skeleton-block" /><span><span className="skeleton-block" /><span className="skeleton-block" /></span></div>
            <div className="skeleton-project-actions"><span className="skeleton-block" /><span className="skeleton-block" /><span className="skeleton-block" /></div>
          </div>
          <div className="skeleton-project-tabs">{Array.from({ length: 3 }, (_, index) => <span className="skeleton-block" key={`project-tab-${index}`} />)}</div>
          <div className="skeleton-project-overview">
            <div className="skeleton-project-properties"><span className="skeleton-block skeleton-section-heading" /><div>{Array.from({ length: 6 }, (_, index) => <span className="skeleton-block" key={`project-property-${index}`} />)}</div></div>
            <div className="skeleton-project-progress"><span><span className="skeleton-block" /><span className="skeleton-block" /></span><span className="skeleton-block" /></div>
            <div className="skeleton-project-document"><span><span className="skeleton-block skeleton-section-heading" /><span className="skeleton-block" /><span className="skeleton-block" /><span className="skeleton-block" /></span><span><span className="skeleton-block skeleton-section-heading" /><span className="skeleton-block" /><span className="skeleton-block" /></span></div>
          </div>
        </> : null}
        {variant === 'workflow' ? Array.from({ length: 2 }, (_, group) => <div className="skeleton-workflow-group" key={`workflow-group-${group}`}>
          <div className="skeleton-workflow-header"><span className="skeleton-block" /><span className="skeleton-block" /><span className="skeleton-block" /></div>
          <div className="skeleton-workflow-list">{Array.from({ length: 4 }, (__, row) => <div className="skeleton-workflow-row" key={`workflow-row-${group}-${row}`}>{Array.from({ length: 5 }, (___, column) => <span className="skeleton-block" key={`workflow-cell-${group}-${row}-${column}`} />)}</div>)}</div>
        </div>) : null}
        {variant === 'milestones' ? <div className="skeleton-milestone-list">{Array.from({ length: 4 }, (_, row) => <div className="skeleton-milestone-row" key={`milestone-${row}`}>{Array.from({ length: 6 }, (__, column) => <span className="skeleton-block" key={`milestone-cell-${row}-${column}`} />)}</div>)}</div> : null}
        {variant === 'relations' ? <div className="skeleton-relation-list">{Array.from({ length: 3 }, (_, row) => <div className="skeleton-relation-row" key={`relation-${row}`}><span className="skeleton-block" /><span><span className="skeleton-block" /><span className="skeleton-block" /></span><span className="skeleton-block" /></div>)}</div> : null}
        {variant === 'comments' ? <div className="skeleton-comment-list">{Array.from({ length: 2 }, (_, row) => <div className="skeleton-comment-row" key={`comment-${row}`}><div><span className="skeleton-block" /><span className="skeleton-block" /><span className="skeleton-block" /></div><span className="skeleton-block" /><span className="skeleton-block" /></div>)}</div> : null}
        {variant === 'activity' ? <div className="skeleton-activity-list">{Array.from({ length: 3 }, (_, row) => <div className="skeleton-activity-row" key={`activity-${row}`}><span className="skeleton-block" /><span><span className="skeleton-block" /><span className="skeleton-block" /></span></div>)}</div> : null}
      </div>
    </div>
  );
}

export function Field(props: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  maxLength?: number;
  required?: boolean;
}) {
  const { label, required = true, ...inputProps } = props;
  return (
    <label className="field">
      <span>{label}</span>
      <input {...inputProps} required={required} />
    </label>
  );
}

export function ErrorNotice({ error }: { error: unknown }) {
  if (error === null || error === undefined) return null;
  const apiError = error instanceof ApiError ? error : undefined;
  return (
    <div className="error-notice" role="alert">
      <span>{message(error)}</span>
      {apiError?.correlationId ? <code>{apiError.correlationId}</code> : null}
    </div>
  );
}

export function ArchiveActionNotice({
  message: noticeMessage,
  tone,
  undoAvailable,
  pending,
  undoLabel,
  undoButtonRef,
  onUndo,
  onDismiss,
}: {
  message: string;
  tone: 'success' | 'error';
  undoAvailable: boolean;
  pending: boolean;
  undoLabel: string;
  undoButtonRef?: RefObject<HTMLButtonElement | null>;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className={`archive-action-notice ${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      aria-busy={pending}
    >
      <span className="archive-action-notice-copy">
        {tone === 'error'
          ? <AlertCircle size={16} aria-hidden="true" />
          : <CircleCheck size={16} aria-hidden="true" />}
        <span>{noticeMessage}</span>
      </span>
      <span className="archive-action-notice-actions">
        {undoAvailable ? (
          <button
            ref={undoButtonRef}
            type="button"
            className="button"
            aria-label={undoLabel}
            onClick={onUndo}
            disabled={pending}
          >
            {pending ? <Spinner /> : <Undo2 size={14} aria-hidden="true" />}
            {pending ? 'Restoring' : 'Undo'}
          </button>
        ) : null}
        <button
          type="button"
          className="icon-button"
          aria-label="Dismiss archive notice"
          title="Dismiss"
          onClick={onDismiss}
          disabled={pending}
        ><X size={14} aria-hidden="true" /></button>
      </span>
    </div>
  );
}

export function QueryErrorState({
  title,
  error,
  onRetry,
  retrying = false,
  compact = false,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
  retrying?: boolean;
  compact?: boolean;
}) {
  const apiError = error instanceof ApiError ? error : undefined;
  return (
    <div
      className={`query-error-state ${compact ? 'compact' : ''}`.trim()}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <AlertCircle size={18} aria-hidden="true" />
      <div className="query-error-copy">
        <strong>{title}</strong>
        <span>{message(error)}</span>
        {apiError?.correlationId ? <code>{apiError.correlationId}</code> : null}
      </div>
      <button type="button" className="button" onClick={onRetry} disabled={retrying}>
        {retrying ? <Spinner /> : <RefreshCcw size={14} />}
        {retrying ? 'Trying again' : 'Try again'}
      </button>
    </div>
  );
}

export function ConnectionBanner({
  error,
  recoveryError = null,
  reconnected,
  checking,
  recovering = false,
  onRetry,
}: {
  error: unknown | null;
  recoveryError?: unknown | null;
  reconnected: boolean;
  checking: boolean;
  recovering?: boolean;
  onRetry: () => void;
}) {
  if (error === null && recoveryError === null && recovering) {
    return (
      <div className="connection-banner reconnected recovering" role="status" aria-live="polite" aria-atomic="true">
        <Spinner />
        <div className="connection-banner-copy">
          <strong>Restoring local session</strong>
          <span>Active data will refresh when the owner session is ready.</span>
        </div>
      </div>
    );
  }
  if (error === null && recoveryError === null && !reconnected) return null;
  if (error === null && recoveryError === null) {
    return (
      <div className="connection-banner reconnected" role="status" aria-live="polite" aria-atomic="true">
        <CircleCheck size={17} aria-hidden="true" />
        <div className="connection-banner-copy">
          <strong>Local service reconnected</strong>
          <span>Refreshing active data.</span>
        </div>
      </div>
    );
  }
  const currentError = error ?? recoveryError;
  const recoveryFailed = error === null && recoveryError !== null;
  const retrying = recoveryFailed ? recovering : checking;
  const apiError = currentError instanceof ApiError ? currentError : undefined;
  return (
    <div className="connection-banner unavailable" role="alert" aria-live="assertive" aria-atomic="true" aria-busy={retrying}>
      <AlertCircle size={17} aria-hidden="true" />
      <div className="connection-banner-copy">
        <strong>{recoveryFailed ? 'Local session recovery failed' : 'Local service unavailable'}</strong>
        <span>{message(currentError)} Open drafts stay on this page while it reconnects.</span>
        {apiError?.correlationId ? <code>{apiError.correlationId}</code> : null}
      </div>
      <button type="button" className="button" onClick={onRetry} disabled={retrying}>
        {retrying ? <Spinner /> : <RefreshCcw size={14} />}
        {retrying ? 'Checking' : 'Try now'}
      </button>
    </div>
  );
}

export function Dialog({
  title,
  open,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      const frame = window.requestAnimationFrame(() => {
        dialog.querySelector<HTMLElement>(
          '.dialog-form input:not([disabled]), .dialog-form select:not([disabled]), .dialog-form textarea:not([disabled]), .dialog-form button:not([disabled])',
        )?.focus();
      });
      return () => window.cancelAnimationFrame(frame);
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const trapFocus = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return;
    const dialog = ref.current;
    if (!dialog) return;
    const focusable = [...dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    )].filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? 'dialog-wide' : ''}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={onClose}
      onKeyDown={trapFocus}
    >
      <div className="dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close" title="Close">
          <X size={16} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function EmptyState({ icon, title, action }: {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon}
      <strong>{title}</strong>
      {action === undefined ? null : <div className="empty-state-action">{action}</div>}
    </div>
  );
}
