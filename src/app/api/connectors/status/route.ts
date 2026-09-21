import { NextResponse } from 'next/server';

// Reports which platform credentials are configured — WITHOUT exposing secret values.
// End-user repo/key connections happen per user via OAuth/vault (P1-full); this only
// tells the UI what is missing and exactly what to ask for.
export async function GET() {
  const githubAppConfigured = !!(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);
  const githubDevTokenConfigured = !!process.env.GITHUB_DEV_TOKEN;
  const githubConfigured = githubAppConfigured || githubDevTokenConfigured;
  const aiConfigured = !!(process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY);

  return NextResponse.json({
    githubAppConfigured,
    githubDevTokenConfigured,
    githubConfigured,
    aiConfigured,
    needed: [
      ...(!githubConfigured
        ? ['GITHUB_APP_ID + GITHUB_APP_PRIVATE_KEY + OAuth client ID/secret (so users can connect their own repos)']
        : []),
      ...(!aiConfigured
        ? ['OPENROUTER_API_KEY and/or GEMINI_API_KEY (dev fallback until per-user BYOK vault lands)']
        : []),
    ],
  });
}
