import { NextResponse, type NextRequest } from 'next/server';
import { getUserId } from '@/lib/session';
import { DbNotConfiguredError } from '@/lib/db/client';
import { getProvider, listProviders } from '@/lib/integrations/registry';
import { deleteToken, listConnected } from '@/lib/integrations/token-service';
import { resolveWorkspace } from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/integrations — connection summaries + available providers.
// Never returns tokens, not even masked.
export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const workspaceId = await resolveWorkspace(userId);
    const connections = await listConnected(userId, workspaceId);
    return NextResponse.json({
      success: true,
      workspaceId,
      connections,
      providers: listProviders().map((p) => ({
        id: p.id,
        label: p.label,
        scopes: p.scopes,
      })),
    });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) {
      return NextResponse.json(
        { success: false, code: 'server_not_configured', error: 'Integration storage is not configured.' },
        { status: 503 },
      );
    }
    throw err;
  }
}

// DELETE /api/integrations?provider=github — revoke and wipe the connection.
export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const provider = req.nextUrl.searchParams.get('provider') ?? '';
  if (!getProvider(provider)) {
    return NextResponse.json({ success: false, error: 'unknown provider' }, { status: 404 });
  }

  try {
    const workspaceId = await resolveWorkspace(userId);
    const removed = await deleteToken(userId, workspaceId, provider);
    return NextResponse.json({ success: true, removed });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) {
      return NextResponse.json(
        { success: false, code: 'server_not_configured', error: 'Integration storage is not configured.' },
        { status: 503 },
      );
    }
    throw err;
  }
}
