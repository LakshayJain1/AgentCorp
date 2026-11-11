// Server-only CI checks reader. The caller supplies a per-user OAuth token
// decrypted from the integration store. NEVER import from client components.
import { parseRepo } from './GitHubClient';

const API = 'https://api.github.com';

export type ChecksVerdict = 'pass' | 'fail' | 'pending' | 'none';

export interface RepoChecksSummary {
  verdict: ChecksVerdict;
  total: number;
  passed: number;
  failed: number;
  pending: number;
  details: string[];
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export async function getRepoChecks(
  token: string,
  repoInput: string,
  ref: string,
): Promise<RepoChecksSummary | { error: string; status: number }> {
  const parsed = parseRepo(repoInput);
  if (!parsed) return { error: `invalid repo '${repoInput}'`, status: 400 };
  if (!ref.trim() || ref.includes('..')) return { error: `invalid ref '${ref}'`, status: 400 };

  const url = `${API}/repos/${parsed.owner}/${parsed.repo}/commits/${encodeURIComponent(ref)}/check-runs?per_page=50`;
  const r = await fetch(url, { headers: headers(token) });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    return { error: `checks read failed (${r.status}): ${body.slice(0, 200)}`, status: r.status };
  }
  const j = (await r.json()) as {
    check_runs?: Array<{ name?: string; status?: string; conclusion?: string | null; html_url?: string }>;
  };
  const runs = j.check_runs ?? [];
  if (runs.length === 0) {
    return { verdict: 'none', total: 0, passed: 0, failed: 0, pending: 0, details: ['No check runs for this ref (CI may not be configured).'] };
  }

  let passed = 0, failed = 0, pending = 0;
  const details: string[] = [];
  for (const run of runs) {
    const name = run.name ?? 'unknown';
    if (run.status !== 'completed') {
      pending += 1;
      details.push(`CI ${name}: RUNNING`);
    } else if (run.conclusion === 'success' || run.conclusion === 'neutral' || run.conclusion === 'skipped') {
      passed += 1;
      details.push(`CI ${name}: PASSED (${run.conclusion})`);
    } else {
      failed += 1;
      details.push(`CI ${name}: FAILED (${run.conclusion})`);
    }
  }
  const verdict: ChecksVerdict = failed > 0 ? 'fail' : pending > 0 ? 'pending' : 'pass';
  return { verdict, total: runs.length, passed, failed, pending, details };
}
