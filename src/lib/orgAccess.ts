import 'server-only';

import { clerkClient } from '@clerk/nextjs/server';
import { getClerkOrgId, getSnapshot } from '@/lib/orgStore';

const MEMBER_ROLE = 'org:member';

// Positive results only, short-lived: the viewer polls org-state every few
// seconds and we don't want a Clerk API call on every poll.
const allowed = new Map<string, number>();
const ALLOW_TTL_MS = 60_000;

function cacheKey(userId: string, orgId: string) {
  return `${userId}:${orgId}`;
}

/** Pull the first Clerk API error code out of a thrown backend error. */
export function clerkErrorCode(e: unknown): string {
  const err = e as { errors?: Array<{ code?: string }> };
  return err?.errors?.[0]?.code ?? '';
}

/**
 * May `userId` view this workspace? Yes if they own it, are a member of its
 * Clerk Organization, or hold a pending invitation addressed to one of their
 * VERIFIED email addresses — in which case the invitation is accepted here
 * (membership created, invitation revoked), so the invitee never has to touch
 * Clerk's own accept flow.
 */
export async function canViewOrg(userId: string, orgId: string): Promise<boolean> {
  const entry = await getSnapshot(orgId).catch(() => null);
  if (entry?.ownerSub === userId) return true;

  const clerkOrgId = await getClerkOrgId(orgId).catch(() => null);
  if (!clerkOrgId) return false;

  const key = cacheKey(userId, orgId);
  const until = allowed.get(key);
  if (until && until > Date.now()) return true;

  try {
    const clerk = await clerkClient();

    const members = await clerk.organizations.getOrganizationMembershipList({
      organizationId: clerkOrgId,
      userId: [userId],
      limit: 1,
    });
    if (members.data.length > 0) {
      allowed.set(key, Date.now() + ALLOW_TTL_MS);
      return true;
    }

    const user = await clerk.users.getUser(userId);
    const verified = new Set(
      user.emailAddresses
        .filter((e) => e.verification?.status === 'verified')
        .map((e) => e.emailAddress.toLowerCase()),
    );
    if (verified.size === 0) return false;

    const invites = await clerk.organizations.getOrganizationInvitationList({
      organizationId: clerkOrgId,
      status: ['pending'],
      limit: 100,
    });
    const match = invites.data.find((i) => verified.has(i.emailAddress.toLowerCase()));
    if (!match) return false;

    await clerk.organizations.createOrganizationMembership({
      organizationId: clerkOrgId,
      userId,
      role: MEMBER_ROLE,
    });
    await clerk.organizations
      .revokeOrganizationInvitation({
        organizationId: clerkOrgId,
        invitationId: match.id,
        requestingUserId: entry?.ownerSub,
      })
      .catch(() => undefined); // membership exists; a stale pending invite is harmless

    allowed.set(key, Date.now() + ALLOW_TTL_MS);
    return true;
  } catch (e) {
    console.error('[orgAccess] check failed:', clerkErrorCode(e), (e as Error).message);
    return false;
  }
}
