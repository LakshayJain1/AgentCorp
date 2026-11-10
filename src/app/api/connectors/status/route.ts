import { NextResponse } from 'next/server';

// Reports which platform capabilities are configured — WITHOUT exposing secret
// values. Per-user provider credentials live in the encrypted integration
// store, so this only tells the operator what the server still needs.
export async function GET() {
  const githubOAuthConfigured = Boolean(
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
  );
  const slackOAuthConfigured = Boolean(
    process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET,
  );
  const linearOAuthConfigured = Boolean(
    process.env.LINEAR_CLIENT_ID && process.env.LINEAR_CLIENT_SECRET,
  );
  const integrationStorageConfigured = Boolean(
    process.env.DATABASE_URL && process.env.TOKEN_ENCRYPTION_KEY,
  );
  const aiConfigured = Boolean(process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY);

  return NextResponse.json({
    githubOAuthConfigured,
    slackOAuthConfigured,
    linearOAuthConfigured,
    integrationStorageConfigured,
    // Retained for older clients; both legacy paths are retired.
    githubAppConfigured: false,
    githubDevTokenConfigured: false,
    githubConfigured: githubOAuthConfigured && integrationStorageConfigured,
    aiConfigured,
    needed: [
      ...(!integrationStorageConfigured
        ? ['DATABASE_URL + TOKEN_ENCRYPTION_KEY (encrypted per-user integration storage)']
        : []),
      ...(!githubOAuthConfigured
        ? ['GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET (users connect their own repos via OAuth)']
        : []),
      ...(!slackOAuthConfigured ? ['SLACK_CLIENT_ID + SLACK_CLIENT_SECRET (Slack OAuth)'] : []),
      ...(!linearOAuthConfigured ? ['LINEAR_CLIENT_ID + LINEAR_CLIENT_SECRET (Linear OAuth)'] : []),
      ...(!aiConfigured
        ? ['OPENROUTER_API_KEY and/or GEMINI_API_KEY (dev fallback until per-user BYOK vault lands)']
        : []),
    ],
  });
}
