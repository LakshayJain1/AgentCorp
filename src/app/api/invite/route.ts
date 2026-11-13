import { NextRequest } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { getUserId } from '@/lib/session';
import { canViewOrg, clerkErrorCode } from '@/lib/orgAccess';
import { rateLimit } from '@/lib/rateLimit';
import { ORG_ID_RE, getClerkOrgId, getSnapshot, linkClerkOrg } from '@/lib/orgStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_EMAILS_PER_REQUEST = 10;
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

// POST /api/invite — the OWNER of an org invites people by email. Clerk sends
// the invitation email; the link lands on /workspace?invite=<orgId>, where the
// invitee signs in with an emailed code and is let in because their verified
// email matches the invitation (see lib/orgAccess.ts).
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Invitation emails come from our Clerk instance — treat this as a spam vector.
  if (!rateLimit(`invite:${userId}`, 5, 60 * 60_000) || !rateLimit(`invite-day:${userId}`, 15, 24 * 60 * 60_000)) {
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
  if (entry.ownerSub !== userId) {
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

  const clerk = await clerkClient();

  // Find or create the Clerk Organization that mirrors this workspace.
  let clerkOrgId = await getClerkOrgId(orgId).catch(() => null);
  if (!clerkOrgId) {
    try {
      const created = await clerk.organizations.createOrganization({
        name: safeCompany,
        createdBy: userId,
        privateMetadata: { agentcorpOrgId: orgId },
      });
      clerkOrgId = created.id;
      await linkClerkOrg(orgId, userId, clerkOrgId).catch((e) =>
        console.error('[invite] link failed:', (e as Error).message),
      );
    } catch (e) {
      console.error('[invite] organization create failed:', clerkErrorCode(e), (e as Error).message);
      return Response.json(
        { error: 'Could not create the invite group. Make sure Organizations are enabled in the Clerk dashboard.' },
        { status: 503 },
      );
    }
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const redirectUrl = `${base.replace(/\/$/, '')}/workspace?invite=${orgId}`;

  const sent: string[] = [];
  const failed: string[] = [];

  await Promise.all(
    validEmails.map(async (email) => {
      try {
        await clerk.organizations.createOrganizationInvitation({
          organizationId: clerkOrgId!,
          emailAddress: email,
          role: 'org:member',
          inviterUserId: userId,
          redirectUrl,
          expiresInDays: 7,
        });
        sent.push(email);
      } catch (e) {
        const code = clerkErrorCode(e);
        // Already invited / already a member: they have (or will have) access, so not a failure.
        if (code === 'duplicate_record' || code === 'already_a_member_in_organization') {
          sent.push(email);
          return;
        }
        console.error('[invite] invitation failed:', code, (e as Error).message);
        failed.push(email);
      }
    }),
  );

  return Response.json({ ok: true, clerkOrgId, sent, failed });
}

// GET /api/invite?orgId=org_… — "am I allowed into this workspace?". Accepts a
// pending invitation addressed to the caller's verified email as a side effect.
export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return Response.json({ found: false }, { status: 401 });

  if (!rateLimit(`invite-check:${userId}`, 30, 60_000)) {
    return Response.json({ found: false }, { status: 429 });
  }

  const orgId = req.nextUrl.searchParams.get('orgId') ?? '';
  if (!ORG_ID_RE.test(orgId)) return Response.json({ found: false }, { status: 400 });

  const ok = await canViewOrg(userId, orgId);
  if (!ok) return Response.json({ found: false, reason: 'not_invited' }, { status: 403 });
  return Response.json({ found: true, orgId });
}
