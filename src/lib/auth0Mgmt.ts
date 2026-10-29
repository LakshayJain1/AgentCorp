// Auth0 Management API helper — server-side only
// Requires AUTH0_DOMAIN, AUTH0_MGMT_CLIENT_ID, AUTH0_MGMT_CLIENT_SECRET

let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getMgmtToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.value;
  }

  const domain = process.env.AUTH0_DOMAIN!;
  const res = await fetch(`https://${domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.AUTH0_MGMT_CLIENT_ID,
      client_secret: process.env.AUTH0_MGMT_CLIENT_SECRET,
      audience: `https://${domain}/api/v2/`,
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) throw new Error(`Auth0 token exchange failed: ${res.status}`);
  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

export async function mgmt(path: string, init: RequestInit = {}) {
  const token = await getMgmtToken();
  const domain = process.env.AUTH0_DOMAIN!;
  const res = await fetch(`https://${domain}/api/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  return res;
}

// Returns the first Auth0 database connection ID for the tenant
export async function getDefaultConnectionId(): Promise<string | null> {
  const res = await mgmt('/connections?strategy=auth0&fields=id,name&include_fields=true&per_page=1');
  if (!res.ok) return null;
  const conns = await res.json() as Array<{ id: string; name: string }>;
  return conns[0]?.id ?? null;
}

// Find or create an Auth0 Organization for our internal orgId
export async function getOrCreateAuth0Org(
  orgId: string,
  companyName: string,
): Promise<{ id: string; name: string } | null> {
  // Search by metadata external_id
  const searchRes = await mgmt(
    `/organizations?q=${encodeURIComponent(`metadata.external_id:"${orgId}"`)}&search_engine=v3&per_page=1`,
  );
  if (searchRes.ok) {
    const orgs = await searchRes.json() as Array<{ id: string; name: string }>;
    if (orgs.length > 0) return orgs[0];
  }

  // Build a valid Auth0 org name slug: lowercase alphanumeric + hyphens, max 50 chars
  const slug = orgId
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  const createRes = await mgmt('/organizations', {
    method: 'POST',
    body: JSON.stringify({
      name: slug,
      display_name: companyName,
      metadata: { external_id: orgId },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error('[auth0Mgmt] org create failed:', err);
    return null;
  }

  const org = await createRes.json() as { id: string; name: string };

  // Enable the tenant's default database connection on this org
  const connId = await getDefaultConnectionId();
  if (connId) {
    await mgmt(`/organizations/${org.id}/enabled_connections`, {
      method: 'POST',
      body: JSON.stringify({ connection_id: connId, assign_membership_on_login: false }),
    });
  }

  return org;
}
