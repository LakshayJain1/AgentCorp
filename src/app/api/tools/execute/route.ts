import { NextResponse, type NextRequest } from 'next/server';
import { getUserId } from '@/lib/session';
import { DbNotConfiguredError } from '@/lib/db/client';
import { getToken } from '@/lib/integrations/token-service';
import { getServerTool, ToolInputError } from '@/lib/integrations/tools';
import { resolveWorkspace } from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ExecuteBody {
  tool?: string;
  params?: Record<string, string>;
}

// POST /api/tools/execute { tool, params }
// Runs a provider tool with the caller's decrypted token. Tokens are never
// returned to the client — only the tool's textual result.
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as ExecuteBody | null;
  if (!body?.tool) {
    return NextResponse.json({ success: false, error: 'tool is required' }, { status: 400 });
  }

  const tool = getServerTool(body.tool);
  if (!tool) {
    return NextResponse.json({ success: false, error: 'unknown tool' }, { status: 404 });
  }

  try {
    const workspaceId = await resolveWorkspace(userId);
    const token = await getToken(userId, workspaceId, tool.provider);
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          code: 'not_connected',
          error: `${tool.provider} is not connected. Connect it in Settings → Integrations.`,
        },
        { status: 409 },
      );
    }

    const output = await tool.run(token, body.params ?? {});
    return NextResponse.json({ success: true, output });
  } catch (err) {
    if (err instanceof ToolInputError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }
    if (err instanceof DbNotConfiguredError) {
      return NextResponse.json(
        { success: false, code: 'server_not_configured', error: 'Integration storage is not configured.' },
        { status: 503 },
      );
    }
    // Provider error text is safe (codes/status), never the token.
    console.error(`[tools] ${tool.name} failed:`, err instanceof Error ? err.message : 'unknown');
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'tool execution failed' },
      { status: 502 },
    );
  }
}
