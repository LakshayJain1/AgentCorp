import { NextRequest } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getOrCreateAuth0Org, mgmt } from '@/lib/auth0Mgmt';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Module-level map: auth0OrgId → our internal orgId (for post-invite-accept lookup)
export const auth0OrgIndex = new Map<string, string>();

export async function POST(req: NextRequest) {
  // Must be authenticated
  const session = await auth0.getSession();
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.AUTH0_MGMT_CLIENT_ID || !process.env.AUTH0_MGMT_CLIENT_SECRET) {
    return Response.json(
      { error: 'AUTH0_MGMT_CLIENT_ID / AUTH0_MGMT_CLIENT_SECRET not configured' },
      { status: 503 },
    );
  }

  let body: { orgId?: string; companyName?: string; emails?: string[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  const { orgId, companyName, emails } = body;
  if (!orgId || !companyName || !Array.isArray(emails) || emails.length === 0) {
    return Response.json({ error: 'orgId, companyName, and emails[] required' }, { status: 400 });
  }

  const validEmails = emails.filter((e) => typeof e === 'string' && e.includes('@'));
  if (validEmails.length === 0) {
    return Response.json({ error: 'No valid email addresses' }, { status: 400 });
  }

  // 1. Get or create the Auth0 org
  const org = await getOrCreateAuth0Org(orgId, companyName);
  if (!org) {
    return Response.json({ error: 'Failed to create Auth0 organization' }, { status: 500 });
  }

  // Store mapping for post-acceptance redirect
  auth0OrgIndex.set(org.id, orgId);

  const inviterName = (session.user.name as string | undefined) || companyName;
  const clientId = process.env.AUTH0_CLIENT_ID!;

  // 2. Send one invitation per email
  const sent: string[] = [];
  const failed: string[] = [];

  await Promise.all(
    validEmails.map(async (email) => {
      const res = await mgmt(`/organizations/${org.id}/invitations`, {
        method: 'POST',
        body: JSON.stringify({
          inviter: { name: inviterName },
          invitee: { email },
          client_id: clientId,
          send_invitation_email: true,
          ttl_sec: 60 * 60 * 24 * 7, // 7 days
          app_metadata: { agentcorp_invite_org_id: orgId },
        }),
      });

      if (res.ok) {
        sent.push(email);
      } else {
        const err = await res.text();
        console.error(`[invite] failed for ${email}:`, err);
        failed.push(email);
      }
    }),
  );

  return Response.json({ ok: true, auth0OrgId: org.id, sent, failed });
}

// GET /api/invite/lookup?auth0OrgId=xxx → our internal orgId
// Used by the workspace page after a user accepts an org invitation
export async function GET(req: NextRequest) {
  const auth0OrgId = req.nextUrl.searchParams.get('auth0OrgId');
  if (!auth0OrgId) return Response.json({ found: false }, { status: 400 });

  // Check in-memory index first
  const cached = auth0OrgIndex.get(auth0OrgId);
  if (cached) return Response.json({ found: true, orgId: cached });

  // Fall back to Management API if this is a new process instance
  if (!process.env.AUTH0_MGMT_CLIENT_ID) return Response.json({ found: false }, { status: 404 });

  try {
    const res = await mgmt(`/organizations/${auth0OrgId}`);
    if (!res.ok) return Response.json({ found: false }, { status: 404 });
    const org = await res.json() as { metadata?: { external_id?: string } };
    const orgId = org.metadata?.external_id;
    if (!orgId) return Response.json({ found: false }, { status: 404 });
    auth0OrgIndex.set(auth0OrgId, orgId);
    return Response.json({ found: true, orgId });
  } catch {
    return Response.json({ found: false }, { status: 500 });
  }
}
