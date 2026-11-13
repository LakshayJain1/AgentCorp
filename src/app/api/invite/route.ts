import { NextRequest } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getOrCreateAuth0Org, mgmt } from '@/lib/auth0Mgmt';
import { rateLimit } from '@/lib/rateLimit';
import { ORG_ID_RE, findOrgByAuth0Org, getSnapshot, linkAuth0Org } from '@/lib/orgStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_EMAILS_PER_REQUEST = 10;
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

// POST /api/invite — the OWNER of an org sends Auth0 invitation emails.
export async function POST(req: NextRequest) {
  const session = await auth0.getSession();
  const sub = session?.user?.sub as string | undefined;
  if (!session?.user || !sub) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.AUTH0_MGMT_CLIENT_ID || !process.env.AUTH0_MGMT_CLIENT_SECRET) {
    return Response.json(
      { error: 'AUTH0_MGMT_CLIENT_ID / AUTH0_MGMT_CLIENT_SECRET not configured' },
      { status: 503 },
    );
  }

  // Invitation emails come from our Auth0 tenant — treat this as a spam vector.
  if (!rateLimit(`invite:${sub}`, 5, 60 * 60_000) || !rateLimit(`invite-day:${sub}`, 15, 24 * 60 * 60_000)) {
    return Response.json({ error: 'Too many invitations. Try again later.' }, { status: 429 });
  }

  let body: { orgId?: unknown; companyName?: unknown; emails?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  const { orgId, companyName, emails } = body;
  if (typeof orgId !== 'string' || !ORG_ID_RE.test(orgId)) {
    return Response.json({ error: 'invalid orgId' }, { status: 400 });
  }
  if (typeof companyName !== 'string' || !companyName.trim() || !Array.isArray(emails) || emails.length === 0) {
    return Response.json({ error: 'orgId, companyName, and emails[] required' }, { status: 400 });
  }

  // AUTHORIZATION: only the user who owns this org may invite people to it.
  const entry = await getSnapshot(orgId).catch(() => null);
  if (!entry) {
    return Response.json({ error: 'Workspace is not synced yet — try again in a few seconds.' }, { status: 409 });
  }
  if (entry.ownerSub !== sub) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const validEmails = [
    ...new Set(
      emails
        .filter((e): e is string => typeof e === 'string')
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length <= 254 && EMAIL_RE.test(e)),
    ),
  ].slice(0, MAX_EMAILS_PER_REQUEST);
  if (validEmails.length === 0) {
    return Response.json({ error: 'No valid email addresses' }, { status: 400 });
  }

  // Strip control characters; keep the display name short.
  // eslint-disable-next-line no-control-regex
  const safeCompany = companyName.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 100);

  const org = await getOrCreateAuth0Org(orgId, safeCompany);
  if (!org) {
    return Response.json({ error: 'Failed to create Auth0 organization' }, { status: 500 });
  }
  await linkAuth0Org(orgId, sub, org.id).catch((e) => console.error('[invite] link failed:', (e as Error).message));

  // eslint-disable-next-line no-control-regex
  const inviterName = String((session.user.name as string | undefined) || safeCompany).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 100);
  const clientId = process.env.AUTH0_CLIENT_ID!;

  const sent: string[] = [];
  const failed: string[] = [];

  await Promise.all(
    validEmails.map(async (email) => {
      try {
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
          console.error(`[invite] failed (${res.status}) for an invitee`);
          failed.push(email);
        }
      } catch (e) {
        console.error('[invite] request error:', (e as Error).message);
        failed.push(email);
      }
    }),
  );

  return Response.json({ ok: true, auth0OrgId: org.id, sent, failed });
}

// GET /api/invite?auth0OrgId=xxx → our internal orgId.
// Used after a user accepts an Auth0 invitation. Signed-in users may only
// resolve THEIR OWN Auth0 organization, so an org id seen in an invitation URL
// can't be turned into a workspace link by a third party.
export async function GET(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user) return Response.json({ found: false }, { status: 401 });

  const auth0OrgId = req.nextUrl.searchParams.get('auth0OrgId');
  if (!auth0OrgId) return Response.json({ found: false }, { status: 400 });

  const myAuth0Org = (session.user as Record<string, unknown>).org_id;
  if (typeof myAuth0Org !== 'string' || myAuth0Org !== auth0OrgId) {
    return Response.json({ found: false }, { status: 404 });
  }

  const linked = await findOrgByAuth0Org(auth0OrgId).catch(() => null);
  if (linked) return Response.json({ found: true, orgId: linked });

  // Fallback for organizations created before org links were stored.
  if (!process.env.AUTH0_MGMT_CLIENT_ID) return Response.json({ found: false }, { status: 404 });
  try {
    const res = await mgmt(`/organizations/${encodeURIComponent(auth0OrgId)}`);
    if (!res.ok) return Response.json({ found: false }, { status: 404 });
    const org = (await res.json()) as { metadata?: { external_id?: string } };
    const orgId = org.metadata?.external_id;
    if (!orgId || !ORG_ID_RE.test(orgId)) return Response.json({ found: false }, { status: 404 });
    return Response.json({ found: true, orgId });
  } catch {
    return Response.json({ found: false }, { status: 500 });
  }
}
