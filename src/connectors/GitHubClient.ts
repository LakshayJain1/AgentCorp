// Server-only GitHub client. Uses GITHUB_DEV_TOKEN from server env —
// NEVER import this from client components. Token never leaves the server.
const API = 'https://api.github.com';

function devToken(): string | null {
  return process.env.GITHUB_DEV_TOKEN || null;
}

export function githubUnconfiguredReason(): string | null {
  if (!devToken()) return 'GITHUB_DEV_TOKEN is not set (server env). Save a fine-grained PAT and retry.';
  return null;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${devToken()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export function parseRepo(input: string): { owner: string; repo: string } | null {
  const m = input.trim().match(/^(?:https:\/\/github\.com\/)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

// Deny traversal + secret paths even though we act on the user's own repo.
export function isPathAllowed(path: string): boolean {
  const p = path.replace(/^\/+/, '');
  if (!p || p.includes('..')) return false;
  const lower = p.toLowerCase();
  if (lower.startsWith('.env') || lower.includes('.env.') || lower.startsWith('.git/')) return false;
  if (lower === '.env.local' || lower.endsWith('/.env.local')) return false;
  return true;
}

export async function readRepoFile(
  repoInput: string,
  path: string,
  ref?: string,
): Promise<{ content: string; sha: string } | { error: string; status: number }> {
  const unconf = githubUnconfiguredReason();
  if (unconf) return { error: unconf, status: 503 };
  const parsed = parseRepo(repoInput);
  if (!parsed) return { error: `invalid repo '${repoInput}' (want owner/name or github url)`, status: 400 };
  if (!isPathAllowed(path)) return { error: `denied path '${path}'`, status: 403 };
  const clean = path.replace(/^\/+/, '');
  const url = `${API}/repos/${parsed.owner}/${parsed.repo}/contents/${clean}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;
  const r = await fetch(url, { headers: headers() });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    return { error: `github read failed (${r.status}): ${body.slice(0, 300)}`, status: r.status };
  }
  const j = (await r.json()) as { content?: string; encoding?: string; sha?: string; type?: string };
  if (j.type && j.type !== 'file') return { error: `'${path}' is not a file`, status: 400 };
  const text = j.encoding === 'base64' && j.content
    ? Buffer.from(j.content.replace(/\n/g, ''), 'base64').toString('utf8')
    : (j.content ?? '');
  return { content: text, sha: j.sha ?? '' };
}

export async function proposeRepoFile(
  repoInput: string,
  path: string,
  content: string,
  message: string,
  base = 'main',
): Promise<{ branch: string; prUrl: string | null } | { error: string; status: number }> {
  const unconf = githubUnconfiguredReason();
  if (unconf) return { error: unconf, status: 503 };
  const parsed = parseRepo(repoInput);
  if (!parsed) return { error: `invalid repo '${repoInput}'`, status: 400 };
  if (!isPathAllowed(path)) return { error: `denied path '${path}'`, status: 403 };
  if (!message.trim()) return { error: 'commit message required', status: 400 };
  const { owner, repo } = parsed;
  const h = headers();
  const clean = path.replace(/^\/+/, '');

  // 1. base ref sha
  const refRes = await fetch(`${API}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(base)}`, { headers: h });
  if (!refRes.ok) {
    const t = await refRes.text().catch(() => '');
    return { error: `base branch '${base}' not found (${refRes.status}): ${t.slice(0, 200)}`, status: 400 };
  }
  const refJson = (await refRes.json()) as { object?: { sha?: string } };
  const baseSha = refJson.object?.sha;
  if (!baseSha) return { error: 'could not resolve base sha', status: 500 };

  // 2. create branch
  const branch = `agentcorp/${Date.now()}`;
  const brRes = await fetch(`${API}/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
  });
  if (!brRes.ok) {
    const t = await brRes.text().catch(() => '');
    return { error: `branch create failed (${brRes.status}): ${t.slice(0, 200)}`, status: 500 };
  }

  // 3. existing file sha (if any) on the new branch
  let existingSha: string | undefined;
  const cur = await fetch(
    `${API}/repos/${owner}/${repo}/contents/${clean}?ref=${encodeURIComponent(branch)}`,
    { headers: h },
  );
  if (cur.ok) {
    const cj = (await cur.json()) as { sha?: string };
    existingSha = cj.sha;
  }

  // 4. write file
  const putRes = await fetch(`${API}/repos/${owner}/${repo}/contents/${clean}`, {
    method: 'PUT',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    }),
  });
  if (!putRes.ok) {
    const t = await putRes.text().catch(() => '');
    return { error: `file write failed (${putRes.status}): ${t.slice(0, 300)}`, status: 500 };
  }

  // 5. open PR (non-fatal if it fails — branch+commit already landed)
  let prUrl: string | null = null;
  const prRes = await fetch(`${API}/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: message, head: branch, base, body: 'Proposed by AgentCorp agent.' }),
  });
  if (prRes.ok) {
    const pj = (await prRes.json()) as { html_url?: string };
    prUrl = pj.html_url ?? null;
  }
  return { branch, prUrl };
}
