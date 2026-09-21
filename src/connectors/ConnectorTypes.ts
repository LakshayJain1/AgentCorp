// Per-user connector model. Every tool call is scoped to (userId, workspaceId, repo).
// Raw secrets never live here — only references + status. Secrets stay in KeyVault (server).

export interface WorkspaceScope {
  userId: string;
  workspaceId: string;
  /** Full repo identifier the user connected, e.g. "octo/my-app". Empty = no repo connected. */
  repo: string;
}

export type ConnectorKind = 'github' | 'vercel' | 'ai-keys';

export interface ConnectorStatus {
  kind: ConnectorKind;
  connected: boolean;
  /** Human-readable detail, e.g. repo name or "not connected". Never includes secrets. */
  detail: string;
  /** When false, the exact platform credential needed to enable it. */
  needsPlatformCredential?: string;
}

export function isRepoAllowed(scope: WorkspaceScope, allowedRepos: string[]): boolean {
  if (!scope.repo) return false;
  return allowedRepos.includes(scope.repo);
}

export function scopeLabel(scope: Partial<WorkspaceScope>): string {
  const u = scope.userId ?? 'signed-out';
  const w = scope.workspaceId ?? 'no-workspace';
  const r = scope.repo || 'no-repo';
  return `${u} / ${w} / ${r}`;
}
